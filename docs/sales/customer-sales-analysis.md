# Customer Sales Analysis — implementation report

## 1. Route and layout

`/sales/customers?year=2026&scenario=BUDGET` is now the customer management analysis view. The header identifies the selected organization. Shared year and scenario controls affect the entire analysis. Defaults are the current UTC year and BUDGET; the other supported scenarios are FORECAST and ACTUAL. Invalid or repeated year/scenario parameters are rejected server-side. The analysis currency is explicitly EUR; excluded currencies for the selected scenario are listed.

Desktop layout: header and filters → six KPIs → customer-share donut and monthly stacked bar side by side → full-width customer/month matrix → expandable customer master management. Charts stack below `xl`. The spreadsheet scrolls inside its own container, with a sticky customer column. Loading UI mirrors the page structure.

The existing customer manager remains the single CRUD implementation, with create/edit dialogs, master-name/code search, status changes and archive confirmation. Report failure leaves customer CRUD available; a failed master read does not hide a working analysis. An empty master still permits creating a customer.

## 2. KPI cards and formulas

All six use the same prepared dataset:

| KPI | Definition |
| --- | --- |
| Total Sales | Sum of recorded customer/month revenue in the selected organization/year/scenario/EUR scope |
| Customers With Sales Facts | Distinct customer IDs with persisted facts in that scope; customer-master-only rows are excluded |
| Largest Customer | Highest annual customer revenue; ties use a stable ID order |
| Largest Customer Share | Largest revenue / total revenue × 100 |
| Top 3 Customer Share | Sum of the three highest annual customer totals / total revenue × 100 |
| Average Monthly Sales | Annual total / 12, including months with no facts in the denominator |

The supplied definition allows a non-null recorded sale: an explicit zero fact therefore counts as a customer with facts. The UI explains this distinction; an unsold master record does not count. Archived customers with historical sales remain represented. Zero/nonpositive total revenue has no percentage; no facts has an unavailable annual amount, while recorded zero remains zero.

Money aggregation uses integer cents with safe-range checks. Average monthly sales is divided by 12 before display rounding. Values are never seeded from the provided examples.

## 3. Donut

Up to six customers: all are represented. More than six: the five highest annual totals and Others. Others sums the remaining customers exactly in cents. Center value is the same annual Sales total as the cards/table. Business names remain unchanged. Signed revenue and zero-only data remain in the exact amounts list; the donut is disabled when it cannot accurately represent that distribution.

`src/lib/sales/customer-share.ts` now owns the shared ranking, grouping and link construction. `src/components/sales/customer-sales-share.tsx` owns the shared donut. The main management dashboard imports this same implementation through its existing chart export; it no longer has a separate Top 5/Others calculation.

## 4. Monthly chart

The stacked bar uses January–December with at most six series: the same five largest annual customer IDs throughout the year, plus Others. With fewer than six customers there are only the available series. With exactly six, the donut shows all six by name and the monthly chart represents the sixth as Others, as specified. Series are never re-ranked month by month. Missing values remain null; recorded zero remains zero. Negative values use signed stacks. Localized tooltips show month, customer and EUR revenue; exact data also appears in the accessible matrix.

Recharts is reused from the existing dashboard dependency; no new dependency was installed. Colors reuse existing semantic customer chart tokens.

## 5. Matrix, search, sorting and expansion

Columns: Customer, twelve full month names, Annual Total, Share. Initial order is annual revenue descending. Users can sort customer name, total or share in either direction. Search is case-insensitive and affects only the matrix; it never changes the management cards, chart totals, rankings or percentage denominator.

No fact in a month displays `—`; a persisted zero displays localized zero EUR. Annual values aggregate actual facts. The matrix is derived on demand, never persisted separately.

The `+` link opens one customer's product rows and `−` closes them. Expansion is URL-backed via `expand=<customerId>`, keeps year/scenario, and has prefetch disabled so product reports are requested only when opened. Child rows contain twelve monthly amounts and an annual total. The share column describes customer share in annual sales and is left blank on product rows. Product-load failure is localized inside the expanded row without removing customer totals or CRUD.

