# Canonical product structure — inspection and implementation proposal

Superseded for implementation status by [implementation-review.md](implementation-review.md).

Historical inspection status: prerequisite inspection complete against repository SQL/code and the supplied
2026-09-25 catalog. The current remote schema/data have not been queried. This is a
review proposal, not an implemented schema/service replacement. No migration,
production code or UI was changed; no database write/import/commit/push occurred.

## What already exists

| Concept | Evidence | Reuse decision |
| --- | --- | --- |
| Product master | products; comment: canonical identities independent of customer; sales-ontology-v1.md identifies sellable product families | Keep IDs/table/code/name. Threshold, Glueboard, Moulding, Sawn plank are families; do not auto-rename existing records. |
| Physical/specification variant | product_variants already exists | Extend this table, do not create an equivalent table. Keep variant_name naming instead of adding duplicate name. |
| Dimensions | thickness_mm, width_mm, depth_mm, length_mm are numeric(10,3) | Reuse millimetres. Do not infer depth equals length or migrate unknown legacy dimensions. |
| Identity | UUID; organization/variant_code unique; code/name nullable | Keep UUID identity; require a code for new canonical variants without inventing codes for legacy rows. |
| Tenant safety | composite org/product and org/customer FKs; sales_facts org/variant/product references; FORCE RLS | Preserve tenant FKs and helper-based authorization. |
| Customer coupling | variant.customer_id; SQL guards plus page filtering | Requires an explicit reviewed transition, not silently setting every customer_id to NULL. |
| Quantity/pricing/currency | sales_facts monthly scenario grain; quantity_value/code, volume_m3, unit_price_amount, PER_PIECE/PER_M3, currency_code | Reuse meanings/codes; keep historical snapshots. No existing currency or UOM master found in the repository. |
| Units | PIECE and LINEAR_METER enforced by Sales validation/RPC; separate volume_m3 | Retain these codes. Extend a shared UOM catalogue for CUBIC_METER, SQUARE_METER, KILOGRAM when introduced; do not use localized pc/szt/kpl/mb as IDs. |
| Customer agreement/price list | Not implemented in repository; customer_product exists only in ontology proposal | Propose an explicit customer-to-variant relationship and effective-dated commercial terms. Sales facts are period/scenario snapshots, not agreements. |
| Wood species/construction | No implemented catalogue found | Recommend lookup/master tables, not free text or fixed enum. |
| Inventory/BOM/routing/actual production cost | Inventory domain proposal/mock data; no implemented equivalent found in inspected migrations | Do not implement/import these now or couple product classification to stock/material consumption. |

Sources: sales_foundation.sql (20260925193000), harden_sales_tenant_integrity.sql
(20260925194500), sales_phase2_integrity.sql (20260925210000, user says deployed),
src/lib/sales/service.ts, src/app/(authenticated)/sales/actions.ts, product detail,
Sales Actuals and Budget Sales pages, docs/sales/sales-ontology-v1.md, and the supplied
catalog docs/database/deployed-schema-observation-2026-09-25.json.

## Recommendation before implementation: B — lookup/master tables

Use organization-scoped `wood_species` and `construction_types` with UUID id,
organization_id, stable code, labels in FI/PL/EN (or the project's eventual shared
translation relation), is_active and audit fields. Species scientific_name can be
optional. Unique (organization_id, code) and (organization_id, id), controlled
lowercase language-independent codes such as oak, birch, solid, finger_jointed.
Use a restricted canonical-code format so Oak/oak/OAK cannot become separate codes.
Neither enum nor unrestricted species text handles extensibility and translations
as cleanly. The existing roles catalogue demonstrates master-data rather than enum
practice. Tenant scope allows company-owned classifications without making one
tenant's Admin a global vocabulary editor. Do not derive species from quality_code.

Add nullable wood_species_id/construction_type_id to existing product_variants with
same-organization composite FKs. Legacy NULL means unclassified; map reviewed source
labels later. Require classification in the new fully specified workflow when known,
not by guessing values for old rows. Species describes product specification;
materials/stock/BOM remain separate. Archive lookup entries rather than deleting
referenced ones. Published codes should be immutable; labels may change.

## Product identity and duplicate prevention

Keep family product IDs, variant UUIDs and existing organization/code uniqueness.
Do NOT enforce uniqueness solely on species/construction/T×W×L: finish, machining,
profile, tolerances, quality and engineering revision may distinguish products.
The current quality_code/raw label and depth fields already show other specification
axes. Use the tuple as a duplicate-candidate warning/query, not automatic merging.
Treat variant code as the stable business identity and require explicit review when
creating a second variant with the same apparent physical tuple. Future drawing or
revision identity belongs to the variant, never to its customer display name.
The repository does not prove that existing customer-scoped rows are physically
identical or genuinely engineered differently. Do not decide from names alone.

## Proposed commercial structure, reconciled with Sales

A stable `customer_products` relationship references organization + customer and
organization + existing product_variant via composite tenant-safe FKs. Keep
customer_product_code/name, notes and archive/audit metadata there. Identity is UUID,
with one relationship per organization/customer/variant unless actual multiple
customer codes/specifications justify a broader key during data review.

