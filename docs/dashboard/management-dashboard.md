# Main Management Dashboard — implementation report

1. **Final layout.** `/dashboard?year=2026` renders a localized management header with the selected organization's business name and one shared year form, six KPI cards, and four charts. Desktop order: profitability / liquidity, then customer sales / monthly costs. No operational demo sections remain on this route.

2. **KPI components.** `ManagementDashboard`, `DashboardKpiGrid`, and `DashboardKpiCard` reuse the shared `MetricCard`. Cards show Budgeted Sales, Total Costs, Profit, Profit Margin, Year-end Cash, and the lowest Liquidity Gap with its month. Large amounts use localized compact notation; exact amounts remain in accessible text and the card title. Incomplete or unavailable sources are identified on affected cards. A nonnegative worst gap is shown as meeting the target only when all liquidity inputs are complete.

3. **Chart components.** `DashboardChartCard` reuses shared `Card` and `SectionHeader`. `ProfitabilityChart` uses grouped sales/cost bars and a margin line on a separate percentage axis. `LiquidityOutlookChart` uses closing and dashed minimum lines, plus a textual list of risk months. `CustomerSalesDonut` shows all customers up to six, otherwise the top five and Others. `MonthlyCostsChart` has one unstacked cost bar per month. Monthly charts provide expandable exact-value tables and accessible detail links; customer labels are links.

