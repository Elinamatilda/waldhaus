# Product Master final migration review — 2026-09-26

The migration and application compatibility corrections are prepared locally. Nothing was applied to a database, imported, committed or pushed. Architectural approval is not deployment approval. The complete revised SQL is `supabase/migrations/20260926010000_product_master_commercial.sql`; the implementation report's fenced SQL is synchronized to this file.

## Actual SQL and validation limits

The actual `.sql` file was inspected, rather than treating rendered Markdown as SQL. It contains ordinary `--`, `~`, `!~`, `new.edit_version` and `select *` syntax where relevant. No backslash-escaped Markdown punctuation (`\--`, `\~`, `new\.`, `select \*`, `!\~`), NBSP, narrow NBSP, BOM, zero-width space or smart quotes were found. Decimal-regex `\.` escapes inside SQL string literals are intentional PostgreSQL regex syntax.

No `psql`, `postgres`, `initdb`, `pg_ctl`, Docker, Podman or Supabase CLI is available. No Python PostgreSQL parser is installed. There is no authorized live database tool/connection in this session. Thus neither PostgreSQL parsing nor disposable database migration/integration execution was performed. Static inspection and application tests do not establish database correctness. The historical migration-chain gap documented in `docs/database/phase-1-reconciliation.md` is still a separate bootstrap/deployment gate.

## Changes to the unapplied migration

- Retained table lock, customer-scoped variant preflight and `CHECK (customer_id IS NULL)`.
- `save_product_master` now checks same-organization existence and active status of the product, optional species and optional construction for active variants; the customer and variant for active customer products; and the customer product for active terms.
- Parent checks run for creates and updates, under the existing organization advisory lock; parent row locks serialize with concurrent parent writes. These are save-time checks, not automatic cascading archive rules. Archiving a parent can retain existing children; writing an active child subsequently requires its immediate parents to be active. Inactive children may still reference inactive same-org parents for history.
- Added `product_variant_default_quantity_unit_fk` to `units_of_measure(code)` and retained RPC unit validation. A locked preflight reports and rejects incompatible legacy values before the FK is added, with no transformations.
- Preserved physical-specification immutability after Sales/customer references, display-name updates, BIGINT optimistic versions, inclusive active-term overlap checks, whitelist SQL, SECURITY DEFINER authorization, tenant FKs, FORCE RLS and removal of direct authenticated writes.
- No unique customer-product-code index and no historical trigger/policy cleanup were added.

## UOM evidence

The pre-existing review records a user-supplied result of **no rows** for `SELECT DISTINCT default_quantity_unit_code FROM public.product_variants WHERE default_quantity_unit_code IS NOT NULL ORDER BY 1;` on 2026-09-26. That original result is not attached to the current request and was not independently verified in this pass. No fresh live UOM values were available; current compatibility remains a deployment gate. An empty non-null result would not prove the variants table itself is empty. The draft FK is retained behind the migration's locked compatibility preflight, which aborts and reports incompatible values without transforming them. Allowed codes remain PIECE, LINEAR_METER, CUBIC_METER, SQUARE_METER and KILOGRAM with FI/PL/EN labels.

## Exact rollout compatibility findings

Application-wide source search found two remaining customer-specific variant filters:

| File | Previous behavior | Current behavior |
| --- | --- | --- |
| `src/app/(authenticated)/sales/actuals/page.tsx` | Active variants with NULL/matching `variant.customer_id` | Calls `listCustomerProductVariants` using active `customer_products` for the selected customer |
| `src/app/(authenticated)/budget/sales/page.tsx` | Same legacy filter | Same canonical relationship lookup |
| `src/lib/products/service.ts` | No shared customer-specific choice lookup | Added authorized, organization-scoped relationship/variant intersection; excludes inactive links and variants |
| `src/lib/sales/service.ts` | Read and exposed variant `customer_id` | Removed deprecated column from variant selection/type |

Reviewed application files requiring no additional change:

- `src/lib/products/model.ts`: physical payload whitelist excludes customer_id and derived volume; customer_products owns the customer reference; UOM validation uses canonical codes.
- `src/app/actions/product-master.ts`: all mutations go through the authorized product service/RPC.
- `src/app/(authenticated)/sales/actions.ts`: legacy `createVariantAction` already delegates to canonical `createProductVariant` and rejects customer/depth/stored-volume payloads. It does not create customer-specific variants.
- `src/components/sales/product-master-manager.tsx`: physical forms and customer relationships already use separate entity field sets; customer choice is on customer_products. Classification/parent selectors may display inactive records for historical editing; RPC validation is the security/integrity boundary.
- `src/app/(authenticated)/sales/products/[productId]/page.tsx`: loads the canonical product workspace and separate customer list.
- `src/app/(authenticated)/sales/planning/page.tsx`: redirects to the single `/budget/sales` implementation.
- `src/components/sales/monthly-facts-grid.tsx` and Sales validation/actions: customer_id is a Sales fact dimension, not a physical variant owner. Existing snapshots and the Sales RPC contract are retained.

