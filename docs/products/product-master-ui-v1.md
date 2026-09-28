# Product Master management UI — V1

The user confirmed that the Product Master migration had been run on 2026-09-28.
This removes the task's implementation prerequisite; it is not an independent
verification of live schema, grants, or RPC execution. No SQL was deployed here.

## Entry point and workflow

Use the existing **Sales → Products** (`/sales/products`) entry with an Admin or
System Admin account and a selected organization. No new sidebar or product
architecture was introduced.

- The list searches product name/code, shows variant counts including archived
  history, and preserves creation even when the list or search is empty.
- Add Product asks only for name, code and description. Successful creation returns
  the saved ID and navigates to `/sales/products/[productId]`.
- The existing product detail prioritizes variants and includes product editing.
  Existing Sales analysis remains in a secondary expandable section. Its data-fetch
  failure does not prevent Product Master management.
- Add Variant navigates to `/sales/products/[productId]/variants/[variantId]`.
  Variant detail presents general information, canonical specification, theoretical
  rectangular volume per piece, customer relationships and commercial terms.
- Add Customer binds an existing active customer to the current variant. Add Terms
  binds dated commercial terms to that relationship. Edit/archive retain IDs,
  history and optimistic version tokens. Archive requires confirmation.
- Species and construction lookup management remains inside the product detail.
  The migration did not seed those lookups; add the needed canonical codes and
  FI/PL/EN labels there before selecting them for a variant.

## Canonical services and constraints

Detail views consume `getProductMasterDefinition`; React does not join another
complete product model or calculate geometry. `loadProductLookups` supplies editing
choices. `getProductVariantCounts` pages through scoped variant IDs. The reverse
`getCustomerProductDefinitions` service uses the same complete definition and
returns only the requested customer's relationships. No customer-page redesign.

Mutations reuse existing product actions and `saveProductMasterAction` → authorized
Product Master service → `save_product_master`. No browser Supabase writes or RLS
changes. The existing RPC still enforces immutable identity/specifications after
references, tenant integrity, active-parent rules and nonoverlapping active terms.
Decimal editing reads now explicitly cast database decimal fields to text, including
reads used to archive records, preserving precision.

Lengths use `length_mm` only. Geometry remains a labeled theoretical value, not
consumption, yield or production. Free-text quality and source notes are retained.
The top-level product never gains species, dimensions, customer or price fields.

## Commercial lifecycle and Sales/Budget

No existing Quote/Offer domain was found in repository application code or
migrations. No OFFERED enum/status was added. Recommend separately reviewing
commercial lifecycle on effective-dated terms, distinct from active/archive state,
with future quote references if a Quote domain is introduced.

The UI explicitly labels demand as expected commercial demand, not orders or actual
sales. Current terms use the canonical read model's effective-date and active-parent
rules; historical/future terms remain visible separately. Commercial edits do not
populate Actuals, synchronize Budget or rewrite historical Sales snapshots. Existing
Sales quantity/pricing restrictions remain in effect. Orders, BOM, inventory and
imports are outside this implementation.

## Shared UI and verification

FI/PL/EN labels, shared inputs, tables, badges and forms are used throughout. The
shared Dialog uses native modal focus containment, Escape, restored opener focus
and scrolling for long forms. Mutation forms use transitions, disabled fieldsets,
localized pending/error feedback and returned IDs for navigation.

Validation covers canonical nested form fields/parent IDs, retained edit versions,
archive confirmation, product creation response, locale rendering, exact geometry,
current versus historical terms, zero prices, reverse customer filtering, paginated
counts and authorization before database access. Product, Sales, auth and Budget
suite commands passed. Browser interaction and authenticated live writes were not
tested in this environment.

Manual acceptance after deploying the application:

1. Select the organization as Admin/System Admin and open `/sales/products`.
2. Create a product with name/code/description; verify navigation to its detail.
3. In specification lookups, add any missing real species/construction records.
4. Add a variant using those lookup IDs and thickness/width/length in mm; verify
   its detail and theoretical per-piece volume.
5. Add an existing customer, then dated terms with demand unit/period/year and
   price basis/currency; verify the current terms and history sections.
6. Edit and archive through the confirmation dialogs; verify stale edits are
   rejected and Sales Actuals/Budget snapshots remain unchanged.
7. Check keyboard focus containment/Escape and scrolling in the long forms.

Final checks: `pnpm lint`, `pnpm exec tsc --noEmit --incremental false` and
`git diff --check` passed. The normal Turbopack build made no further progress and
was stopped; the sandboxed Webpack build failed to spawn TypeScript (`EPERM`).
Retrying `pnpm exec next build --webpack` outside the sandbox **passed**, including
compilation, type checking, static generation and build traces. Its route output
includes the product list, existing product detail and new nested variant detail.
The focused read-model (14), action (2) and render/editor (5) tests also passed when
executed directly, in addition to the suite commands above. No application release,
commit or push was performed.
