# Product Master lookup defaults

`wood_species` and `construction_types` already exist in the canonical Product
Master migration. Their initial migration created no default records. Variant
forms already read organization-scoped lookup rows and submit UUIDs, not names.
The separate Add species form maintains the lookup catalogue; its canonical code
field does not belong in ordinary variant species selection.

`supabase/migrations/20260928010000_product_master_lookup_defaults.sql` adds:

| Table | Code | Finnish | Polish | English |
| --- | --- | --- | --- | --- |
| wood_species | oak | Tammi | Dąb | Oak |
| wood_species | birch | Koivu | Brzoza | Birch |
| construction_types | solid | Massiivipuu | Lite drewno | Solid |
| construction_types | finger_jointed | Sormijatkettu | Łączone na mikrowczepy | Finger-jointed |

The migration populates all organizations present at deployment. It adds only
missing organization/code pairs and preserves existing IDs, names and archived
state. It does not merge alternative custom codes, reactivate records, or create
product/variant records. Organizations created later can use existing authorized
lookup management; this migration does not install an organization trigger.

Run after `20260926010000_product_master_commercial.sql` with a deployment role
that already has SUPERUSER/BYPASSRLS capability. No policies or grants are changed.
No live database access is available in this session, so the migration has not
been deployed or executed against PostgreSQL here. Existing live lookup contents
have not been independently inspected.

## Product-specific checkbox selection

The user clarified that the **Puulajit** popup on the product detail selects the
species offered for that product family. Selecting Oak and Birch for Thresholds
means the company offers both oak thresholds and birch thresholds. It does not
create variants or combine species in a physical variant.

Deploy `20260928020000_product_wood_species.sql` after the canonical Product Master
migration. It adds an organization-scoped relationship from existing products to
existing species. No species are automatically selected for a product. The
checkbox popup saves this relationship through one authorized RPC, retaining the
existing single `wood_species_id` on each physical variant.

The complete Product Master read model now includes `offered_wood_species`: an
array of resolved, localized species, independent of `variants`. An empty array
means no product selections. Null explicitly means the relationship migration is
not deployed; existing variant screens remain available and selection saving is
disabled. Other query/permission errors are not converted to empty results.

The selection RPC uses the same organization advisory lock as existing master
writes, locks the product and referenced species, and checks the expected previous
selection to reject stale edits. Tenant-composite foreign keys, FORCE RLS, and
SELECT-only authenticated table access are retained. New inactive species cannot
be selected; already selected inactive species can be retained or removed.
Changing selections never creates, edits, archives or deletes physical variants.

Ordinary product selection opens a localized checkbox dropdown without canonical
code or translation inputs. Shared catalogue maintenance is a separate collapsed
section explicitly labeled as catalogue administration. Default seeding is safe
to repeat for existing organization/code pairs and does not select defaults for
any product.

Application tests cover multi-selection and clearing, authorization, stale edits,
canonical read-model separation, localized popup fields, independent checkboxes
and submitted values while the dropdown is closed. The rollback SQL regression
script is `supabase/tests/product_wood_species.sql`; running it requires a disposable
PostgreSQL database with the migrations deployed. It was not executed here.