There are no remaining executable application reads/filters of `product_variants.customer_id`, customer-specific physical-variant creation workflows or direct variant write queries. The rejection of legacy customer input remains intentional. Physical variant create/update/archive wrappers use the same canonical RPC. All customer-specific links use customer_products.

Before Product Master exists, the new customer choice helper returns no variant choices when the catalogue readiness probe reports a missing schema; it never falls back to deprecated customer coupling. Product-level Sales entries remain available. Once deployed, a variant must have an active customer_products link to appear for that customer. No customer links are inferred, seeded or imported. Existing variant-specific Sales selections may therefore require reviewed customer links before being selectable in these two screens. Underlying historical facts are not rewritten. The UI filter is not authorization: the existing Sales RPC still validates organization/product/variant independently and does not require commercial terms or a customer_products link.

Deploy compatible application code before enforcing the new constraint, coordinate availability of canonical relationships, and verify a fresh read-only preflight. If customer-scoped physical variants exist at deployment time, the migration stops; do not clear them automatically. The user-supplied UOM query does not replace a fresh full catalogue/variant-usage check.

## Existing product_variants objects

The inventory below comes from the version-controlled 2026-09-25 deployed-schema observation, plus explicitly identified later repository SQL. It is not a live 2026-09-26 catalogue query. The existing read-only `supabase/diagnostics/product-master-preflight.sql` reports current triggers/functions, RLS, FKs, table grants, column grants and UOM usage when run by an authorized operator; it was extended to include column grants and was not executed here.

Snapshot trigger:

- `set_product_variants_updated_at`: `CREATE TRIGGER set_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION set_updated_at()`.

Snapshot policies (all permissive, authenticated):

- `product_variants_delete_sales_admin_or_system`: DELETE; predicate `can_manage_sales_organization(organization_id)`.
- `product_variants_insert_sales_admin_or_system`: INSERT; predicate `can_manage_sales_organization(organization_id)`.
- `product_variants_select_sales_admin_or_system`: SELECT; predicate `can_manage_sales_organization(organization_id)`.
- `product_variants_update_sales_admin_or_system`: UPDATE; predicate `can_manage_sales_organization(organization_id)` in USING and WITH CHECK.

Snapshot foreign keys from variants:

