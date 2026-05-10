-- =============================================================================
-- Compliance Evidence Mapper — initial schema
-- =============================================================================
-- Multi-tenant compliance app. Tenancy boundary = `companies`. Membership via
-- `company_members`. Internal app for now; non-members do not see a company at
-- all. Frameworks and the master control catalog are global-read for any
-- authenticated user.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — one row per auth.users, auto-created by trigger
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_company_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  industry text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- company_members — multi-tenant join. Roles: owner | admin | contributor | viewer
-- ---------------------------------------------------------------------------
create type public.company_role as enum ('owner', 'admin', 'contributor', 'viewer');

create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.company_role not null default 'contributor',
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index company_members_user_idx on public.company_members(user_id);

-- Auto-add creator as owner when a company is inserted
create or replace function public.tg_handle_new_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.company_members (company_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger companies_add_owner
  after insert on public.companies
  for each row execute function public.tg_handle_new_company();

-- ---------------------------------------------------------------------------
-- Membership helpers used by RLS policies. SECURITY DEFINER so policy checks
-- against company_members itself don't recurse.
-- ---------------------------------------------------------------------------
create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_company_role(p_company_id uuid, p_roles public.company_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id
      and user_id = auth.uid()
      and role = any(p_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- create_company RPC — atomic create + auto-owner. Avoids the RLS round-trip
-- problem where INSERT...RETURNING evaluates SELECT permission before the
-- AFTER trigger has created the membership row.
-- ---------------------------------------------------------------------------
create or replace function public.create_company(
  p_name text,
  p_slug text default null,
  p_industry text default null,
  p_notes text default null
)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.companies;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.companies (name, slug, industry, notes, created_by)
  values (p_name, p_slug, p_industry, p_notes, v_uid)
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function public.create_company(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- frameworks
-- ---------------------------------------------------------------------------
create table public.frameworks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  version text,
  description text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- controls — master catalog. Hierarchical via parent_control_id.
-- ---------------------------------------------------------------------------
create type public.control_type as enum ('parent', 'child', 'standalone');

create table public.controls (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.frameworks(id) on delete cascade,
  parent_control_id uuid references public.controls(id) on delete set null,
  control_ref text not null,
  title text,
  description text,
  domain text,
  control_type public.control_type not null default 'standalone',
  recommendation_template text,
  evidence_examples text,
  evidence_keywords text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (framework_id, control_ref)
);
create index controls_framework_idx on public.controls(framework_id);
create index controls_parent_idx on public.controls(parent_control_id);
create trigger controls_set_updated_at
  before update on public.controls
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- crosswalks — directional mapping between controls
-- ---------------------------------------------------------------------------
create type public.crosswalk_mapping_type as enum ('direct', 'inherited', 'effective', 'related', 'equivalent', 'partial');

create table public.crosswalks (
  id uuid primary key default gen_random_uuid(),
  source_control_id uuid not null references public.controls(id) on delete cascade,
  target_control_id uuid not null references public.controls(id) on delete cascade,
  mapping_type public.crosswalk_mapping_type not null default 'related',
  notes text,
  created_at timestamptz not null default now(),
  unique (source_control_id, target_control_id, mapping_type),
  check (source_control_id <> target_control_id)
);
create index crosswalks_source_idx on public.crosswalks(source_control_id);
create index crosswalks_target_idx on public.crosswalks(target_control_id);

-- ---------------------------------------------------------------------------
-- company_controls — per-company adoption status
-- ---------------------------------------------------------------------------
create type public.company_control_status as enum ('not_started', 'in_progress', 'implemented', 'not_applicable');

create table public.company_controls (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  control_id uuid not null references public.controls(id) on delete cascade,
  status public.company_control_status not null default 'not_started',
  owner_user_id uuid references auth.users(id) on delete set null,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, control_id)
);
create index company_controls_company_idx on public.company_controls(company_id);
create index company_controls_control_idx on public.company_controls(control_id);
create trigger company_controls_set_updated_at
  before update on public.company_controls
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- evidence — files/notes per company. Stored in `evidence` bucket under
-- {company_id}/{evidence_id}/<filename>.
-- ---------------------------------------------------------------------------
create type public.evidence_status as enum ('draft', 'in_review', 'finalized', 'rejected');

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text,
  storage_path text,
  mime_type text,
  file_size bigint,
  collected_at timestamptz,
  collected_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  status public.evidence_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index evidence_company_idx on public.evidence(company_id);
create trigger evidence_set_updated_at
  before update on public.evidence
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- evidence_controls — many-to-many tag join
-- ---------------------------------------------------------------------------
create table public.evidence_controls (
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  company_control_id uuid not null references public.company_controls(id) on delete cascade,
  tagged_by uuid references auth.users(id) on delete set null,
  tagged_at timestamptz not null default now(),
  primary key (evidence_id, company_control_id)
);
create index evidence_controls_company_control_idx on public.evidence_controls(company_control_id);

-- ---------------------------------------------------------------------------
-- recommendations
-- ---------------------------------------------------------------------------
create type public.recommendation_severity as enum ('low', 'med', 'high', 'critical');
create type public.recommendation_status as enum ('open', 'in_progress', 'resolved', 'dismissed');

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  control_id uuid references public.controls(id) on delete set null,
  severity public.recommendation_severity not null default 'med',
  summary text not null,
  details text,
  status public.recommendation_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recommendations_company_idx on public.recommendations(company_id);
create trigger recommendations_set_updated_at
  before update on public.recommendations
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- reviews — approval workflow on evidence
-- ---------------------------------------------------------------------------
create type public.review_status as enum ('pending', 'approved', 'rejected');

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  status public.review_status not null default 'pending',
  notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index reviews_evidence_idx on public.reviews(evidence_id);

-- profiles.default_company_id FK (deferred until companies table exists)
alter table public.profiles
  add constraint profiles_default_company_fk
  foreign key (default_company_id) references public.companies(id) on delete set null;

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.profiles            enable row level security;
alter table public.companies           enable row level security;
alter table public.company_members     enable row level security;
alter table public.frameworks          enable row level security;
alter table public.controls            enable row level security;
alter table public.crosswalks          enable row level security;
alter table public.company_controls    enable row level security;
alter table public.evidence            enable row level security;
alter table public.evidence_controls   enable row level security;
alter table public.recommendations     enable row level security;
alter table public.reviews             enable row level security;

-- profiles: see your own + members of any company you share with; update own
create policy profiles_select_self_or_shared
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.company_members me
      join public.company_members other on other.company_id = me.company_id
      where me.user_id = auth.uid() and other.user_id = profiles.id
    )
  );

create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- companies: members only
create policy companies_select_members
  on public.companies for select
  to authenticated
  using (public.is_company_member(id));

create policy companies_insert_authenticated
  on public.companies for insert
  to authenticated
  with check (created_by = auth.uid());

create policy companies_update_owner_admin
  on public.companies for update
  to authenticated
  using (public.has_company_role(id, array['owner','admin']::public.company_role[]))
  with check (public.has_company_role(id, array['owner','admin']::public.company_role[]));

create policy companies_delete_owner
  on public.companies for delete
  to authenticated
  using (public.has_company_role(id, array['owner']::public.company_role[]));

-- company_members
create policy company_members_select
  on public.company_members for select
  to authenticated
  using (public.is_company_member(company_id));

create policy company_members_insert_owner_admin
  on public.company_members for insert
  to authenticated
  with check (
    public.has_company_role(company_id, array['owner','admin']::public.company_role[])
    or user_id = auth.uid()
  );

create policy company_members_update_owner_admin
  on public.company_members for update
  to authenticated
  using (public.has_company_role(company_id, array['owner','admin']::public.company_role[]))
  with check (public.has_company_role(company_id, array['owner','admin']::public.company_role[]));

create policy company_members_delete_owner_admin
  on public.company_members for delete
  to authenticated
  using (public.has_company_role(company_id, array['owner','admin']::public.company_role[]));

-- frameworks, controls, crosswalks: read-only for any authenticated user
create policy frameworks_select_authenticated
  on public.frameworks for select
  to authenticated using (true);

create policy controls_select_authenticated
  on public.controls for select
  to authenticated using (true);

create policy crosswalks_select_authenticated
  on public.crosswalks for select
  to authenticated using (true);

-- company_controls
create policy company_controls_select
  on public.company_controls for select
  to authenticated
  using (public.is_company_member(company_id));

create policy company_controls_modify
  on public.company_controls for all
  to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- evidence
create policy evidence_select
  on public.evidence for select
  to authenticated
  using (public.is_company_member(company_id));

create policy evidence_modify
  on public.evidence for all
  to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- evidence_controls (scoped via parent evidence)
create policy evidence_controls_select
  on public.evidence_controls for select
  to authenticated
  using (
    exists (
      select 1 from public.evidence e
      where e.id = evidence_controls.evidence_id
        and public.is_company_member(e.company_id)
    )
  );

create policy evidence_controls_modify
  on public.evidence_controls for all
  to authenticated
  using (
    exists (
      select 1 from public.evidence e
      where e.id = evidence_controls.evidence_id
        and public.is_company_member(e.company_id)
    )
  )
  with check (
    exists (
      select 1 from public.evidence e
      where e.id = evidence_controls.evidence_id
        and public.is_company_member(e.company_id)
    )
  );

-- recommendations
create policy recommendations_select
  on public.recommendations for select
  to authenticated
  using (public.is_company_member(company_id));

create policy recommendations_modify
  on public.recommendations for all
  to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- reviews (scoped via parent evidence)
create policy reviews_select
  on public.reviews for select
  to authenticated
  using (
    exists (
      select 1 from public.evidence e
      where e.id = reviews.evidence_id
        and public.is_company_member(e.company_id)
    )
  );

create policy reviews_modify
  on public.reviews for all
  to authenticated
  using (
    exists (
      select 1 from public.evidence e
      where e.id = reviews.evidence_id
        and public.is_company_member(e.company_id)
    )
  )
  with check (
    exists (
      select 1 from public.evidence e
      where e.id = reviews.evidence_id
        and public.is_company_member(e.company_id)
    )
  );

-- =============================================================================
-- Storage: `evidence` bucket. Path convention: {company_id}/{evidence_id}/...
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

create policy evidence_objects_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidence'
    and public.is_company_member( ((storage.foldername(name))[1])::uuid )
  );

create policy evidence_objects_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'evidence'
    and public.is_company_member( ((storage.foldername(name))[1])::uuid )
  );

create policy evidence_objects_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'evidence'
    and public.is_company_member( ((storage.foldername(name))[1])::uuid )
  )
  with check (
    bucket_id = 'evidence'
    and public.is_company_member( ((storage.foldername(name))[1])::uuid )
  );

create policy evidence_objects_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'evidence'
    and public.is_company_member( ((storage.foldername(name))[1])::uuid )
  );
