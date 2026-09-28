# Final migration terminology cleanup — 2026-09-26

Only the requested exception messages changed. No migration was applied, committed or pushed. Complete final SQL files:

- `supabase/migrations/20260925230000_cash_flow_budget.sql`
- `supabase/migrations/20260926000000_liquidity_forecast.sql`

## Cash Flow Budget

Six changed lines (five distinct messages):

- `Invalid annual budget` → `Invalid Cash Flow Budget`
- `Missing budget input field` → `Missing Cash Flow Budget input field`
- `Budget changed; refresh before saving` → `Cash Flow Budget changed; refresh before saving`
- `Expected budget period no longer exists` → `Expected Cash Flow Budget period no longer exists`
- `Budget changed during save` → `Cash Flow Budget changed during save` (two branches)

Other generic validation errors without the word Budget were left unchanged, as were SQL object identifiers, comments and behavior. The existing review's verbatim SQL copy was synchronized.

## Liquidity Forecast

Exactly one line changed: `Missing budget input field` → `Missing liquidity forecast input field`. Everything else in the SQL is unchanged. The existing review's verbatim SQL copy was synchronized.

## Verification

A comparison against the pre-edit files, masking only `message='...'` literals, proved the remaining SQL byte-for-byte equal. Changed lines were counted: six for Cash Flow Budget, one for Liquidity Forecast. No schema, grants, validation conditions, locks, transactions or version logic were changed.

The application regression run executed 25 files: 145 tests passed, two opt-in database tests skipped, zero failures. Lint and TypeScript checks passed. `pnpm build` failed on the known environment restriction: Turbopack process creation/local port binding was denied. No disposable PostgreSQL runtime was available, so neither migration nor database integration validation was performed.

Final file SHA-256 values:

- `20260925230000_cash_flow_budget.sql`: `5a5f986bb8f5fc058bd8820d9ac9eda6f7389e78bcf40b63af2b844d43b070cb`
- `20260926000000_liquidity_forecast.sql`: `98dff66785effe2373860839ecafa11c9031a8b8ef13d646b5b6e2231805bf55`
