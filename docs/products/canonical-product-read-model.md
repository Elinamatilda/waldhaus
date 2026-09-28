# Complete canonical Product Master — review addendum

This addendum covers requirements 15–24. No migration has been applied by the
agent. No new UI, quality table, inventory schema, import, or stock mapping was
implemented. The existing Product Master migration remains a separate deployment
decision, with its earlier validation gates unchanged.

## 15. Exact canonical read contract

The authorized server entry point is:

```ts
import { getProductMasterDefinition } from '@/lib/products/service';

const definition = await getProductMasterDefinition(
  organizationId, productId, locale, '2026-09-26',
);
// Promise<ProductMasterDefinition | null>
```

The exact exported TypeScript contract is in `src/lib/products/read-model.ts`.
The top-level response is `{ product, variants, locale, as_of }`. `product` retains
all known top-level product columns. Each variant contains its identity/status/
audit fields, classification IDs and resolved classification objects, dimensions,
quality, default UOM, derived theoretical volume, explicitly identified legacy
specification, and `related.customer_products`.

The complete contract is reproduced below; the TypeScript file is authoritative.

```ts
import type { AppLocale } from '@/lib/i18n/config';

export type ProductAudit = {
  id:string;organization_id:string;is_active:boolean;archived_at:string|null;
  created_by:string|null;updated_by:string|null;created_at:string;updated_at:string;
};
export type ProductRecord = ProductAudit & {product_code:string|null;name:string;description:string|null};
export type VariantRecord = ProductAudit & {
  product_id:string;variant_code:string|null;variant_name:string|null;edit_version:string;
  wood_species_id:string|null;construction_type_id:string|null;
  quality_code:string|null;quality_label_raw:string|null;
  thickness_mm:string|null;width_mm:string|null;length_mm:string|null;depth_mm:string|null;
  volume_per_unit_m3:string|null;default_quantity_unit_code:string|null;
};
export type ClassificationRecord = ProductAudit & {
  code:string;name_fi:string;name_pl:string;name_en:string;edit_version:string;
};
export type SpeciesRecord = ClassificationRecord & {scientific_name:string|null};
export type UnitRecord = {code:string;name_fi:string;name_pl:string;name_en:string};
export type CustomerRecord = ProductAudit & {customer_code:string|null;name:string;notes:string|null};
export type CustomerProductRecord = ProductAudit & {
  customer_id:string;product_variant_id:string;customer_product_code:string|null;
  customer_product_name:string|null;notes:string|null;edit_version:string;
};
export type CommercialTermRecord = ProductAudit & {
  customer_product_id:string;valid_from:string;valid_to:string|null;edit_version:string;
  demand_quantity:string|null;demand_unit_code:string|null;demand_period:'YEAR'|'MONTH'|null;
  demand_year:number|null;unit_price_amount:string|null;pricing_basis_code:string|null;
  currency_code:string|null;delivery_note:string|null;notes:string|null;
};
export type Named<T> = T & {name:string};
export type CommercialTermDefinition = CommercialTermRecord & {demand_unit:Named<UnitRecord>|null};
export type CustomerProductDefinition = CustomerProductRecord & {
  customer:CustomerRecord;terms:CommercialTermDefinition[];current_terms:CommercialTermDefinition[];
};
export type ProductVariantDefinition = Omit<VariantRecord,'thickness_mm'|'width_mm'|'length_mm'|'depth_mm'|'volume_per_unit_m3'> & {
  dimensions:{thickness_mm:string|null;width_mm:string|null;length_mm:string|null};
  wood_species:Named<SpeciesRecord>|null;construction_type:Named<ClassificationRecord>|null;
  default_quantity_unit:Named<UnitRecord>|null;
  theoretical_volume_m3:string|null;
  legacy_specification:{depth_mm:string|null;volume_per_unit_m3:string|null};
  related:{customer_products:CustomerProductDefinition[]};
};
export type ProductMasterDefinition = {
  product:ProductRecord;variants:ProductVariantDefinition[];locale:AppLocale;as_of:string;
};
```

The service validates the selected organization and Admin/System Admin role before
any database access. Employee access, missing organization selection and mismatched
organization are rejected. All organization-owned reads explicitly filter
`organization_id` and use the ordinary session client under existing RLS. Units
use their existing global canonical lookup. No service-role client or new grants
are introduced.

