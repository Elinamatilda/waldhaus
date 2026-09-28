# Cash Flow Budget: balances across years

The saved January 2025 opening balance is the initial value. For each later year,
January opens with the preceding December's calculated closing balance. February
through December continue to open with the preceding month's closing balance.
Closing balance remains opening balance + total inflows − total outflows.

All opening balances are read-only in the Cash Flow editor, including the saved
2025 starting value. Clipboard mapping still covers the five cash-flow input fields;
it cannot change an opening balance. Liquidity Forecast retains its separate,
independent monthly opening inputs.

The data service reads organization-scoped history from 2025 through the selected
year with pagination. It recomputes each completed prior year's December balance
from source flows. Later stored January values are ignored when calculating the
chain, so corrections to earlier flows affect subsequent years on reload without
bulk database updates. The selected year's unsaved edits continue to recalculate
that year's monthly chain immediately.

Missing initial balance, missing prior year, or incomplete prior-year month set
blocks the dependent editor and shows a localized source-year message. No missing
year is silently treated as zero. Years before the 2025 start are not initialized.

Before saving, the server service reloads the source history and checks the
submitted opening against the derived value. A stale or forged opening produces
a conflict without issuing a write. The existing RPC still receives its required
January opening parameter, computed from server-loaded history. In 2025 this is
the original saved seed; later years retain compatibility snapshots that are not
authoritative for reads. Existing monthly optimistic-version checks remain intact.

No schema, RLS, historical migration, or live database changes are required or
performed by this change. No prior data was rewritten. The server source read and
existing save RPC are separate transactions: a concurrent earlier-year save after
the check can make the compatibility snapshot stale, but subsequent reads always
derive from current history. This change does not claim database-wide cross-year
transaction locking or enforce the new rule on direct legacy RPC callers.

Tests cover the 2025 seed, 2026/2027 carry-forward, earlier-year corrections,
negative/zero balances, missing source data, tenant-scoped paginated reads, lossless
versions, rejected opening overrides, and the read-only editor/clipboard behavior.
Actual Supabase operations and browser interaction are not exercised by these
mock-based tests.

Verification: 5 rollover/service tests and 42 related Cash Flow, clipboard, editor,
render, and shared-grid tests passed (47 total). Lint, TypeScript without incremental
cache, and diff whitespace checks passed. Production build and live browser/database
checks were not repeated; the last production build was blocked by sandbox worker
process/port restrictions.
