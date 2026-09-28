# Customer selection in the variant form

The Add/Edit Variant popup now includes a customer checkbox dropdown. Typically
one customer is selected; multiple customers and no assigned customer are supported.
The product's variant list also shows active customer relationships, making the
usual customer-specific dimensions visible without opening each variant.

Physical specification stays in the existing `product_variants` entity. Customers
remain in `customer_products`; no customer field was added to physical identity.
The form freezes relationship IDs/version tokens when opened. Server validation
passes customer IDs separately from the canonical physical payload.

Deploy `20260928030000_variant_customer_selection.sql` after the existing canonical
Product Master migration. The new `save_product_variant_customers` RPC is SECURITY
INVOKER and calls the existing authorized `save_product_master` writer. It adds no
tables and changes no RLS policies. Organization authorization precedes all reads
and writes. The existing organization advisory lock serializes customer link edits.
Variant and relationship expected versions are both checked. Any conflict or invalid
customer rolls back the complete save, so a failed association cannot leave a new
unlinked variant behind. No partial fallback is attempted when the RPC is missing.

Unchanged active relationships are preserved. Selecting an archived relationship
reactivates the same ID and retains customer codes, names, notes and dated terms.
The UI explains the return of existing effective terms. Deselecting an active
relationship requires explicit archive confirmation and archives the link; it
never deletes its commercial history. Physical-specification immutability after
references still applies, even when deselecting customers in the same submission.

Commercial terms remain on the variant detail. No orders, demand-to-sales sync,
inventory, BOM or historical Sales/Budget changes were introduced.

Application tests cover separate payloads, one RPC, authorization, version precision,
invalid selections, no fallback on failure, popup values and removal confirmation.
The rollback SQL regression file `supabase/tests/variant_customer_selection.sql`
covers atomic failure, relationship history/reactivation, multiple customers,
archive confirmation, tenant boundaries and immutable physical specification.
No live migration or SQL integration execution was performed in this environment.

Validation completed: direct Node runs for all Product Master and Sales tests,
`pnpm lint`, `pnpm exec tsc --noEmit --incremental false`, `git diff --check`, and
`pnpm exec next build --webpack` passed. The production build was run outside the
sandbox to allow Next.js subprocesses. Browser interaction and live SQL execution
remain unverified; the migration must be deployed before the combined save works.
