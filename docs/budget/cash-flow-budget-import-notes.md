# Cash Flow Budget import readiness

Import is disabled. No workbook parser, upload, staging or payment-term logic is implemented.
Multiple tables can exist on one Budget 2026 worksheet. Detect this table by its
header structure and month rows, never by blindly importing a sheet:

Month; Opening Balance (€); Sales Revenue (€); Other Income (€); Total Inflows (€);
Operating Costs (€); Investments (€); Loan Payments (€); Total Outflows (€); Closing Balance (€).

Canonical inputs are January opening_balance and twelve months of sales_revenue,
other_income, operating_costs, investments and loan_payments, in EUR. Cash flow
inputs preserve blank cells as NULL and explicit zeros as 0. Missing source
columns are mapping errors, not blank cells. January opening is required for a
complete manual budget; later openings are validation-only derived values.
Never silently turn malformed text into zero.

February–December source opening balances and all Excel Total Inflows, Total
Outflows and Closing Balance values are validation references only. Calculate the
chain in Waldhaus and warn about discrepancies, including later opening overrides.
Preserve source coordinates/raw values for traceability in the future import payload.
Monthly canonical source values win over workbook annual totals or formulas.

Future flow: identify table → preview twelve mapped months → compare calculated
values → confirm → persist through one atomic year RPC, with current versions.
No partial writes; a malformed cell or stale editor rejects the entire submission.
No importing until organization/year/currency and mapping are explicit.

Future integration may map Sales Budget / Annual Budget through payment terms and
cash timing into Cash Flow Budget. Revenue recognition and receipt timing, and
expense recognition and payment timing, are different concepts. No automatic
synchronization is implemented.
