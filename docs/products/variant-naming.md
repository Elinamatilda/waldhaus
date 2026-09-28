# Automatic variant naming

The Add variant dialog generates a read-only code and name after species and all
three positive canonical dimensions are entered. Dimensions are thickness × width
× length in millimetres; decimal comma and point inputs normalize to the same code.
Construction and unrestricted quality are included when supplied. Customers remain
separate customer_products relationships and never enter the generated identity.

Example with product code KYNNYS, species oak and construction solid:
`KYNNYS-OAK-SOLID-27X130X3000` / `Kynnys, Tammi, Massiivipuu, 27 × 130 × 3000 mm`.
Codes use canonical lookup codes; display names use the current UI language.
The product code is normalized to uppercase ASCII. If no usable product code
exists, the stable product UUID is the prefix (P-UUID). Quality is normalized for
the code but preserved in the name. The existing database uniqueness constraint
remains authoritative, including concurrent saves and normalization collisions.

Existing variants, including manually named legacy records, are not renamed.
Editing keeps the saved code immutable and permits the existing name editing
workflow. No database migration or data backfill is involved. Generated names are
stored text, not dynamically translated when the reader changes locale.

The form prevents duplicate codes among the loaded product variants, including
archived records, and explains how to use the existing record. Codes over 80 or
names over 200 characters are blocked with guidance instead of truncated. No
profile field has been introduced; the generator uses the current physical model.

Validation: Product Master Node tests, TypeScript, ESLint and production webpack
build. Render tests cover new-form preview, required inputs, duplicate prevention
and preserving existing identities; no authenticated browser test was available.
