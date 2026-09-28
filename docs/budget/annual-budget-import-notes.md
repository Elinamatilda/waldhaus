# Annual Budget import readiness

The current implementation supports manual EUR-denominated annual operational
budgets only. Import Excel is disabled and explicitly labelled as upcoming.
No file upload, XLSX parsing, mapping, preview or import execution is implemented.

A future workbook may contain **multiple tables on the same sheet**. The future
Budget 2026 importer must identify the Annual Budget table semantically and
structurally: heading context, month labels, expected cost categories, production
units, and the table's boundaries. It must not blindly dump a whole sheet or
assume one sheet is one dataset. No workbook was supplied or inspected in this task.

Expected future workflow:

1. Select/upload workbook and detect candidate tables.
2. Ask for table/year/organization confirmation when ambiguous.
3. Map the nine canonical input columns and normalize month rows.
4. Validate numeric values, decimal conventions, units, currency, duplicates and
   missing months. Preserve original source references for traceability.
5. Show a preview of all proposed changes, existing versions and conflicts.
6. Confirm, then persist through the same authorized all-or-nothing annual-save
   boundary (or a reviewed extension with import provenance).

**Monthly values are the canonical source.** Workbook annual totals are validation
checks only. Never import an annual total as a thirteenth month, add it to monthly
values, or treat workbook-derived margins and cost rates as stored input.
Recalculate total costs, rates and margins using application formulas.

Blank manual inputs and genuinely blank workbook cells persist as NULL; explicit
zero persists as 0. NULL is a missing budget value, not a budgeted zero. The future
importer must preserve that distinction in preview and canonical values. A missing
or unmapped column is a validation error, not permission to overwrite an existing
value with NULL. Malformed numeric text must cause zero mutations. Derived
arithmetic may coalesce NULL to zero without modifying the source input.

The current table stores manual `sales_amount`; it has no customer/product
foreign keys and does not read/write `sales_facts`. A future source-selection
concept may be MANUAL / SALES_BUDGET / FORECAST / ACTUAL. No enum or source column
is added now. A future design must specify scenario, aggregation period, matching
currency, refresh/snapshot semantics and precedence of manual adjustments. It must
not silently sum scenarios, duplicate imported totals or convert currencies.

All current monetary inputs are explicitly EUR. A future non-EUR workbook needs
an approved currency model; do not relabel or convert its amounts as EUR.
