# Waldhaus Sales Ontology v1

Status: Design only
Date: 2026-09-25
Scope: Ontology and canonical concepts for Sales Planning / Commercial domain before Inventory implementation

## Purpose

Waldhaus needs shared, organization-level commercial planning data that multiple admins can edit concurrently.

Example behavior:
- Admin A updates March forecast for an account.
- Admin B sees the same update immediately.

This is tenant-shared business data, not user-private notes.

## Access model context

- system_admin: cross-organization full access
- admin: full commercial access within own organization
- employee: no commercial-management access in v1

## Ontology matrix

| ENTITY | DEFINITION | EXAMPLE | RELATIONSHIPS | SOURCE WORKBOOK CONCEPT | FUTURE USE |
|---|---|---|---|---|---|
| Organization | Waldhaus tenant/company boundary for all records | Waldhaus main company | Owns customers, accounts, products, plans, entries, prices, actuals | Workbook file context | RLS ownership, cross-org isolation |
| Customer | External commercial entity | Pihla, Parkano, Grado | Organization 1-N customers; customer can have many accounts and customer products | Sales budget row labels (in part), Products customer headings | Sales analytics, order linkage, concentration analysis |
| Customer Account (recommended) | Commercial subdivision preserved from source labels when customer hierarchy is ambiguous | Pihla OAK, Pihla Eskola | Customer 1-N customer_accounts (or account standalone until customer resolved) | Sales budget rows that may be sub-accounts | Preserves source fidelity, avoids premature merge |
| Product | Canonical sellable product family | Threshold, Glueboard, Sawn plank | Organization 1-N products; product 1-N variants | Products sheet product headings/groups | Product portfolio, demand planning |
| Product Variant | Specification-level variant distinguished by dimensions/specification | Threshold 170x3000, plank 27x100x850 | Product 1-N variants; may be linked to customer product terms | Products dimensional rows | Demand-volume math, inventory bridge |
| Customer Product | Commercial relationship between customer/account and product/variant | Pihla account sells threshold variants | Customer/account N-M product_variants, with planning/pricing terms | Products sheet customer-specific lines | Customer-specific assortment and pricing |
| Sales Plan | Header/container for planning scenario and period scope | Budget 2026 (org scope) | Organization 1-N plans; plan 1-N entries | Sales budget 2024/2025/2026 sheets | Versioning and governance |
| Sales Plan Entry | Period-level planned facts for amount and optional quantity/volume | 2026-03 Pihla OAK 39000 EUR | Belongs to plan and period, references account, optional product variant | Monthly columns Jan-Dec | Dashboard metrics, trend and variance |
| Actual Sale | Realized sales facts by period and account/product | 2024-03 actual for Parkano | Scenario-compatible with sales facts or dedicated actual source mapped into same fact model | Sales 2024 sheet | Actual vs budget/forecast analysis |
| Price | Monetary rate with basis for customer-product context | 10.44 EUR per piece, 2225 EUR per m3 | Linked to customer product or directly on plan entry with effective period | Products price columns | Revenue simulation, margin baselines |
| Quantity | Planned or actual amount of units | 25 pcs/month | Stored in plan entries or product planning facts | pcs/month, pcs/year | Capacity and production demand |
| Volume | Physical m3 derived or provided | 2.6 m3 monthly | Variant volume_per_unit and/or period fact volume | m3, m3/year, dimension math | Inventory/purchasing bridge |
| Currency | Monetary currency code for amount fields | EUR | On amount-bearing facts and price facts | Sales budgets in EUR | Future multicurrency readiness |
| Period | Canonical time unit at month grain | 2026-03 | Shared by plans, entries, prices, actuals | Jan-Dec columns + annual totals | Month/quarter/year reporting, YoY |

## Master vs planning vs actual vs derived

### Master data
- Organization
- Customer
- Customer Account
- Product
- Product Variant
- Customer Product
- Currency
- Period

### Planning data
- Sales Plan
- Sales Plan Entry
- Planning price inputs

### Actual transactional/commercial data
- Actual Sale (stored as actual scenario facts or mapped source rows)

### Derived analytics
- Annual totals
- Monthly totals
- Plan vs actual variance
- Customer concentration
- Planned m3 from quantity x unit-volume where applicable

## Modeling stance for source ambiguities

### Pihla OAK vs Pihla Eskola
Do not merge automatically.

Recommended interim rule:
- Preserve as customer accounts in source-facing model.
- Link to one customer only after business confirmation.

### Non-customer commercial labels
Potentially present concepts like channels/placeholders should not be forced into Customer.

Recommended:
- Account type classification on customer_account:
  - CUSTOMER_ACCOUNT
  - CHANNEL_GROUP
  - PLACEHOLDER
  - STRATEGIC_TARGET

## Workbook concept mapping overview

- Sales budget sheets -> Sales Plan + Sales Plan Entries (monthly amount facts)
- Sales actual sheet -> Actual Sale facts (or sales facts with scenario ACTUAL)
- Products sheet -> Product, Product Variant, Customer Product, plus quantity/volume/price plan facts
- Annual totals in workbook -> Derived from monthly entries (not canonical source of truth)

## Future chain compatibility requirement

Ontology must support this future demand chain:

sales plan -> product quantities -> production volume -> material requirements -> inventory -> purchasing

Therefore:
- product_variant identifiers must be stable
- quantity and volume must remain distinct from money
- period and organization keys must be first-class on all relevant facts

## Information architecture guidance (UI)

Commercial section should be localized in fi/pl/en and include:
- Sales Plan
- Customers
- Products
- Forecast

This is navigation projection, not database structure.

## Open semantic questions captured by ontology

- Are labels like Pihla OAK and Pihla Eskola separate customers or account subdivisions?
- Which workbook rows represent true customers vs channel/placeholder/strategic targets?
- Is ACTUAL data ingestion aligned to same monthly fact schema as BUDGET/FORECAST in v1 or staged import first?

No SQL is proposed in this ontology document.
