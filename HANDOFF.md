# Handoff

A live snapshot of where this project stands and what's next. Update this when shipping a meaningful chunk so the next session (mine or anyone else's) starts oriented.

## Where we are

The app is functionally complete for the local "single-operator evidence-mapping" workflow. Every page in the sidebar reads from Supabase Postgres (no localStorage left) and is filterable. Schema and seed are stable; recent migrations are additive only.

Last verified end-to-end: 2026-05-10, all 12 checklist items in [LOCAL_SETUP.md](./LOCAL_SETUP.md) passed.

### What you can do in the app today

1. **Sign up / sign in** with email + password (no email confirmation locally)
2. **Companies** — create, switch active workspace; auto-becomes owner on create
3. **Controls** (153 Secureframe controls) — search, filter by domain / parent-child / evidence-state / SOC 2 ref / source-system chips, click a row for a side sheet with description, recommendation, likely sources, keywords, and tagged evidence
4. **Evidence** — upload (file optional), title/description/source-system, edit, delete, tag to controls via a picker that suggests by keyword overlap + source-system match
5. **Mappings** — flat matrix of every (control, evidence) pair, filterable, CSV export
6. **Recommendations** — "Draft from Gaps" seeds rows for every control without tagged evidence; status/severity/source filters; CSV export
7. **Crosswalks** — read-only browser over the 885 seeded crosswalks (Secureframe → SOC 2 / CIS IG1), framework + domain + mapping-type filters
8. **Dashboard** — live counts for the active workspace
9. **Settings** — profile, workspace info, sign-out

### What's plugged in under the hood

- 11 tables, RLS on every one, all multi-tenant scoped via `is_company_member(company_id)`
- `evidence` storage bucket private; path convention `{company_id}/{evidence_id}/{filename}`, storage RLS mirrors company membership
- 8-value source taxonomy in [src/lib/source-systems.ts](./src/lib/source-systems.ts) (M365, Azure, Intune, Entra ID, KnowBe4, Access Reviews, Policy Doc, Upload). Controls have multi-value `source_hints` populated by a heuristic classifier from the Secureframe CSV; evidence has a single `source_system` set by the operator.
- ControlPicker boosts suggestions by +2 when evidence's source matches a control's hint.
- `create_company` RPC handles the auto-membership round-trip that vanilla `INSERT...RETURNING` can't do under RLS.

## Operating the project

### Daily

Double-click **Compliance Compass — Start.app** (in `~/Applications` after running `mac/build-apps.sh` once). Or `./bin/start.sh`. Or run `supabase start && npm run dev` by hand.

Stop: the Stop app, or `./bin/stop.sh`.

### Before any schema work

Always run `./bin/backup.sh` first. Snapshot lands under `backups/<timestamp>/` with `db.dump`, `storage.tar.gz`, applied migrations, and a paste-ready `RESTORE.md`.

### Hard rules (full list in [CLAUDE.md](./CLAUDE.md))

- **Never** run `supabase db reset` against populated data. Use `supabase migration up` instead. Re-seed via in-migration `INSERT … ON CONFLICT DO UPDATE`, not `seed.sql`.
- Schema source of truth is `supabase/migrations/`. Never edit `src/integrations/supabase/types.ts` by hand.
- All tables get RLS enabled. Multi-tenant queries scoped by `company_id`.
- Conventional Commits. No AI attribution. No emoji unless explicitly asked.

## What's next (in priority order)

Numbers below are calibrated to this codebase, not generic estimates.

### 1. LLM-assisted evidence review + suggestions — `~7-10h · $10-25/mo`

Two flows:
- **Suggest evidence for this control given the company's tech stack** — button on ControlSheet; LLM returns specific actions tailored to whatever the company uses (M365 export, Intune compliance policy, manual attestation, etc.) plus acceptance criteria
- **Review this evidence** — button on Evidence rows; LLM returns Sufficient / Partial / Insufficient per tagged control with what's missing

Prerequisite: add `companies.tech_stack text[]` and a multi-select UI to set it. Without this grounding, the LLM gives generic advice and adds little value.

Architecture: Supabase Edge Function (Deno) calling Anthropic Claude Sonnet 4.5; port to Azure Function during Azure deploy (~1-2h).

### 2. Azure deployment — `~10-14h · ~$25-45/mo` (well inside the $150 MSDN credit)

Plan is written and approved: `/Users/ro/.claude/plans/robust-frolicking-kurzweil.md`. Architecture is Azure Static Web Apps (free) + Azure Container Apps (gotrue, postgrest, storage-api, nginx gateway) + Azure DB for PostgreSQL Flexible Server B1ms + Azure Blob Storage.

Two-phase build:
- **Phase 1 (~6-8h, local-only):** Bicep templates + GitHub Actions workflow + a production-shaped docker-compose to validate everything end-to-end before any Azure resource exists
- **Phase 2 (~4-6h, in Azure):** apply Bicep, run migrations, deploy, smoke test, first backup

Decisions already locked: skip email confirmation, launch on `*.azurestaticapps.net`, clean-start data (no migration from local). Don't re-litigate.

### 3. ControlMap baseline import — when Robina has the catalog

Detailed instructions in [docs/CONTROLMAP.md](./docs/CONTROLMAP.md). Crosswalks page is already framework-agnostic; just needs data. Two onboarding paths (CSV via `scripts/generate-seed.mjs`, or manual SQL). No UI changes needed.

### 4. `bin/safe-migrate.sh` wrapper — `~30 min`

Single command that runs backup → `supabase migration up` → regenerate types. Surface as a fourth `.app` bundle. Robina explicitly asked to keep this on the list.

### Lower priority / not asked for yet

- **Test-style grouping (Secureframe "Tests" pattern):** named operational bundles of controls. ~half-day. Robina liked the simplicity but didn't ask to build.
- **Bulk evidence upload:** drag-folder, parallel uploads. ~1-1.5h. Robina said "not necessary for now".
- **PDF/DOCX text extraction for keyword auto-suggest:** ~2-3h. Worth it only if the cheap title-only path proves too weak on real evidence.

## Critical files

- [CLAUDE.md](./CLAUDE.md) — guardrails, conventions, hard rules
- [LOCAL_SETUP.md](./LOCAL_SETUP.md) — daily ops and the 12-step verification checklist
- [docs/CONTROLMAP.md](./docs/CONTROLMAP.md) — ControlMap onboarding plan
- [scripts/generate-seed.mjs](./scripts/generate-seed.mjs) — Secureframe CSV → seed SQL, including the source-hint heuristic classifier
- [src/lib/source-systems.ts](./src/lib/source-systems.ts) — taxonomy constant (edit here to change values everywhere)
- [supabase/migrations/](./supabase/migrations/) — source of truth for schema
- [bin/backup.sh](./bin/backup.sh) — pg_dump + storage tarball + RESTORE.md
- [mac/build-apps.sh](./mac/build-apps.sh) — regenerates the `~/Applications` launcher bundles

## Past incidents worth remembering

- **`db reset` wiped Robina's first evidence test on 2026-05-10.** Migration was additive; `migration up` would have worked. Rule baked into CLAUDE.md. After the wipe, Robina's stale JWT pointed at a non-existent `auth.users` row, so creates failed on FK until logout cleared the token.
- **Silent state changes feel broken.** The first Companies page made rows clickable to set active, but with no visual feedback. Fixed by adding badge + button + toast. Apply the lesson to any future UI work.
