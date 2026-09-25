# Waldhaus Sales Budget Source Mapping v1

Status: Design mapping draft
Date: 2026-09-25
Scope: Workbook-concept to canonical-domain mapping for sales planning module

## 1) Mapping rules

- Preserve source meaning without collapsing customer and product identity.
- Do not force Jan-Dec into columns in canonical schema.
- Annual totals are derived from monthly facts.
- Keep unresolved semantics explicit.

## 2) Vocabulary for this mapping

Classification values:
- CUSTOMER
- PRODUCT
- PRODUCT VARIANT
- QUALITY
- PERIOD
- SCENARIO
- QUANTITY
- VOLUME
- PRICE
- REVENUE
- COST
- MANAGEMENT COST CATEGORY
- STRATEGIC NOTE
- UNKNOWN / UNRESOLVED

Mapping status:
- DIRECT
- TRANSFORMED
- DERIVED
- UNRESOLVED

Confidence:
- CONFIRMED
- LIKELY
- UNRESOLVED

## 3) Sales budget sheet mapping

| SOURCE CONCEPT | CLASSIFICATION | CANONICAL DESTINATION | STATUS | CONFIDENCE | NOTES |
|---|---|---|---|---|---|
| Row label: Parkano | CUSTOMER | customers.name, sales_plan_entries.customer_id | TRANSFORMED | CONFIRMED | Customer identity candidate. |
| Row label: Pihla OAK | UNKNOWN / UNRESOLVED | source_label_raw + explicit customer/product mapping workflow | UNRESOLVED | UNRESOLVED | Must not become combined customer-product identity silently. |
| Row label: Pihla Eskola | UNKNOWN / UNRESOLVED | source_label_raw + explicit customer/account mapping workflow | UNRESOLVED | UNRESOLVED | Requires business confirmation of semantics. |
| Row label: Grado | CUSTOMER | customers.name, sales_plan_entries.customer_id | TRANSFORMED | CONFIRMED | Customer identity candidate. |
| Row label: Ulkomaat | UNKNOWN / UNRESOLVED | planning grouping dimension (future account type/channel) | UNRESOLVED | LIKELY | Likely channel/group, not legal customer. |
| Row label: Client X | UNKNOWN / UNRESOLVED | planning placeholder dimension | UNRESOLVED | LIKELY | Likely placeholder target. |
| Row label: New clients | UNKNOWN / UNRESOLVED | planning placeholder/strategic target dimension | UNRESOLVED | LIKELY | Aggregate target, not single customer. |
| Row label: Jalleenmyyja | UNKNOWN / UNRESOLVED | channel/group dimension | UNRESOLVED | LIKELY | Likely channel concept. |
| Row label: Uudet tuotteet | STRATEGIC NOTE | strategic planning target, not customer | TRANSFORMED | LIKELY | Product strategy target line. |
| Row label: Taysipuu | UNKNOWN / UNRESOLVED | strategic target or product-family target | UNRESOLVED | UNRESOLVED | Needs business definition. |
| January column | PERIOD | reporting period month=1 | TRANSFORMED | CONFIRMED | Month dimension row, not dedicated column. |
| February column | PERIOD | reporting period month=2 | TRANSFORMED | CONFIRMED | Same normalization rule. |
| March column | PERIOD | reporting period month=3 | TRANSFORMED | CONFIRMED | Same normalization rule. |
| April column | PERIOD | reporting period month=4 | TRANSFORMED | CONFIRMED | Same normalization rule. |
| May column | PERIOD | reporting period month=5 | TRANSFORMED | CONFIRMED | Same normalization rule. |
| June column | PERIOD | reporting period month=6 | TRANSFORMED | CONFIRMED | Same normalization rule. |
| July column | PERIOD | reporting period month=7 | TRANSFORMED | CONFIRMED | Same normalization rule. |
| August column | PERIOD | reporting period month=8 | TRANSFORMED | CONFIRMED | Same normalization rule. |
| September column | PERIOD | reporting period month=9 | TRANSFORMED | CONFIRMED | Same normalization rule. |
| October column | PERIOD | reporting period month=10 | TRANSFORMED | CONFIRMED | Same normalization rule. |
| November column | PERIOD | reporting period month=11 | TRANSFORMED | CONFIRMED | Same normalization rule. |
| December column | PERIOD | reporting period month=12 | TRANSFORMED | CONFIRMED | Same normalization rule. |
| Monthly value cell in sales budget | REVENUE | sales_plan_entries.revenue_amount, currency_code | DIRECT | CONFIRMED | Monetary plan fact. |
| Annual total column | REVENUE | yearly aggregate query over monthly facts | DERIVED | CONFIRMED | Do not persist as duplicate canonical fact. |
| Sheet identity: Sales budget 2026 | SCENARIO | scenario_code=BUDGET + year period scope | TRANSFORMED | CONFIRMED | Budget dataset context. |
| Sheet identity: Sales budget 2025 | SCENARIO | scenario_code=BUDGET + year period scope | TRANSFORMED | CONFIRMED | Budget dataset context. |
| Sheet identity: Sales budget 2024 | SCENARIO | scenario_code=BUDGET + year period scope | TRANSFORMED | CONFIRMED | Budget dataset context. |
| Sheet identity: Sales 2024 | SCENARIO | scenario_code=ACTUAL + year period scope | TRANSFORMED | LIKELY | Appears actual-style, final confirmation still required. |