Reads use explicit projections, 100-ID batches and 200-row pagination rather than
truncatable embedded relation arrays. Only records associated with the requested
product are assembled. No customer-specific filter is applied to physical variants.
Missing product returns `null`; schema/access/query failures remain errors. A
non-null reference that cannot be resolved is an error, not a silently missing
classification/customer. Optional null references stay null. Archived records
remain in the response for history.

`as_of` is an ISO date; the default is today's UTC date. All dated commercial terms
remain under `terms`. `current_terms` contains terms effective on that inclusive
date with an active term, relationship, customer, variant and product. Multiple
matches are not silently reduced to one. This is a read convenience, not a change
to the write-time active-parent or no-cascading-archive rules.

Bigint edit versions and database decimal quantities/dimensions/prices travel as
strings. Theoretical volume reuses the existing exact decimal calculation:
thickness × width × length / 1,000,000,000. Missing length returns null even if
legacy depth or stored volume exists. This is rectangular volume for one fully
dimensioned piece, not net finished-profile volume, actual consumption, yield or
an automatic conversion from the default UOM. No aggregate demand/revenue totals
are persisted or invented.

This service performs multiple scoped reads, not one transactionally consistent
database snapshot. Concurrent authorized edits can change data between requests;
broken required joins fail explicitly. It is not a locking API for engineering
or pricing decisions. No new HTTP endpoint or AI-tool authorization surface was
added; a future adapter must call this same authorized service path.

## 16–18. Field provenance

| Source | Fields exposed |
| --- | --- |
| `products` | `id`, `organization_id`, `product_code`, `name`, `description`, `is_active`, `archived_at`, `created_by`, `updated_by`, `created_at`, `updated_at`, all under `product` |
| `product_variants` identity/status | `id`, `organization_id`, `product_id`, `variant_code`, `variant_name`, `is_active`, `archived_at`, all four audit fields, plus proposed `edit_version` |
| `product_variants` specification | `quality_code`, `quality_label_raw`, `default_quantity_unit_code`, proposed `wood_species_id`, `construction_type_id` |
| `product_variants` dimensions | `thickness_mm`, `width_mm`, `length_mm`, exposed together as `dimensions` |
| `product_variants` legacy | `depth_mm`, `volume_per_unit_m3`, exposed without reinterpretation under `legacy_specification` |
| `wood_species` | Existing proposed canonical UUID/code, all FI/PL/EN names, selected-locale `name`, scientific name, organization, status, archive, version and audit fields |
| `construction_types` | Existing proposed canonical UUID/code, all FI/PL/EN names, selected-locale `name`, organization, status, archive, version and audit fields |
| `units_of_measure` | Stable `code`, all FI/PL/EN labels and selected-locale `name`, for the variant default UOM and commercial demand UOM |
| Domain calculation | `theoretical_volume_m3`, computed from canonical dimensions only |

Localized names are display values. UUIDs and stable codes remain identity. Raw
quality labels, descriptions and notes remain in their original language.

## 19. Customer/commercial data is related data

`variant.related.customer_products[]` retains each relationship's organization,
IDs, customer code/name override, notes, active/archive, audit and version fields.
Each item resolves its `customer` (customer UUID/code/name/status/notes/audit), all
`terms`, and the date-filtered `current_terms` subset.

Commercial terms retain price, pricing basis, currency, demand quantity/UOM/period/
year, validity, delivery notes, general notes, status, audit and version. None is
part of the physical variant identity or its engineering specification. The
deprecated `product_variants.customer_id` is neither queried nor exposed. No
customer-product-code uniqueness assumption is introduced.

## 20–21. Existing-field preservation and evidence limits

The deployed-schema observation captured on 2026-09-25 and the version-controlled
Sales foundation are the inspection sources. They show 11 product columns and 20
variant columns. All 11 product columns are selected unchanged. All 19 valid
variant columns other than the explicitly deprecated `customer_id` remain
available: dimensions and legacy values are grouped rather than discarded. New
classification IDs and edit version are additive.

No other variant specification fields appear in that captured schema. This is not
a new live Supabase inspection: any later deployment drift must be checked with
`supabase/diagnostics/product-master-preflight.sql` before deployment. A regression
test compares projections against every captured product/variant column so known
fields cannot disappear unnoticed.