Separate effective-dated terms from relationship identity if price changes need
history: relationship_id, valid_from/to, unit_price_amount, pricing_basis_code,
currency_code, demand_quantity, demand_unit_code and demand period/year, delivery
note and audit fields. All optional source numbers preserve NULL/zero. Price, basis
and currency must be supplied consistently. Reuse PER_PIECE/PER_M3 rather than
inventing competing price_unit spellings. Future per-length/area/mass pricing needs
an explicit shared basis-to-UOM extension; do not silently map it to PER_PIECE.
Prevent overlapping active terms for the same applicable contract scope, with
concurrency protection and reviewable archive/update APIs.

Do not persist both annual quantity and annual/12 as independent canonical values.
For the supplied annual agreements keep annual demand + year + UOM as source and
show an average-month indication only. An actual monthly demand schedule belongs
in monthly planning (existing sales_facts where scenario/year grain fits), with
no automatic redistribution/synchronization. Preserve independently supplied
monthly figures in import review metadata until their meaning is confirmed.
No redundant derived annual/monthly volumes or revenues on the physical variant.
Effective contract terms must not overwrite historical sales_facts snapshots.

## Required safe transition for existing variants

1. Inspect the CURRENT remote catalog and variant usage with the supplied read-only
   pretty JSON query. It checks for already-deployed equivalent masters/agreements,
   table structure, grants, constraints, triggers, function bodies and unit values.
2. Classify existing non-null customer_id variants as commercial-only coupling or
   genuinely distinct engineering identity using records/source evidence. The catalog
   provides counts, not that business meaning. Keep old IDs and source traceability.
3. Create additive master/relationship tables and nullable variant classification
   fields with RLS before grants. New physical variants are customer-independent.
4. Backfill only the known customer→variant relationship, never infer price/demand
   from an arbitrary sales month. Preserve source scope and compatibility while old
   guards/page filtering are still active. Do not delete customer_id in the first step.
5. Switch authorized operations and selection queries together. Retire legacy coupling
   only after relationships, engineering distinctions and regression tests are proven.
   Sales Phase 2 currently prevents changing customer_id on variants referenced by
   sales_facts; its rule cannot be ignored or dropped merely to force a backfill.

No weakening of tenant isolation is needed. New records should use the existing
System Admin selected-organization and organization Admin authorization. Employee
and anon must not modify commercial/product master data. Explicit grants/RLS and
composite keys must protect every new table; secure RPCs should validate supplied
IDs and concurrent changes. Any definer owner/FORCE RLS deployment contract must
be checked against actual role capabilities, not assumed.

## API and implementation targets after the inspection boundary

Reuse existing createProduct/updateProduct/toggleProductActive actions and product
read services. Extend listVariants rather than adding a parallel variant store.
Add authorized get/update/archive variant operations, and create/update/archive/list
customer relationship/terms operations through one product service layer. Route
existing createVariantAction through the same validator/service; the current legacy
form permits customer_id and manually stored volume and must be transitioned too.
No random UI Supabase writes or side API bypass. Shared Dialog/FormField/Input/Select
and global FI/PL/EN are required when changing that form.

The existing product detail displays depth_mm ?? length_mm as its third dimension;
new canonical T×W×L presentation must explicitly use length_mm, without altering
unresolved legacy depth data. volume_per_unit_m3 numeric(18,6) is already stored:
Parkano examples require seven decimal places per piece (0.0036064/0.0044896).
Do not overwrite the stored field or use its six-decimal rounding as canonical
rectangular geometry. Keep exact decimal geometry in one domain function and label
it theoretical. Missing dimensions produce unavailable, never inferred geometry.
Piece-derived volume is valid only for PIECE demand with known rectangular dimensions;
other units require explicit compatible conversion, not multiplying by piece volume.

Future BOM/routing/production orders reference variant UUIDs. Commercial relationship
UUIDs identify customer terms; production/material consumption and actual costs stay
separate. Historical RW names should map through reviewed source aliases to these IDs,
not create duplicate masters. Preserve unresolved cd, percentages and missing dimensions.

## Validation and unresolved source questions

See source-example-validation.md for exact Decimal calculations of all ten examples.
Tähtiporras annual volume is 31.2 m³, not 65. Pihla expected annual revenues are
15,660 / 38,475 / 20,070 EUR. Parkano expected annual volumes are 10.8192 / 13.4688 m³.
Original inconsistent Pihla revenue and Parkano volume figures were not supplied,
so exact source discrepancies beyond Tähtiporras cannot yet be computed.
Sawn percentages stay unresolved notes; no yield/mix/customer assumptions are made.

Before a data-changing transition, the remaining factual input is the CURRENT
Supabase diagnostic output and evidence for existing customer-scoped engineering
specifications. This pause implements the request to inspect/reconcile and report
recommendations before implementation; it is not a requirement from an external
skill or an invented permission gate. No claim is made that the requested services
or migration have already been implemented. No production test suite was run for
these documentation/read-only diagnostic artifacts; git diff --check was run.
