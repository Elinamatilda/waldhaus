# Waldhaus Engineering Guidelines

## UI and Design System

All future Waldhaus UI must use the established Waldhaus design system.

Rules:

- Use existing semantic design tokens.
- Never introduce arbitrary colors when an existing semantic token applies.
- Avoid arbitrary spacing, radius, shadow and typography values.
- Reuse shared UI components.
- Do not recreate buttons, cards, inputs, dialogs, badges, tables, filters or page headers inside feature pages.
- Search the shared component library before creating a new component.
- Reusable patterns belong in the shared design system.
- All screens must look like parts of one application, not independently generated screens.

Visual language:
professional manufacturing ERP; calm; precise; information-dense; light blue-tinted surfaces; white raised surfaces; purple primary accent; restrained operational secondary colors.

Desktop/laptop is the primary operational environment, but responsive behavior is required.

Operational tables must prioritize scanability and information density.

Use semantic status colors consistently.

Red is reserved for genuine error, destructive or critical states.

Interactive components must implement:
- hover
- focus
- disabled
- loading where applicable

Forms must use shared form patterns.

Create/edit workflows should use shared Dialog/Drawer patterns.

Destructive actions require confirmation.

UI must remain keyboard accessible.

## Architecture and Security

- Hidden UI is NOT authorization.
- UI visibility is not a security boundary.
- Role-based UI must consume the application's authorization model.
- Never weaken Supabase RLS.
- Database schema changes must be migrations.
- Never expose service-role credentials to the browser.
- Do not scatter direct ad-hoc Supabase queries throughout presentation components.
- Follow the established data-access architecture.
- Preserve server/client boundaries.
- Never commit secrets or .env.local.

## Database

All database schema changes must be made through version-controlled migrations.

Do not make schema changes manually in Supabase Dashboard unless explicitly instructed for an exceptional operational reason.

## Reference Screens

The repository contains:

reference_dashboard
reference_inventory
reference_orders

These are visual/UX references.

Dashboard defines:
- application shell
- KPI/metric language
- operational overview
- alerts
- production/job table patterns

Inventory defines:
- search
- filters
- segmented controls
- dense operational tables
- status indicators
- capacity/progress
- row actions
- pagination

Orders defines:
- order/workflow information architecture
- order status/action patterns
- additional workflow patterns found in that reference

Agents must inspect these references when implementing or materially changing related Waldhaus UI.

The reference files define visual direction, NOT production architecture.

Do not blindly copy:
- static HTML
- mock data
- English labels
- fake SKUs
- warehouse names
- sample monetary values
- example business entities

All future Waldhaus features must feel like parts of one coherent application.

## Inventory Legacy Mapping Guardrails

Legacy inventory source is a real operational spreadsheet and must be mapped without information loss.

Rules:

- Do not model A/B/C as quality grades.
- Do not invent A/B/C/D grade systems.
- Jakość is the quality/classification source field.
- Do not constrain quality to a small fixed list until source vocabulary review is complete.
- Masa in legacy source is used as a volume-related calculated value, not physical weight.
- Prefer canonical concept naming such as volume_m3 for the future domain model.
- Preserve legacy source values for traceability during import.
- A/B/C are confirmed measurement-related legacy inputs in some records, but each field's exact business meaning remains unresolved.
- Preserve unresolved fields without guessing semantics.
- Support both structured canonical measurements for new records and raw legacy measurement representation for import fidelity.
- Keep operational inventory schema minimal; legacy-heavy semantics stay in legacy payload unless needed for new operational records.
- Use append-style stock movements as the operational stock source of truth; avoid relying on manually edited mutable balances.
- Canonical database values must use stable language-independent codes.
- Confirmed unit mapping: legacy `mb` maps to canonical code `LINEAR_METER` (localized labels: pl=mb, fi=jm, en=rm).
- Support canonical `PIECE` unit as minimum alongside `LINEAR_METER` (localized labels: pl=szt., fi=kpl, en=pcs).
- UI labels must be localized for fi/pl/en.
- Do not use translated labels as canonical domain values.
- Free-text legacy notes/descriptions are preserved in source language and are not auto-translated.
- Inventory persistence migration stays paused until unresolved source semantics are confirmed.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