4. **Chart library.** Recharts **3.10.1** is the only new chart library. Rendering is isolated in a client component; the page, organization authorization, data loading and domain calculations stay server-side. Responsive containers have bounded heights and minimum width zero. Animations are disabled to avoid distracting redraws. References consulted: [ComposedChart](https://recharts.github.io/api/ComposedChart/) and [ResponsiveContainer](https://recharts.github.io/api/ResponsiveContainer/).

5. **KPI data sources.**

   | KPI | Exact source |
   | --- | --- |
   | Budgeted Sales | `annual_budget_periods.sales_amount`, through `loadAnnualBudget` |
   | Total Costs | The seven canonical cost inputs in `annual_budget_periods`, through `deriveBudget` |
   | Profit | Annual Budget sales less those costs |
   | Profit Margin | Annual Budget annual profit / annual sales |
   | Year-end Cash | `cash_flow_budget_periods`, through `loadCashFlowBudget`, `resolveCashFlowOpening` and `calculateCashFlow` |
   | Liquidity Gap | `liquidity_forecast_periods`, through `loadLiquidityForecast` and `deriveLiquidity` |

6. **Chart data sources.** Profitability and monthly costs share Annual Budget DTOs. Liquidity uses only Liquidity Forecast; Cash Flow balances are never mixed into this chart. Customer sales uses the existing database-aggregated `sales_report` RPC through `getSalesReport`, filtered to `BUDGET` and `EUR`. The RPC receives exactly the selected organization and year. No raw sales facts are fetched, and customer names remain untranslated business data.

7. **Formulas.** Money addition/subtraction uses integer cents; the dashboard reuses existing domain calculations.

   - Monthly cost = raw material + energy + labor + maintenance/repairs + transportation/logistics + administration/sales + waste/environmental costs. Annual costs sum these monthly costs.
   - Annual sales = sum of monthly sales. Annual profit = annual sales − annual costs. Margin = profit / sales × 100; zero or absent sales produce no percentage. The annual percentage is weighted by annual totals, not an average of monthly percentages.
   - Cash closing = opening + sales revenue + other income − operating costs − investments − loan payments. Every next opening equals the previous closing. January inherits the preceding December through the existing chain beginning at the saved January 2025 seed. Historical years are read only to resolve this prerequisite. The KPI is December closing, with no persistence of derived values. Missing seed/history yields an unavailable KPI and the prerequisite year.
   - Liquidity inflows = forecasted sales + other forecasted income. Net flow = inflows − outflows. Closing = that month's independent opening + net flow. Minimum = outflows × 30%, rounded to cents, following the user's earlier requirement and the current canonical domain model. Deprecated stored manual minimum values are ignored. Gap = closing − minimum. The lowest available monthly gap and its month are returned; ties use the earliest month.
   - Others = the cent-exact sum of every customer after the top five. All six customers are retained when there are six. Donut center = the `BUDGET/EUR` total from Sales reporting, not the Annual Budget total. Any difference of at least one cent is displayed explicitly. Negative revenues are preserved in the amounts list and disable the donut rather than silently misrepresenting the distribution. Zero totals likewise remain real zeros.

8. **Completeness.** Twelve ordered monthly slots are prepared. Annual completeness checks all nine canonical inputs, including production; Cash Flow checks all five monthly flow inputs and separately requires its resolved opening; Liquidity checks all four canonical inputs. NULL contributes to the missing count; explicit zero does not. Calculated previews may coalesce individual missing inputs, but wholly absent series/months remain unavailable/null in presentation. The UI shows `Incomplete Budget` and missing/expected counts on charts. A wholly blank saved dataset is an empty state. Read errors and missing budget schemas are isolated to the affected source; other sources still render. Sales reporting does not expose an expected-input completeness count, so none is invented. Cash completeness counts the selected year's input cells; historical carry-forward follows the existing domain's own checks.

9. **Organization/year.** `loadDashboardData` calls the existing request-scoped `requireBudgetContext`. System Admin requires an explicit selected organization; no first organization or cross-organization aggregate is used. Organization Admin uses its authorized own organization. Missing selection performs no data reads. Year must be a scalar accepted by the existing 2020–2100 validator; invalid years render the existing localized correction state. Four source reads run concurrently. Existing authenticated clients and RLS remain in force. Employee users are redirected to their existing Production route before management data loads; the management navigation item is restricted accordingly. Dashboard organization switching preserves only its validated year and discards entity-specific query state.

10. **Drill-down.** Profitability/cost month clicks and table links use `/budget/annual?year=Y&month=M`; liquidity uses `/budget/liquidity?year=Y&month=M`; customer slices and labels use `/sales/customers/ID?year=Y`; Others uses `/sales/customers?year=Y`. Organization remains in the established global cookie, not an untrusted URL parameter. Destination budget pages receive the month parameter; this task does not add a new month-filtering mode to the existing full-year editors.

11. **Responsive behavior.** KPIs use one column at narrow widths, two at `sm`, three at `lg`, and six at `xl`. Charts stack below `xl` and use two columns at `xl`. All chart/card grid children have `min-w-0`; charts use full container width and a fixed `h-80` height. Expanded data tables scroll inside their card. Text labels, different line styles, signs, tooltips, textual risk months and accessible links supplement chart colors. New chart colors are semantic aliases of existing Waldhaus tokens, with red reserved for liquidity risk. A localized loading skeleton mirrors the final layout.

12. **I18n keys.** Global `tApp` now incorporates the typed FI/PL/EN `dashboardMessages` catalog. Added `dashboard.*` keys: `title`, `sales`, `costs`, `profit`, `margin`, `cash`, `gap`, `profitability`, `liquidity`, `customers`, `monthlyCosts`, `incomplete`, `missing`, `empty`, `unavailable`, `error`, `others`, `details`, `month`, `above`, `preview`, `risk`, `closing`, `minimum`, `difference`, `salesSource`, `cashPrerequisite`, `donutUnavailable`, `annualSource`, `liquiditySource`, `cashSource`, `notAvailable`, `loading`. Existing year and organization messages are reused. Month names and EUR/percentage formats use deterministic locale-specific `Intl` formatting with UTC month dates.

13. **Files changed for this task.**

   - `src/app/(authenticated)/dashboard/page.tsx` — replace mock dashboard with authenticated server page.
   - `src/app/(authenticated)/dashboard/loading.tsx` — localized loading skeleton.
   - `src/components/dashboard/management-dashboard.tsx` — server composition, shared KPI/chart cards and source states.
   - `src/components/dashboard/charts.tsx` — four client charts and accessible detail links.
   - `src/lib/dashboard/{service,model,format}.ts` — authorized parallel reads, prepared DTOs/calculations, deterministic formatting.
   - `src/lib/i18n/dashboard-ui.ts` and `src/lib/i18n/app-ui.ts` — typed global translations.
   - `src/app/globals.css` — semantic chart tokens.
   - `src/components/navigation/nav-config.ts` — management dashboard visibility.
   - `src/components/layout/organization-switcher.tsx` and `src/app/actions/organization-context.ts` — retain validated dashboard year across organization changes.
   - `tests/dashboard/dashboard.test.mjs` — focused calculations, isolation, scoping and rendering tests.
   - `tests/auth/{organization-context,organization-switcher}.test.mjs` — validated-year retention and updated search-parameter test context.
   - `package.json`, `pnpm-lock.yaml` — chart dependency and dashboard test command.
   - This report.

   Other pre-existing uncommitted workspace changes were preserved.

14. **New dependency.** `recharts: ^3.10.1` plus its lockfile-resolved transitive dependencies. No additional chart library, database dependency or browser-test package was added.

15. **Old mock content.** Removed all dashboard imports/rendering of mock production, purchasing, employee work, inventory, KPI and shift data. `src/lib/mock/dashboard` remains used by the separate pre-existing Production screen; the management dashboard does not import it or use fallback business figures.

16. **Tests added and run.** Direct execution `node tests/dashboard/dashboard.test.mjs`: **32 passed, zero failures**. Coverage includes all 23 requested categories: source organization/year arguments, no selected organization, authorization rejection, KPI math, 2025 rollover and monthly cash chain, independent liquidity, worst gap, scenario/currency isolation, top-five/Others, <=6 customers, all four missing sources, rejected reads, NULL/zero, completeness, parallel reads, exact links, independent totals, and FI/PL/EN rendering using real Recharts and shared UI. Responsive rendering checks cover server rendering and layout classes, not browser pixel measurements. Existing Budget and Auth test files were also run directly: no failures; two database concurrency integration cases skipped because their test environment was not configured. Updated organization-context tests: **20 passed**; switcher tests: **3 passed**.

17. **Lint.** `pnpm lint`: passed.

18. **Typecheck.** `pnpm exec tsc --noEmit`: passed. `git diff --check`: passed.

19. **Build.** `pnpm build` attempted normally and with expanded execution permissions. Both stop because Turbopack cannot create the loader subprocess / bind its required port (`Operation not permitted`). The normal attempt additionally failed the existing Google Inter font download; that font error did not recur in the expanded-permission attempt. A successful production build is therefore **not verified**. No configuration was weakened to bypass these errors.

20. **Remaining prerequisites and verification limits.** Existing Annual Budget, Cash Flow, Liquidity and Sales reporting migrations must already be deployed in the target environment; no live schema/deployment check or database writes were performed by this task. Required schemas are the existing annual/cash/liquidity budget tables and the existing Sales `sales_report` RPC. Missing sources have their own UI states. The environment has no browser/browser automation tool and blocks Turbopack subprocess networking: manual desktop/tablet/mobile checks, authenticated live organization/year switching, hard refresh, back/forward and client hydration remain unverified. FI/PL/EN server rendering and scope behavior are covered by automated tests. The reference dashboard/inventory files were inspected but are empty, so existing shared components/tokens guide the implementation. No migrations, RLS changes, commits or pushes were made.
