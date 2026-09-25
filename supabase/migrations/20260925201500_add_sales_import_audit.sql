-- Sales import audit and provenance (forward-only)
-- Purpose:
-- - persist import history for budget/forecast/actual uploads
-- - allow fact-level provenance back to the originating import
-- - preserve existing sales authorization model

create table if not exists public.sales_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  scenario_id uuid not null,
  year_number integer not null,
  source_filename text not null,
  source_type text not null,
  import_mode text not null default 'CREATE_ONLY',
  status text not null default 'PENDING',
  row_count integer not null default 0,
  fact_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  imported_by uuid references auth.users (id) on delete set null,
  imported_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_imports_year_number_check check (year_number between 2000 and 2100),
  constraint sales_imports_import_mode_check check (import_mode in ('CREATE_ONLY', 'UPDATE_EXISTING')),
  constraint sales_imports_status_check check (status in ('PENDING', 'VALIDATED', 'COMPLETED', 'FAILED', 'CANCELLED')),
  constraint sales_imports_counts_non_negative_check check (
    row_count >= 0
    and fact_count >= 0
    and created_count >= 0
    and updated_count >= 0
    and warning_count >= 0
    and error_count >= 0
  ),
  constraint sales_imports_unique_org_id unique (organization_id, id),
  constraint sales_imports_same_org_scenario_fk
    foreign key (organization_id, scenario_id)
    references public.sales_scenarios (organization_id, id)
    on delete restrict
);

comment on table public.sales_imports is 'Audit trail for sales data imports from workbook/csv sources.';
comment on column public.sales_imports.source_type is 'Stable source adapter identifier for the imported file format.';
comment on column public.sales_imports.import_mode is 'CREATE_ONLY or UPDATE_EXISTING import behavior selected by user.';
comment on column public.sales_imports.status is 'PENDING, VALIDATED, COMPLETED, FAILED, or CANCELLED import lifecycle state.';
comment on column public.sales_imports.metadata is 'Structured import metadata such as parser summary, filename details, and source diagnostics.';

create index if not exists sales_imports_org_imported_at_idx
on public.sales_imports (organization_id, imported_at desc);

create index if not exists sales_imports_org_year_scenario_idx
on public.sales_imports (organization_id, year_number, scenario_id, imported_at desc);

alter table public.sales_facts
add column if not exists import_id uuid;

comment on column public.sales_facts.import_id is 'Nullable provenance link to the sales_imports record that created or last updated this fact.';

alter table public.sales_facts
add constraint sales_facts_same_org_import_fk
foreign key (organization_id, import_id)
references public.sales_imports (organization_id, id)
on delete set null (import_id);

create index if not exists sales_facts_import_id_idx
on public.sales_facts (import_id)
where import_id is not null;

drop trigger if exists set_sales_imports_updated_at on public.sales_imports;
create trigger set_sales_imports_updated_at
before update on public.sales_imports
for each row
execute function public.set_updated_at();

revoke all on public.sales_imports from anon;
revoke all on public.sales_imports from authenticated;

grant select, insert, update on public.sales_imports to authenticated;

alter table public.sales_imports enable row level security;
alter table public.sales_imports force row level security;

drop policy if exists "sales_imports_select_sales_admin_or_system" on public.sales_imports;
create policy "sales_imports_select_sales_admin_or_system"
on public.sales_imports
for select
to authenticated
using (public.can_manage_sales_organization(organization_id));

drop policy if exists "sales_imports_insert_sales_admin_or_system" on public.sales_imports;
create policy "sales_imports_insert_sales_admin_or_system"
on public.sales_imports
for insert
to authenticated
with check (public.can_manage_sales_organization(organization_id));

drop policy if exists "sales_imports_update_sales_admin_or_system" on public.sales_imports;
create policy "sales_imports_update_sales_admin_or_system"
on public.sales_imports
for update
to authenticated
using (public.can_manage_sales_organization(organization_id))
with check (public.can_manage_sales_organization(organization_id));