Existing `MASTER_FIELDS` remain write whitelists, not read-model definitions.
`quality_label_raw`, `depth_mm`, and stored legacy volume are read-only here; their
omission from mutation payloads does not erase them. The current form-oriented
`loadProductWorkspace` remains an editing DTO. It does not replace the complete
read contract or add another complete product-definition assembly in the UI.

## 22. Quality analysis

1. **Meaning:** `quality_code` currently records a variant-level quality/
   classification value. Neither the schema nor the available source evidence
   establishes a complete business taxonomy or equivalence to material grades.
2. **Usage:** the Sales foundation defines it; Sales `listVariants` reads it;
   Product Master payload validation and its existing form expose it as text;
   `save_product_master` writes it and includes it in specification immutability
   once Sales/customer relationships reference the variant. The complete read
   model now returns both `quality_code` and `quality_label_raw`.
3. **Control:** the captured column is nullable PostgreSQL `text`, with no enum,
   quality FK or closed-value CHECK. Application/RPC text validation imposes input
   limits but does not define a controlled vocabulary. The raw label is a separate
   preserved source field. Actual distinct production values have not been read.
4. **Potential sharing:** a common quality vocabulary is possible only after
   source-value and semantic review. The supplied warehouse examples `I`/`II`
   alone do not prove correspondence to finished-product quality. No automatic
   mappings, quality table, closed list or A/B/C grade interpretation is added.
5. **Domain placement:** product quality is part of the existing physical variant
   specification. Material quality may independently describe raw-material
   grading; stock/batch inspection may be another contextual attribute. They can
   have different meanings despite similar labels. Preserve these distinctions
   until business definitions and actual usage justify sharing.

`supabase/diagnostics/product-quality-preflight.sql` is a new read-only query for
an authorized operator to inspect organization-scoped code/raw-label combinations
and usage counts. It has not been run. No unsupported claim about the live quality
vocabulary is made.

## 23–24. Product, material, stock and shared species

- Product/Product Variant defines what Waldhaus manufactures or sells.
- Future Material/Inventory Item defines what is purchased, stored and consumed.
- Future Stock records quantity at location/batch/source, including stock-specific
  certification provenance as appropriate.

The Frysztak warehouse rows are not variants and are not imported or converted by
this change. Quantities, locations, unresolved measurements, notes, PEFC/source
attributes and legacy unit/quality information remain a separate future inventory
mapping task. Future BOM/consumption links may connect materials and variants.

The proposed `wood_species` already has organization-scoped UUID identity, stable
code, multilingual labels and `unique(organization_id,id)`. A future material
master can reference that same table with a same-organization composite FK.
No `product_wood_species`/`inventory_wood_species` split is needed. Mapping source
`dąb`, `brzoza`, `jesion` to reviewed `oak`, `birch`, `ash` codes is future import
logic, not an automatic ID assignment or a source-language translation here.
Future inventory access must use the authorization model; this addendum does not
widen classification RLS to anticipate future roles.

## Verification and files

New implementation: `src/lib/products/read-model.ts`, `read-service.ts` and shared
`authorization.ts`. Existing `service.ts` preserves its authorization export and
exposes the canonical read function. No UI, mutation whitelist or migration SQL
was changed for this addendum.

`tests/products/read-model.test.mjs` tests complete field coverage, exact volume,
legacy preservation, FI/PL/EN display, archived history, effective dates, Admin/
System Admin/Employee/tenant boundaries, missing schema/joins, and pagination
across 205 variants with their relationships and terms. Tests use mocked HTTP and
are not live PostgreSQL/RLS verification.

The existing final migration review links this addendum. Diagnostic/report files
are `supabase/diagnostics/product-quality-preflight.sql`, this document, and the
updated final/implementation reviews. Nothing was applied, committed or pushed.

Current command results: all 24 Product Master tests passed (11 new read-model
checks and 13 existing model/service/customer-choice/render checks). `pnpm lint`
and `pnpm exec tsc --noEmit --incremental false` passed. `pnpm build` failed because
Turbopack could not create its worker processes/bind local ports (`Operation not
permitted`), reported in the existing three budget editors. No successful
production build, database migration execution or live RLS test is claimed.
