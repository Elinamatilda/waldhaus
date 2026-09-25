# Waldhaus Inventory v1 Domain Model Proposal (Revised Minimal)

Status: Design only
Date: 2026-09-25
Scope: Revised minimal operational Inventory v1 before any SQL migration work

## 1) Decisions applied in this revision

- Keep canonical operational schema minimal.
- Do not promote legacy-import-only structures into first-class operational columns.
- Preserve all legacy source values losslessly in inventory_legacy_records.legacy_payload.
- Include append-style stock ledger in first operational implementation.
- Support movement types: RECEIVE, CONSUME, ADJUST, TRANSFER.
- Do not add RESERVE/RELEASE yet.
- Confirmed business decision: legacy unit mb means linear/running meter and maps to canonical unit code LINEAR_METER.
- Keep dimensional source-unit question open for Grubosc, Szerokosc, Dlugosc.
- No SQL in this phase.

## 2) Recommended minimal Inventory v1 model

Recommended v1 tables:
- materials
- storage_locations
- material_lots
- stock_movements
- inventory_legacy_records

### Why this is minimal and stable

- materials defines canonical material identity and controlled codes.
- storage_locations provides normalized location references for operations.
- material_lots provides lot identity and attributes that are genuinely operational.
- stock_movements is the authoritative stock ledger.
- inventory_legacy_records guarantees lossless source preservation without overloading operational tables.

## 3) Table-by-table proposal

### Table: materials

Purpose:
- Canonical material identity per organization.

Fields:
- id, uuid, pk
- organization_id, uuid, fk organizations.id, not null
- material_code, text, nullable
- species_code, text, nullable
- species_label_raw, text, nullable
- material_type_code, text, nullable
- material_type_label_raw, text, nullable
- description_text, text, nullable
- default_quantity_unit_code, text, nullable
- is_active, boolean, not null, default true
- created_by, uuid, nullable
- updated_by, uuid, nullable
- created_at, timestamptz, not null
- updated_at, timestamptz, not null

Notes:
- Canonical codes are language-independent values.
- Raw label fields preserve source vocabulary where mapping confidence is incomplete.

### Table: storage_locations

Purpose:
- Minimal normalized location catalog.

Fields:
- id, uuid, pk
- organization_id, uuid, fk organizations.id, not null
- location_code, text, not null
- location_name, text, nullable
- parent_location_id, uuid, self-fk nullable
- location_kind, text, nullable
- legacy_label_raw, text, nullable
- is_active, boolean, not null, default true
- created_by, uuid, nullable
- updated_by, uuid, nullable
- created_at, timestamptz, not null
- updated_at, timestamptz, not null

### Table: material_lots

Purpose:
- Lot/batch identity and operational attributes.
- Not the authoritative mutable balance source.

Fields:
- id, uuid, pk
- organization_id, uuid, fk organizations.id, not null
- material_id, uuid, fk materials.id, nullable (for partially mapped legacy imports)
- lot_code, text, nullable
- quality_code, text, nullable
- quality_label_raw, text, nullable
- storage_location_id, uuid, fk storage_locations.id, nullable
- location_raw_text, text, nullable
- volume_m3, numeric(18,6), nullable
- volume_source, text, nullable (CALCULATED, DECLARED, IMPORTED)
- pefc_status_code, text, nullable
- pefc_reference_text, text, nullable
- description_text, text, nullable
- notes_text, text, nullable
- legacy_record_number, text, nullable
- legacy_old_number, text, nullable
- archived_at, timestamptz, nullable
- created_by, uuid, nullable
- updated_by, uuid, nullable
- created_at, timestamptz, not null
- updated_at, timestamptz, not null

Important exclusions from first-class columns in revised v1:
- legacy_measurement_a
- legacy_measurement_b
- legacy_measurement_c
- legacy range-only representations
- legacy raw dimension text representations
- legacy_usage_date
- volume_formula_context

These remain in inventory_legacy_records.legacy_payload.

### Table: stock_movements

Purpose:
- Append-only operational ledger from which current stock is derived.

