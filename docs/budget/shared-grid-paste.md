# Shared clipboard paste for budget grids

Annual Budget and Liquidity Forecast now use the same direct multi-cell paste
behavior as Cash Flow Budget. Pasting changes local drafts only. Save remains an
explicit action; Cancel restores the saved baseline. No database, RLS, business
formula, file-import, or dependency changes were made for this task.

## Shared architecture and Cash Flow reuse

`src/lib/grid/clipboard.ts` remains the single TSV parser, numeric normalizer,
whole-matrix validator, bounds checker, and matrix application implementation.
The new `src/lib/grid/paste.ts` composes those existing functions and supplies:

- Numeric field policies: maximum value, precision, and permitted sign.
- Explicit editable-field-key mapping to and from the draft matrix.
- Native single-value paste versus intercepted tab/newline block paste.
- Atomic validation, clipping counts, and localized feedback.
- Enter navigation to the same editable column in the next month.

All three editors call `handleGridPaste`; none has its own parser or matrix
application algorithm. Cash Flow's previously embedded handler was replaced with
this shared implementation, including its isolated January opening-balance input.
Tab and Shift+Tab remain native. Derived cells have no input or paste destination.

## Field order

Annual Budget uses `BUDGET_INPUTS`, in this exact order:

1. `sales_amount`
2. `raw_material_cost`
3. `energy_cost`
4. `labor_cost`
5. `maintenance_repairs_cost`
6. `transportation_logistics_cost`
7. `administration_sales_cost`
8. `waste_environmental_cost`
9. `production_m3`

The ninth pasted column reaches Production m³ even though Total Costs appears
between it and the preceding editable column in the rendered table.

Liquidity uses `LIQUIDITY_INPUTS`, in this exact order:

1. `opening_balance`
2. `forecasted_sales`
3. `other_forecasted_income`
4. `total_outflows`

Total Inflows, Net Cash Flow, Closing Balance, Minimum Required Balance, and Sales Needed are skipped.
Offsets refer to these field lists, not DOM column indices.

## Values, validation, and recalculation

Ordinary spaces, NBSP and narrow NBSP thousands grouping, decimal comma/dot,
and the existing optional euro formatting use the same normalizer. Mixed decimal
separators, malformed grouping, non-numeric text, excessive precision, disallowed
negative values, and values at or above the existing limit are rejected.
Currency fields allow two decimal places; annual production retains six.
Negative opening balances remain permitted in Cash Flow and Liquidity.

Blank clipboard cells become empty draft strings and then canonical NULL on
submission; explicit `0` remains numeric zero. Derived arithmetic's existing
coalescing does not rewrite draft inputs.

Every source cell is validated before any draft mutation, including overflow.
An invalid block applies nothing and names the destination month and field, or
the source row/column for an overflow location without a destination. Valid
overflow is clipped to the remaining months and editable fields, with a warning.

Existing render-time calculations consume the updated drafts immediately:
annual costs, unit costs, profit and margin; liquidity inflows, net flow, closing
balance and Sales Needed; and the Cash Flow balance chain. Liquidity opening
balances stay independent. Sales Needed's formula is unchanged.

## Feedback and consistency

The existing FI/PL/EN `gridPaste.hint`, `dirty`, `invalid`, `sourceCell`, `success`,
and `overflow` keys are reused. No module-specific copies or new translation keys
were added. Successful pastes show the applied cell count. Changed values mark
the form dirty. Save and Cancel clear paste feedback; Cancel restores the baseline.
No confirmation or animation was introduced.

The remaining differences are intentional domain rules: Cash Flow has an isolated
January opening input and carries balances forward; Liquidity has independent
monthly openings; annual production allows six decimals. Clipboard parsing,
mapping, validation, clipping, feedback, and application behavior are shared.

## Verification

- Existing clipboard/Cash Flow suite: 10 passed.
- New shared-engine/Annual/Liquidity suite: 15 passed.
- Other budget suites: 42 passed, 2 opt-in database tests skipped, no failures.
- `pnpm lint`: passed.
- `pnpm exec tsc --noEmit --incremental false`: passed.
- `pnpm build`: failed because the sandbox denies Turbopack worker process/port
  creation (`Operation not permitted`). Reported for all three budget editors;
  no successful production build is claimed.
- `git diff --check`: passed.

Tests execute real component paste handlers with simulated clipboard events and
mocked persistence. They cover complete 12×9 annual / 12×4 liquidity blocks (after the formula update below), offsets, derived-column
skipping, immediate calculations, independent liquidity openings, production
precision, NULL/zero after submission, atomic errors including overflow, clipping,
dirty state, Save/Cancel, pending protection, native single-cell paste, Enter/Tab,
and FI/PL/EN feedback. The existing Cash Flow suite verifies its carry-forward and
isolated-opening behavior after the refactor.

Manual Excel-to-browser verification remains pending: this environment exposes no
browser automation tool and has no installed browser or cached Playwright browser.
Component tests are not claimed as a real browser clipboard test. The dashboard
and inventory reference files were inspected but are empty; existing shared UI
components, tokens, grid layouts, and Cash Flow feedback styling were retained.

## Files changed for this task

- `src/lib/grid/paste.ts` (new shared adapter; existing `clipboard.ts` reused unchanged)
- `src/components/budget/cash-flow-editor.tsx`
- `src/components/budget/annual-editor.tsx`
- `src/components/budget/liquidity-editor.tsx`
- `tests/budget/grid-paste.test.mjs`
- `docs/budget/shared-grid-paste.md`

No commit or push was performed.

## Follow-up: Minimum Required Balance formula

The user subsequently changed Liquidity Minimum Required Balance from a manual
input to `Total Outflows × 0.3`, rounded to cents. It now recalculates immediately
on editing or pasting outflows; Sales Needed uses that computed target. Missing
outflows coalesce to zero for derived arithmetic while the source stays NULL.
Monthly opening balances still remain independent.

Liquidity clipboard input now has four columns. The fifth, formerly manual
minimum-balance column is not an editable destination. The existing RPC still
requires `minimum_required_balance`, so the server form parser computes that
compatibility value from validated outflows. Browser-supplied targets and old
stored targets do not control calculations. Existing database rows are not
backfilled; no schema migration or live database operation was performed.

The formula is explained in FI/PL/EN through `liquidity.minimumBalanceFormula`.
The liquidity model/service/editor and their tests were updated. Formula,
rounding, obsolete target rejection, independent balances, four-column paste,
and live draft recalculation tests pass; lint and TypeScript pass.

## Follow-up: Cash Flow year rollover

Cash Flow opening balances are now read-only: the saved January 2025 value starts
an organization-scoped chain, and each later January comes from the preceding
December. The isolated editable January paste target described in the original
implementation above has been removed. The five cash-flow paste columns are
unchanged. See `cash-flow-year-rollover.md` for source handling and verification.
