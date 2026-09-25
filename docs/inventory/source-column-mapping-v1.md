# Waldhaus Inventory Source Column Mapping v1 (Revised)

Status: Draft for confirmation before inventory migration
Date: 2026-09-25
Scope: Legacy workbook mapping aligned to revised minimal Inventory v1 model

## 1) Mapping policy used in this revision

- Keep operational schema minimal.
- Promote only genuinely operational fields to first-class columns.
- Preserve all source fidelity in inventory_legacy_records.legacy_payload.
- Keep unresolved semantics recoverable without blocking migration.
- Use canonical language-independent domain codes in DB.
- Use localized labels only at UI level.

## 2) Confirmed unit decision

Confirmed business decision:
- legacy unit mb means linear/running meter
- canonical code is LINEAR_METER
- localized labels:
  - pl: mb
  - fi: jm
  - en: rm

Also required:
- canonical code PIECE
- localized labels:
  - pl: szt.
  - fi: kpl
  - en: pcs

Interpretation example:
- Ilosc = 14
- Jednostka = mb

Maps to:
- quantity = 14
- unit = LINEAR_METER

Not 14 individual boards.

## 3) Source-to-destination mapping matrix

Legend:
- DIRECT = copied to first-class operational field
- TRANSFORMED = normalized to canonical operational field
- PAYLOAD_ONLY = preserved in legacy_payload, not first-class in v1
- HYBRID = operational field plus full payload preservation

| SOURCE COLUMN | DESTINATION IN REVISED V1 | MAPPING TYPE | NOTES |
|---|---|---|---|
| 2021 | inventory_legacy_records.legacy_payload.2021 | PAYLOAD_ONLY | Non-blocking semantics; preserve exactly. |
| 2022 | inventory_legacy_records.legacy_payload.2022 | PAYLOAD_ONLY | Non-blocking semantics; preserve exactly. |
| 2023 | inventory_legacy_records.legacy_payload.2023 | PAYLOAD_ONLY | Non-blocking semantics; preserve exactly. |
| 2024 | inventory_legacy_records.legacy_payload.2024 | PAYLOAD_ONLY | Non-blocking semantics; preserve exactly. |
| Nr | material_lots.legacy_record_number plus legacy_payload.Nr | HYBRID | Operational trace plus full source retention. |
| Stary nr | material_lots.legacy_old_number plus legacy_payload.Stary_nr | HYBRID | Preserve exactly. |
| Gatunek | materials.species_code plus materials.species_label_raw plus payload | HYBRID | Canonicalize known values; keep raw source token. |
| Grubosc | legacy_payload.Grubosc (optional parse staging outside v1 first-class) | PAYLOAD_ONLY | Source unit still open question. |
| Szerokosc | legacy_payload.Szerokosc (optional parse staging outside v1 first-class) | PAYLOAD_ONLY | Source unit still open question; mixed/range forms remain payload. |
| Dlugosc | legacy_payload.Dlugosc (optional parse staging outside v1 first-class) | PAYLOAD_ONLY | Source unit still open question; mixed/range forms remain payload. |
| Ilosc | stock_movements.quantity_delta and or derived receive seed movement, plus payload | HYBRID | Preserve value and movement-level unit. |
| Jednostka | stock_movements.quantity_unit_code plus payload | TRANSFORMED | mb maps to LINEAR_METER; preserve raw token in payload. |
| A | inventory_legacy_records.legacy_payload.A | PAYLOAD_ONLY | Preserve exactly; no first-class v1 lot column. |
| B | inventory_legacy_records.legacy_payload.B | PAYLOAD_ONLY | Preserve exactly; no first-class v1 lot column. |
| C | inventory_legacy_records.legacy_payload.C | PAYLOAD_ONLY | Preserve exactly; no first-class v1 lot column. |
| Masa | material_lots.volume_m3 plus volume_source plus payload | HYBRID | Treated as volume-related value, not weight. |
| Rodzaj | materials.material_type_code plus materials.material_type_label_raw plus payload | HYBRID | Canonicalize known values; keep raw source token. |
| Jakosc | material_lots.quality_code plus material_lots.quality_label_raw plus payload | HYBRID | Keep raw vocabulary; avoid premature hard enum. |
| Opis | material_lots.description_text plus payload | HYBRID | Free text preserved as-is. |
| Uwagi | material_lots.notes_text plus payload | HYBRID | Free text preserved as-is. |
| Lokalizacja | material_lots.storage_location_id when matched plus material_lots.location_raw_text plus payload | HYBRID | Mixed legacy tokens remain recoverable. |
| Data uzycia | inventory_legacy_records.legacy_payload.Data_uzycia | PAYLOAD_ONLY | Semantics non-blocking; preserve raw form. |
| PEFC | inventory_legacy_records.legacy_payload.PEFC (optional lot-level normalized fields later) | PAYLOAD_ONLY | Semantics non-blocking; preserve exactly. |

## 4) Stock ledger alignment in v1

Stock is derived from stock_movements in v1, not from manually edited mutable lot balances.

Minimal movement types in v1:
- RECEIVE
- CONSUME
- ADJUST
- TRANSFER

Unit preservation rule:
- Every movement stores quantity_unit_code as canonical domain code.

Examples:
- RECEIVE +14 LINEAR_METER
- CONSUME -3.5 LINEAR_METER
- RECEIVE +10 PIECE

## 5) Non-blocking items due to payload preservation

The following are explicitly non-blocking for first migration design because source values remain fully recoverable:
- Data uzycia semantics
- PEFC representation semantics
- year-column semantics (2021/2022/2023/2024)

## 6) Main open business questions before migration

Primary open questions:
- Confirm source unit for Grubosc.
- Confirm source unit for Szerokosc.
- Confirm source unit for Dlugosc.

Secondary open question:
- Confirm whether additional operational quantity units beyond LINEAR_METER and PIECE are required at go-live.

## 7) Guardrails retained

- Do not model A/B/C as quality grades.
- Do not invent A/B/C/D grade systems.
- Masa is volume-related in this legacy source context.
- Canonical DB values must be language-independent codes.
- UI localization labels are not canonical domain values.