Fields:
- id, uuid, pk
- organization_id, uuid, fk organizations.id, not null
- material_lot_id, uuid, fk material_lots.id, not null
- movement_type, text, not null, one of RECEIVE, CONSUME, ADJUST, TRANSFER
- quantity_delta, numeric(18,6), not null
- quantity_unit_code, text, not null
- occurred_at, timestamptz, not null
- source_location_id, uuid, fk storage_locations.id, nullable
- target_location_id, uuid, fk storage_locations.id, nullable
- reference_type, text, nullable
- reference_id, text, nullable
- notes_text, text, nullable
- legacy_record_id, uuid, fk inventory_legacy_records.id, nullable
- created_by, uuid, nullable
- created_at, timestamptz, not null

Rules:
- RECEIVE is positive quantity_delta.
- CONSUME is negative quantity_delta.
- ADJUST can be positive or negative.
- TRANSFER does not change total stock, but tracks source and target location context.
- quantity_unit_code must be preserved per movement and must be canonical domain code.

### Table: inventory_legacy_records

Purpose:
- Full-fidelity source archive and mapping traceability.

Fields:
- id, uuid, pk
- organization_id, uuid, fk organizations.id, not null
- source_name, text, not null
- source_row_key, text, nullable
- imported_at, timestamptz, not null
- imported_by, uuid, nullable
- mapped_material_lot_id, uuid, fk material_lots.id, nullable
- mapping_status, text, not null (MAPPED, PARTIAL, UNRESOLVED)
- legacy_payload, jsonb, not null

Design intent:
- Any unresolved legacy semantics remain recoverable here.
- Operational schema stays clean and stable.

## 4) Relationship diagram

organizations
  |
  +-- materials
  |     |
  |     +-- material_lots
  |             |
  |             +-- stock_movements
  |
  +-- storage_locations
  |     |
  |     +-- material_lots
  |     +-- stock_movements (source_location_id, target_location_id)
  |
  +-- inventory_legacy_records
        |
        +-- optional mapped_material_lot_id -> material_lots
        +-- optional referenced by stock_movements.legacy_record_id

## 5) Stock derivation principle

Authoritative stock state is derived from stock_movements, not from manually edited lot quantity fields.

Conceptual derivation:
- current_quantity_by_lot_unit = sum(quantity_delta) grouped by material_lot_id and quantity_unit_code

Implications:
- audit trail is preserved
- corrections are explicit via ADJUST entries
- transfer traceability is explicit

## 6) Canonical unit and localization decision (confirmed)

Confirmed:
- legacy mb maps to canonical domain code LINEAR_METER

Canonical code:
- LINEAR_METER

Localized labels:
- pl: mb
- fi: jm
- en: rm

Also required canonical unit:
- PIECE

Localized labels:
- pl: szt.
- fi: kpl
- en: pcs

Example semantics:
- Ilosc = 14
- Jednostka = mb

Means:
- quantity = 14
- unit = LINEAR_METER

Does not mean 14 pieces/boards.

Movement examples:
- RECEIVE +14 LINEAR_METER
- CONSUME -3.5 LINEAR_METER

Canonical DB value must store LINEAR_METER, not mb/jm/rm labels.

## 7) Legacy mapping impact in revised minimal model

Operationally mapped first-class fields remain only where needed for day-to-day use.

Legacy-heavy fields stay primarily in inventory_legacy_records.legacy_payload, including:
- A/B/C source fields
- mixed/range/raw dimension representations
- Data uzycia raw semantics
- year columns 2021/2022/2023/2024
- legacy formula/provenance details

## 8) Main business questions before migration

Remaining primary questions:
- Confirm source dimension units for Grubosc, Szerokosc, Dlugosc.
- Confirm any additional canonical unit codes beyond LINEAR_METER and PIECE required at go-live.

Now non-blocking because of payload preservation:
- Data uzycia semantics
- PEFC legacy representation
- 2021/2022/2023/2024 semantics

## 9) RLS ownership strategy (unchanged)

- Every row in inventory domain tables is organization-scoped.
- Org members: read access.
- Org admins: create/update/archive/import and movement posting.
- No cross-organization visibility.

## 10) Implementation boundary

This document is design-only.

No SQL has been created.
No migration has been created.
No remote schema changes have been applied.