- `product_variants_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL`.
- `product_variants_customer_id_fkey`: `FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL`.
- `product_variants_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- `product_variants_product_id_fkey`: `FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE`.
- `product_variants_same_org_customer_fk`: `FOREIGN KEY (organization_id, customer_id) REFERENCES customers(organization_id, id) ON DELETE SET NULL`.
- `product_variants_same_org_product_fk`: `FOREIGN KEY (organization_id, product_id) REFERENCES products(organization_id, id) ON DELETE CASCADE`.
- `product_variants_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL`.

Snapshot incoming Sales foreign keys:

- `sales_facts_product_variant_id_fkey`: `FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT`.
- `sales_facts_same_org_variant_fk`: `FOREIGN KEY (organization_id, product_variant_id) REFERENCES product_variants(organization_id, id) ON DELETE RESTRICT`.
- `sales_facts_variant_matches_product_fk`: `FOREIGN KEY (organization_id, product_variant_id, product_id) REFERENCES product_variants(organization_id, id, product_id) ON DELETE RESTRICT`.

Snapshot owner is postgres; RLS is enabled and forced. Explicit table ACL gives postgres and service_role SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN and authenticated SELECT/INSERT/UPDATE/DELETE. No explicit per-column ACLs are recorded. The new migration revokes table privileges from PUBLIC/anon/authenticated, restores authenticated SELECT only, and revokes variant column INSERT/UPDATE/REFERENCES grants. It preserves the existing SELECT policy and adds the version trigger; it does not change service-role ownership/permissions.

The observed `enforce_sales_fact_variant_customer_consistency_tg` is on sales_facts, not product_variants. Its customer comparison becomes redundant under the NULL constraint; its same-org existence check still has meaning. Later Sales Phase 2 repository SQL defines `sales_variant_assignment_guard` on variants and `sales_fact_variant_guard` on sales_facts using `sales_variant_integrity()`. The assignment guard becomes redundant; only the customer clause of the fact guard becomes redundant, while tenant/product checks remain relevant. These later objects are not present in the older snapshot and must be confirmed with a fresh preflight. All are retained.

The existing variant customer FKs become vacuous with customer_id always NULL. INSERT/UPDATE/DELETE policies remain installed but authenticated users lack corresponding grants. They are not customer-specific policies and no RLS is weakened. No historical applied object is dropped or changed in-place; any eventual cleanup must be a separately reviewed forward migration.

## customer_product_code recommendation

The repository models this as an optional customer reference/code, not a proven unique external SKU. The schema and supplied business evidence do not establish per-customer uniqueness. Keep it optional and nonunique. If the business confirms it is a unique customer external SKU, separately review `(organization_id, customer_id, customer_product_code) WHERE customer_product_code IS NOT NULL`, including case/whitespace/blank and archive semantics. No such index was added.

## Tests and verification

`supabase/tests/product_master_commercial.sql` now includes customer payload rejection and direct NULL-constraint enforcement; all six inactive-parent cases; inactive historical children; relationship reactivation with each inactive parent independently; cross-tenant product/species/customer/commercial parent; noncanonical RPC UOM and direct FK rejection; physical immutability; display-name updates; overlap rejection including an inclusive shared boundary and adjacent periods; stale versions; System Admin, Admin own/other org and Employee; direct write denial; and parent archive without cascading history. **This SQL suite has not been run.** It requires a disposable Supabase-equivalent database with the known foundation and role seeds. The user authorizes disposable validation, but no database runtime is installed here.

`tests/products/customer-variants.test.mjs` executes the service against mocked HTTP responses, checking organization/customer/product scope, active relationship/variant intersection, absence of deprecated reads, pre-migration behavior and authorization before database access. Existing model/service/render, Sales, auth and budget regression tests are also run. These tests are not live RLS or multi-session race tests.

Final command results:

- All 25 application test files executed individually with Node: **147 tests, 145 passed, 2 opt-in database integration tests skipped, 0 failures**.
- `pnpm lint`: passed.
- `pnpm exec tsc --noEmit --incremental false`: passed.
- `pnpm build`: failed due to the environment: Turbopack could not create a process/bind a local port (`Operation not permitted`), reported while parsing the existing cash-flow editor. An elevated retry produced the same failure. `pnpm exec next build --webpack` also failed: could not parse TypeScript `--showConfig` subprocess output. A successful production build is not claimed.
- No real SQL parser/migration/database test was available; SQL validation remains pending.

Additional changed non-application files: the Product Master migration and SQL test, `supabase/diagnostics/product-master-preflight.sql` (column-grant reporting), `tests/products/customer-variants.test.mjs`, this report, and the synchronized Product Master implementation report. Cash Flow Budget/Liquidity terminology-only edits are separately documented in `docs/budget/migration-terminology-review.md`.

## Follow-up diagnostics

A direct Node child-process probe reproduced `EPERM` with empty stdout when spawning
TypeScript `--showConfig`. This supports an execution-environment cause for the
Webpack failure; no build configuration or dependency workaround was introduced.
The sandbox also failed DNS resolution for the configured Supabase host and npm
registry. An elevated registry probe was not executed because automatic approval
review timed out. No disposable database package was installed or SQL applied.

The subsequently reported authentication runtime error is a separate investigation.
The verification wrapper now distinguishes a returned transport failure with no
HTTP response from an HTTP error status, preserving the original cause without
copying upstream message contents. This improves diagnosis; it does not establish
or repair the user's underlying connection failure. User verification remains
mandatory and service failures do not become signed-out sessions.

## Product Master syntax correction after reported Supabase error

The user reported PostgreSQL 42601 at line 223 while attempting deployment.
The original SQL used an unparenthesized SQL CASE expression inside a PL/pgSQL
IF condition. Its inner THEN can terminate the PL/pgSQL condition reader early.
The regex CASE operand is now parenthesized (`raw !~ (case ... end)`). Decimal
patterns use `[.]` to avoid backslash-copy ambiguity, with unchanged precision.
The full SQL block in the implementation review is synchronized again.

The earlier static review missed this syntax defect; it was not real PostgreSQL
validation. No successful migration execution is claimed. The agent has not
connected to or modified the live database, and the user's attempted deployment
means the live migration state now needs independent confirmation.

Reference: https://www.postgresql.org/message-id/20141112044644.2524.61080%40wrigleys.postgresql.org

## Complete canonical Product Master addendum (requirements 15–24)

See [the canonical read-model review](canonical-product-read-model.md) for the
exact authorized response contract, field-by-field provenance and preservation,
quality analysis, customer/commercial separation, material/stock boundaries and
shared-species reuse. `getProductMasterDefinition` is now exported by the Product
Master service; the future UI was not implemented. No new migration or live
schema operation was performed. Current deployed schema/quality usage remains
subject to a fresh read-only preflight, not inferred from the captured catalogue.