## 6. Customer/product identities and drill-down

Customer grouping always uses persisted `sales_facts.customer_id`, with names from the customer master. Labels such as “Pihla OAK” and “Pihla Birch” are never parsed into new customers. `source_label_raw` remains stored and untouched for provenance.

Product expansion uses `sales_facts.product_id` and the canonical product name from existing reporting. Variant facts aggregate into their canonical product; the implementation does not invent a link to commercial customer-product terms.

Customer slice/name links go to `/sales/customers/ID?year=Y&scenario=S`. Others goes to the selected customer overview. Product rows link to `/sales/products/ID?year=Y&scenario=S`. Customer and product detail reports now honor the selected scenario and EUR scope and expose the shared filters. The organization stays in the authenticated global context. Organization switching retains validated year/scenario but removes old customer/product/expansion identifiers and returns customer detail to the customer overview.

## 7. Database aggregation and performance

The implementation reuses `sales_report(p_organization, p_year, p_customer, p_product)` through `getSalesReport`. PostgreSQL performs all fact aggregation; no raw `sales_facts` are sent to application presentation code or the browser.

The inspected existing report returns separate `totals`, `customers`, `months` and `products`; it does **not** return a bulk customer × month matrix. Its existing customer filter does return the necessary monthly aggregate. The service therefore performs one annual overview call and, for multiple scoped customers, one filtered call per customer. A zero/one-customer scope needs only the overview call. At most four detail RPC calls run concurrently. Only customers present in the selected scenario/EUR report trigger detail reads. Customer-master pagination is handled by the existing service.

Expanded product rows use the existing customer/product filters with the same concurrency bound. A request-local promise cache reuses already fetched customer reports. A one-product expansion can use that customer's monthly aggregate directly. No new RPC, schema change or migration is necessary for this implementation.

This is bounded fan-out, **not a single bulk query**: RPC count grows with customers (and with products only for an opened row). A future one-call bulk matrix optimization would require a separately authorized reporting migration; none was created here.

Because the existing RPC calls are separate database snapshots, the service checks annual customer sums, monthly customer sums and overview totals against one another. It refuses to display contradictory snapshots and asks for a refresh if values changed during loading. Expanded product totals are also checked against the parent customer before rendering.

## 8. DTO and authorization architecture

- `src/lib/sales/customer-analysis-service.ts`: admin authorization, globally selected organization, input validation, concurrent master/report loading, bounded aggregate reads, request-local report cache and lazy product expansion.
- `src/lib/sales/customer-analysis.ts`: deterministic scope selection, twelve-month DTOs, totals, percentages, monthly series, sorting, consistency checks, scoped detail reports and product DTOs.
- `src/lib/sales/customer-share.ts`: shared customer-share grouping used by this view and the main dashboard.
- Server page/view/filter components compose existing design components. Client components only handle charts and local table search/sorting. They receive prepared aggregates rather than raw facts.

System Admin without an explicitly selected organization performs no report/master reads. Organization Admin is restricted to its authenticated organization. URL organization identifiers do not control scope. Expansion IDs must occur in the authorized current customer dataset before any product-detail query runs. Existing RLS and authenticated Supabase clients are unchanged.

## 9. FI / PL / EN and changed files

Typed `customerAnalysis.*` translations are incorporated into global `tApp`. They cover labels, filters, six KPIs, charts, table headings, sort/search controls, missing/zero explanations, excluded currencies, states, row expansion, archive confirmation and loading. Existing scenario translations and deterministic `Intl` month/EUR/percentage formatting are reused. Customer, product and organization names remain business data.

Files added:

- `src/lib/sales/customer-analysis.ts`
- `src/lib/sales/customer-analysis-service.ts`
- `src/lib/sales/customer-share.ts`
- `src/lib/i18n/customer-analysis-ui.ts`
- `src/components/sales/customer-analysis-filters.tsx`
- `src/components/sales/customer-analysis-view.tsx`
- `src/components/sales/customer-analysis-table.tsx`
- `src/components/sales/customer-monthly-chart.tsx`
- `src/components/sales/customer-sales-share.tsx`
- `src/app/(authenticated)/sales/customers/loading.tsx`
- `tests/sales/customer-analysis.test.mjs`
- This report.

Existing files updated:

- Customer overview, customer detail and product detail pages.
- `src/components/sales/customers-manager.tsx` — preserve CRUD, shared components, search, localization and archive confirmation.
- `src/lib/i18n/app-ui.ts` — register translations.
- `src/lib/dashboard/model.ts` and `src/components/dashboard/charts.tsx` — reuse the shared customer grouping/donut.
- `src/components/ui/core.tsx` — correct shared `TableCell` props to support standard table-cell attributes such as `colSpan`.
- Organization switcher and its server action — preserve validated analysis filters across tenant switches.
- Existing empty-list and organization-switch tests; `tests/auth/load-module.mjs` now resolves `.tsx`/index modules for real component tests.

Pre-existing unrelated workspace changes were preserved. No new dependencies, mocks in production, migrations, database writes, commits or pushes.

## 10. Tests

Focused customer analysis suite: **32 tests**, covering all fourteen requested categories and additional cases:

- Canonical customer annual and all twelve monthly totals; exact cross-customer reconciliation.
- Largest/Top 3 shares, monthly average and zero/missing distinction.
- Top 5/Others cent-exact aggregation and <=6 behavior.
- Fixed annual monthly-stack membership with nullable and zero Others values.
- BUDGET/FORECAST/ACTUAL and EUR/non-EUR isolation.
- “Pihla OAK” and “Pihla Birch” group under their existing customer ID.
- Organization/year authorization, no-org/invalid filters and denied roles.
- Bounded RPC concurrency and one-customer optimization.
- Report/master/product failure isolation and snapshot-consistency checks.
- Customer/product links retain year/scenario.
- Lazy canonical product expansion and refusal to expand an out-of-scope customer.
- Actual shared UI/Recharts server rendering in FI/PL/EN, including empty, expanded and failed-expansion states.
- The supplied monthly amounts sum to **725,794.35 EUR**; the supplied customer examples round to **30.0%, 26.7%, 14.0%**. These values exist only in test fixtures.

Existing Sales, Dashboard and organization-context/switcher suites were also exercised. Main dashboard regression tests passed after sharing the donut implementation. Responsive server rendering is covered; no claim is made that this replaces browser viewport/hydration testing.

## 11. Verification

- `pnpm lint`: passed without warnings after cleanup.
- `pnpm exec tsc --noEmit --incremental false`: passed.
- `git diff --check`: passed.
- `node tests/sales/customer-analysis.test.mjs`: 32 passed, zero failures.
- Other focused suites: Sales annual-save 6, empty-lists 2, relationships 4; Dashboard 32; organization context 24; organization switcher 4 — all passed.
- `pnpm build`: initial run remained in compile for over six minutes and was interrupted. An expanded-permission `timeout 180s pnpm build` retry ran and failed with exit 1: Turbopack could not create/bind the loader subprocess port (`Operation not permitted`) while processing the existing Annual Budget, Cash Flow and Liquidity editor files. The first approval review for that retry timed out before execution; the permitted one-time retry was approved and ran. A successful production build is therefore not verified. No configuration was weakened to bypass the environment restriction.

No authenticated browser/manual desktop/tablet/mobile or live database verification was available in this environment. Target deployment must already contain the existing Sales reporting migration and tables; this task does not deploy them.

## 12. Product expansion scope

Canonical product-level expansion is implemented and needs no new database objects. Individual variant/customer-product-term rows are not inferred: the existing reporting interface groups products, and Sales facts do not record a direct customer-product-term identity. Product Master commercial terms must not be retroactively treated as historical Sales facts. That more granular commercial breakdown remains outside this implementation.
