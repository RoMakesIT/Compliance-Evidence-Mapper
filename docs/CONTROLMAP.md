# Adding the ControlMap baseline

The Crosswalks page is already framework-agnostic — once ControlMap controls and crosswalk rows are in the database, the existing Source/Target selectors will surface them with no UI changes.

Two ways to load the data, depending on what you have:

## Option A — CSV with a known schema

If the export gives you per-row `Secureframe Code → ControlMap Control → ControlMap Description`, drop the file at `public/seed/controlmap.csv` and we'll add a generator pass to `scripts/generate-seed.mjs` that:

1. Inserts a `controlmap` framework row.
2. Creates a control row per unique ControlMap entry under that framework.
3. Inserts a crosswalk row (`secureframe → controlmap`, `mapping_type = direct`) for every Secureframe code listed.

Then `supabase db reset` (or a `supabase migration new add_controlmap` + the same SQL) re-bakes the seed.

## Option B — manual SQL

If you just have a list, run this in Supabase Studio's SQL editor (or via psql). Adjust the inserts to match your actual data.

```sql
-- 1. Framework row
insert into public.frameworks (slug, name, version, description)
values ('controlmap', 'ControlMap Baseline', null, 'ControlMap operative control catalog.')
on conflict (slug) do nothing;

-- 2. Controls (repeat the values clause for every ControlMap control)
with f as (select id from public.frameworks where slug = 'controlmap')
insert into public.controls (framework_id, control_ref, title, description, control_type, source)
select f.id, v.ref, v.title, v.description, 'standalone'::public.control_type, 'ControlMap import'
from f, (values
  ('CM-001', 'Acceptable Use Policy', 'Maintain a published acceptable use policy reviewed annually.'),
  ('CM-002', 'Access Provisioning',   'New hires get role-based access via documented request/approval.')
  -- add more rows here
) as v(ref, title, description)
on conflict (framework_id, control_ref) do update
  set title = excluded.title,
      description = excluded.description;

-- 3. Crosswalks (Secureframe → ControlMap). Repeat per pairing.
with sf as (select id from public.controls
            where framework_id = (select id from public.frameworks where slug='secureframe')
              and control_ref = 'AC-01'),
     cm as (select id from public.controls
            where framework_id = (select id from public.frameworks where slug='controlmap')
              and control_ref = 'CM-001')
insert into public.crosswalks (source_control_id, target_control_id, mapping_type)
select sf.id, cm.id, 'direct' from sf, cm
on conflict (source_control_id, target_control_id, mapping_type) do nothing;
```

Anything that hits the schema this way persists in `db.dump` and is captured by `bin/backup.sh`, so you don't need a code change to start using ControlMap on the Crosswalks page.

## When ControlMap should drive the UI primarily

If at some point ControlMap becomes the *operative* catalog (the controls users browse on the Controls page), we'd flip the default framework slug from `secureframe` to `controlmap` in:

- `src/pages/Controls.tsx` — `SECUREFRAME_SLUG`
- `src/pages/Recommendations.tsx` — the gap-detection query
- `src/components/ControlPicker.tsx` — `fetchSecureframeOptions`
- `src/pages/Dashboard.tsx` — the catalog count query

Each is a one-line change. We can also make it a single config constant when that switch becomes likely.
