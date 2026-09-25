# Inventory Domain Codes and Localization v1

Status: Confirmed decisions for Inventory v1 design phase
Date: 2026-09-25

## Principle

- Canonical database values use language-independent domain codes.
- Localized labels are presentation-only and must not be persisted as canonical codes.

## Quantity Unit Codes (minimum v1)

### LINEAR_METER

Meaning:
- linear/running meter quantity

Localized labels:
- pl: mb
- fi: jm
- en: rm

Legacy mapping:
- source Jednostka = mb maps to quantity_unit_code = LINEAR_METER

### PIECE

Meaning:
- discrete piece/unit count

Localized labels:
- pl: szt.
- fi: kpl
- en: pcs

## Example conversion

Source:
- Ilosc = 14
- Jednostka = mb

Canonical representation:
- quantity = 14
- quantity_unit_code = LINEAR_METER

## Stock movement unit rule

stock_movements entries must store canonical quantity_unit_code.

Examples:
- RECEIVE +14 LINEAR_METER
- CONSUME -3.5 LINEAR_METER
- RECEIVE +10 PIECE

Never store localized labels (mb, jm, rm, szt., kpl, pcs) as canonical DB values.
