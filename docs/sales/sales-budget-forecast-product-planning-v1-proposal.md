# Waldhaus Sales Planning / Commercial Domain v1 Proposal

Status: Design only
Date: 2026-09-25
Scope: First operational business-data module before Inventory

## 1) Authoritative semantic correction

Confirmed meaning:
- Pihla is a CUSTOMER.
- Oak is a PRODUCT.

Canonical rule:
- Never model customer-product as one identity key (for example PIHLA_OAK).
- Customer and product must remain separate dimensions.
- Their intersection belongs in sales/planning fact rows.

If customer-specific sellable configuration exists:
- customer = Pihla
- product = Oak
- variant = customer-specific configuration (optional)

## 2) v1 scope

Include now:
- customer master
- product master
- product variant model
- period-based sales planning facts
- shared multi-admin editing model
- audit metadata (created_by, updated_by, created_at, updated_at)

Defer from this module version:
- cost control persistence
- cash-flow persistence
- inventory and production execution

## 3) Core model principles

- All domain records are organization-scoped.
- Money, quantity, and volume are separate measures.
- Period model is normalized monthly rows, not Jan-Dec columns.
- Annual totals are derived from monthly facts.
- Scenario model is forward-ready but not overbuilt.

## 4) Scenario and period model

Scenario code model:
- BUDGET (required now)
- FORECAST (supported by schema design)
- ACTUAL (supported by schema design)

Period model:
- monthly grain using period_start (YYYY-MM-01)
- optional reporting period dimension for month/quarter/year rollups

This supports later budget vs forecast vs actual variance.

## 5) Customer model

Recommended `customers` fields:
- id
- organization_id
- customer_code
- name
- legal_name nullable
- country_code nullable
- default_currency_code nullable
- is_active
- created_by nullable
- updated_by nullable
- created_at
- updated_at

## 6) Product model

Recommended `products` fields:
- id
- organization_id
- product_code
- name
- product_family_code nullable
- is_active
- created_by nullable
- updated_by nullable
- created_at
- updated_at

Important:
- Product is not customer-bound identity.
- Product analytics must aggregate across customers.

## 7) Product variant and quality model

Recommended `product_variants` role:
- represent sellable/plannable specification-level configuration

Conceptual fields:
- id
- organization_id
- product_id (required)
- variant_code
- variant_name
- customer_id nullable (only when variant is genuinely customer-exclusive)
- quality_code nullable
- quality_label_raw nullable
- thickness_mm nullable
- width_mm nullable
- depth_mm nullable
- length_mm nullable
- volume_per_unit_m3 nullable
- default_quantity_unit_code
- is_active
- created_by nullable
- updated_by nullable
- created_at
- updated_at

Quality concept:
- quality is separate from product identity
- quality may be variant attribute or line attribute
- do not automatically convert every quality into a separate product

## 8) Fact intersection model

Recommended `sales_plan_entries` conceptual shape:
- id
- organization_id
- scenario_code
- period_start
- customer_id
- product_id
- product_variant_id nullable
- quantity_value nullable
- quantity_unit_code nullable
- volume_m3_value nullable
- unit_price_amount nullable
- pricing_basis_code nullable
- revenue_amount
- currency_code
- source_label_raw nullable
- created_by nullable
- updated_by nullable
- created_at
- updated_at

Why this is required:
- customer, product, variant, quantity, volume, price, and revenue stay independently analyzable
- supports customer-level lines and detailed product-level lines in one model

## 9) Pricing basis model

Minimum basis codes:
- PER_PIECE
- PER_M3

Future-ready:
- PER_LINEAR_METER
- PER_M2

Currency:
- keep currency_code on monetary facts
- EUR can be default organization currency, not hardcoded as only possible currency

## 10) Relationship diagram

organizations
  |
  +-- customers
  |
  +-- products
  |     |
  |     +-- product_variants
  |
  +-- sales_plan_entries
        |
        +-- customer_id ------> customers
        +-- product_id -------> products
        +-- product_variant_id -> product_variants (optional)

Future extension uses same dimensional pattern:
- actual_sales_entries
- forecast_entries

## 11) Source handling stance for labels

Rows such as Pihla OAK / Pihla Eskola must not be blindly merged into product or customer.

Recommended source-preserving approach:
- keep source_label_raw on imported staging/mapping context
- map explicitly to:
  - customer_id (Pihla)
  - product_id (Oak)
  - optional variant/quality when known

No silent information loss.

## 12) Analytics this model enables

Customer direction:
- total sales by customer
- monthly and annual customer curves
- sales by product within customer
- sales by variant/quality within customer
- customer volume and average unit price

Product direction:
- total sales by product
- sales by customer within product
- variant/quality mix per product
- product volume and average price

Cross-dimensional:
- top customers
- concentration analysis
- seasonality and unusual demand months

## 13) UI projection rule

Spreadsheet-like UI is a projection only:
- rows: customers (and optional product drilldown)
- columns: Jan-Dec + annual total

Database remains normalized monthly fact rows.

## 14) Historical import shape (future)

Planned mapping:
- Sales budget 2024 -> scenario BUDGET
- Sales 2024 -> scenario ACTUAL
- Sales budget 2025 -> scenario BUDGET
- Sales budget 2026 -> scenario BUDGET

If multiple 2026 totals represent different perspectives:
- preserve as distinct scenario/context records once meaning is confirmed

## 15) RLS ownership pattern (future)

- READ: system_admin OR organization member
- ADMIN WRITE: system_admin OR organization admin
- EMPLOYEE: no commercial management write in v1

## 16) Localization strategy

Canonical database values:
- language-independent codes (scenario, units, pricing basis, quality code)

Localized UI labels:
- fi/pl/en via localization resources

Business names:
- customer and product names are business data, not auto-translated labels

## 17) Key migration-blocking decisions

Blocking:
- confirm whether source labels like Pihla OAK and Pihla Eskola are customer subdivisions, separate commercial accounts, or mixed label artifacts
- confirm quality semantics: variant attribute vs separate planning dimension when variant is absent
- confirm which source product labels are canonical products vs families

Important but non-blocking:
- future pricing bases beyond PER_PIECE and PER_M3
- mixed-currency conversion policy

Can defer:
- advanced forecast version lifecycle
- margin allocation rules depending on later cost/inventory integration

No SQL or migration is included in this proposal.
