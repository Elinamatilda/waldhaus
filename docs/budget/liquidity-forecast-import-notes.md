# Liquidity Forecast import readiness

Source worksheet: **Cost Control**. The Budget 2026 workbook contains three
independent tables on this sheet: Annual Budget, Cash Flow Budget, and Liquidity
Forecast (table #3 in the current workbook concept). Discover each structurally;
never dump the entire worksheet into a single dataset or rely on table position.

Required structural signature:
Month; Opening Balance (€); Forecasted Sales (€); Other Forecasted Income (€);
Total Inflows (€); Total Outflows (€); Net Cash Flow (€); Closing Balance (€);
Minimum Required Balance (€); Sales Needed (€).

Canonical source fields are opening_balance, forecasted_sales,
other_forecasted_income, total_outflows and minimum_required_balance.
Preserve genuinely blank cells as NULL and explicit zeros as 0 for every input.
Missing columns are mapping errors, not blank cells. Preserve raw source values
and cell coordinates for future import traceability. Malformed text must never
become zero or NULL silently. All amounts are EUR for this initial model.

Opening balance is optional and independent for every month. Do not carry January
closing into February opening. In the supplied examples, January forecasted sales
110074 and February 92063.81 independently produce the same monthly closing values
when other inputs are blank/zero. This is deliberately different from Cash Flow.

Total Inflows, Net Cash Flow, Closing Balance and Sales Needed in Excel are
validation references only. Recalculate from the canonical monthly inputs in
Waldhaus and compare; show discrepancies as warnings/errors in preview. Do not
persist Excel formulas or derived results as canonical values.

Sales Needed means TOTAL monthly sales required to reach minimum cash:
max(0, minimum - coalesce(opening,0) - coalesce(other income,0) + coalesce(outflows,0)).
All missing numeric operands coalesce to zero only for calculation. The optional
additional gap is max(0, total sales required - coalesce(forecasted sales,0)).
It is calculated by the model for future use but not stored or displayed as Sales Needed.

Future flow: detect table → map organization/year and twelve months → preview
canonical values and calculated differences → confirm → one atomic save with
current versions. Invalid input or stale versions must cause zero partial writes.
No parsing, upload, preview workflow or import persistence was implemented yet.

Future source options may be MANUAL and SALES_FORECAST. Sales FORECAST facts might
populate forecasted_sales after scope/currency/timing are agreed. No source enum,
automatic synchronization or payment-term logic is implemented now. Cash Flow
Budget remains separate and is neither copied nor synchronized automatically.
