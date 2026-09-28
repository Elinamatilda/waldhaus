# Cash Flow Budget clipboard paste

## Files

- `src/lib/grid/clipboard.ts`: reusable TSV parser, number normalization, atomic validation and immutable matrix application.
- `src/components/budget/cash-flow-editor.tsx`: focused-cell paste, local draft updates, feedback, dirty indicator and Enter navigation.
- `src/lib/i18n/app-ui.ts`: shared FI/PL/EN messages.
- `tests/budget/clipboard.test.mjs`: focused utility and editor tests.
- This report.

## Behavior

While editing, focus a cash-flow input and use Ctrl+V / Cmd+V. Tabs and line endings trigger grid paste; a single value retains native input paste behavior. CRLF and CR are normalized, and exactly one terminal spreadsheet newline is removed. Empty cells, including trailing tab-separated cells, remain empty. No CSV or XLSX parsing is involved.

The reusable helper has no cash-flow field names. It validates every source cell, including overflow, before returning a set of in-bounds writes. Applying those writes copies the matrix. A failed parse returns source and destination coordinates, never a partial write set.

Numbers accept comma or dot decimals, correctly grouped ordinary/nonbreaking/narrow nonbreaking spaces, surrounding whitespace and a surrounding euro symbol. Mixed separators such as `110,074.50`, malformed grouping, exponents and arbitrary text are rejected. Cash-flow validation additionally enforces the existing nonnegative, less-than-1e12 and at-most-two-decimal input contract; the opening balance allows negative values. Blank is stored as an empty draft string and parsed as null for flow fields; explicit zero remains numeric zero. Blank opening balance retains the existing invalid/incomplete form behavior.

The focused month and cash-flow field are the origin. Columns follow the five editable fields in order: Sales Revenue, Other Income, Operating Costs, Investments, Loan Payments. Derived columns are never paste destinations. Rows continue through December. The January opening balance is a separate 1×1 paste target: multi-cell overflow there is ignored with a warning and cannot affect flow fields.

An invalid cell prevents the entire paste and reports its localized month/field. Invalid overflow reports its source row/column. Valid overflow is ignored with a localized warning. Successful paste reports the applied cell count through the existing inline status pattern, without a confirmation dialog or extra clipboard permission. Enter focuses the same column next month and does not submit; native Tab/Shift+Tab remain intact.

Draft changes immediately rerun the existing cash-flow calculation, including downstream opening/closing balances and KPI values. The form displays an unsaved indicator when the draft differs from the saved baseline. Save uses the existing action; Cancel restores the baseline. Paste never invokes a server action. Inputs and the handler are protected while saving.

## Localization

All three languages define `gridPaste.paste`, `gridPaste.data`, `gridPaste.invalid`, `gridPaste.overflow`, `gridPaste.success`, `gridPaste.dirty`, `gridPaste.hint`, and `gridPaste.sourceCell`. Month and field names reuse existing localization. The first two keys are available for future shared paste controls; this interaction uses a keyboard hint and inline feedback.

## Verification

- 10 focused tests passed via `node tests/budget/clipboard.test.mjs`.
- `pnpm test:budget` passed all 12 test-file workers, including the clipboard test file. Database integration tests remain opt-in; no live database testing was performed.
- `pnpm lint` passed.
- `pnpm exec tsc --noEmit --incremental false` passed.
- `pnpm build` could not complete: Turbopack failed to bind a local port (Operation not permitted), including a retry with requested elevated permissions. A fallback `pnpm exec next build --webpack` failed to parse the TypeScript `--showConfig` subprocess output. Automatic approval review for an elevated Webpack retry timed out, so that retry did not run. Production build verification remains outstanding; no successful build is claimed.

Tests exercise actual TypeScript utility/editor code with mocked React state and persistence. They cover 12×5 mapping, offsets, normalization, blank/zero submission, atomic invalid input (including overflow), clipping, isolated opening balance, immediate ending-balance calculation, dirty state, cancellation, save-only persistence, pending protection, native single-value paste, Enter and translations. Actual clipboard interaction with Excel/Google Sheets/LibreOffice in a browser has not been manually verified.

No database schema changes, migrations, dependencies, commit or push were made for this feature.