## 4) Products sheet mapping

| SOURCE CONCEPT | CLASSIFICATION | CANONICAL DESTINATION | STATUS | CONFIDENCE | NOTES |
|---|---|---|---|---|---|
| Customer heading in Products sheet (for example Tahtiporras/Pihla/Parkano blocks) | CUSTOMER | customers.name and/or customer account mapping | TRANSFORMED | CONFIRMED | Customer context for product planning lines. |
| Product heading (for example Glueboards, Thresholds, listas, sawn planks) | PRODUCT | products.name, products.product_code | TRANSFORMED | CONFIRMED | Canonical product identity candidate. |
| Dimension tuple values (example 0.040 x 0.650 x 4.000) | PRODUCT VARIANT | product_variants dimensional fields | TRANSFORMED | LIKELY | Numeric dimension semantics appear strong but still source-validated. |
| pcs/month | QUANTITY | sales_plan_entries.quantity_value, quantity_unit_code=PIECE | DIRECT | CONFIRMED | Period quantity fact. |
| pcs/year | QUANTITY | yearly aggregate from monthly quantity OR stored import raw if monthly absent | DERIVED | LIKELY | Prefer derivation where monthly exists. |
| m3 monthly field | VOLUME | sales_plan_entries.volume_m3_value | DIRECT | LIKELY | Direct volume fact when source provides it. |
| m3/year field | VOLUME | yearly aggregate from monthly volume | DERIVED | LIKELY | Prefer derivation to avoid duplication. |
| price | PRICE | sales_plan_entries.unit_price_amount + pricing_basis_code | TRANSFORMED | LIKELY | Pricing basis may vary (per piece/per m3). |
| sales per month | REVENUE | sales_plan_entries.revenue_amount | DIRECT | CONFIRMED | Monetary monthly fact. |
| sales per year | REVENUE | yearly aggregate of revenue monthly facts | DERIVED | CONFIRMED | Prefer derived annual totals. |
| Product notes | STRATEGIC NOTE | note_text on planning line or product-relationship note | TRANSFORMED | LIKELY | Free-form explanatory metadata. |
| Quality labels if present in product lines | QUALITY | quality_code or quality_label_raw on variant/line | TRANSFORMED | UNRESOLVED | Placement depends on final business quality semantics. |

## 5) Scenario, quantity, volume, price, revenue interpretation

- Scenario is sheet/context-level metadata, not a separate yearly table.
- Quantity is physical count/measure independent from revenue.
- Volume is physical m3 independent from quantity/revenue (though often derivable).
- Price is a rate requiring pricing basis context.
- Revenue is monetary outcome fact for analytics.

## 6) Concepts currently out of scope in this v1 module

Cost-related concepts are intentionally not implemented in first sales module persistence:
- COST
- MANAGEMENT COST CATEGORY

These are deferred to later phase and are not part of immediate migration-ready sales scope.

## 7) Preservation policy

Any unresolved row-label semantics must preserve original source token via raw source label fields in import/staging context.

Do not silently remap:
- combined labels like Pihla OAK
- channel/group placeholders
- strategic aggregate labels

## 8) Blocking schema-affecting questions

- Is Pihla OAK a customer account subdivision under customer Pihla, or a source formatting shorthand combining customer+product?
- Are labels like Pihla Eskola legal/commercial accounts or sub-lines of one customer?
- Should quality be modeled on variant master, line fact, or both with controlled code set?
- Which product labels are true products vs higher-level families?

No SQL or migration is included in this mapping document.
