# CLAUDE.md

Guardrails and context for Claude Code working in this repo.

## Project

Compliance Evidence Mapper — local-first React app for tracking compliance controls and supporting evidence across multiple frameworks (SOC 2, HIPAA, ISO 27001, NIST CSF).

Originated from a Lovable.dev scaffold. Lovable's GitHub integration is **not** connected to this repo — this repo is locally owned. Do not add Lovable-specific tooling back in.

## Stack

- **Build:** Vite 5 (`@vitejs/plugin-react-swc`)
- **UI:** React 18, TypeScript, shadcn/ui, Tailwind CSS, lucide-react
- **State/data:** TanStack Query, React Hook Form + Zod
- **Routing:** React Router v6
- **Backend:** Supabase (local via Docker for dev; Azure target later)
- **Tests:** Vitest + Testing Library

## Commands

```bash
npm run dev           # Vite dev server on http://localhost:8080
npm run build         # production build
npm run build:dev     # development-mode build
npm run lint          # ESLint
npm run test          # vitest run (one-shot)
npm run test:watch    # vitest watch mode

supabase start        # boot local Supabase stack (Docker)
supabase stop         # stop local stack
supabase status       # show running services + keys
supabase db reset     # drop + reapply all migrations + seed
supabase migration new <name>      # create new migration
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

## Repo layout

```
src/
  pages/                     # route-level views (Dashboard, Evidence, Controls, ...)
  components/
    ui/                      # shadcn/ui primitives — do not hand-edit, regenerate via CLI
    Layout.tsx, NavLink.tsx, PageHeader.tsx
  integrations/supabase/
    client.ts                # supabase singleton — env-driven
    types.ts                 # AUTO-GENERATED — do not hand-edit
  test/                      # vitest setup
supabase/
  config.toml                # local stack config
  migrations/                # versioned SQL migrations (source of truth for schema)
  seed.sql                   # optional seed data
```

## Conventions

### Commits

- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`
- Subject ≤ 72 chars, imperative mood
- **Do not include any AI / Claude attribution.** No `Co-Authored-By: Claude`, no "Generated with Claude Code", no tool footers, no emoji unless explicitly requested by the user
- Keep commits focused; one logical change per commit

### Branching

- `main` — protected, deployable
- `feat/<short-name>` — new features
- `fix/<short-name>` — bug fixes
- `chore/<short-name>` — tooling, deps, refactors with no behavior change
- Squash-merge to main; delete branch after

### Code style

- TypeScript strict mode is on (where Vite/tsconfig allows). Don't loosen it without discussion
- Components: function components with hooks; default exports for pages, named exports for shared components
- Path alias `@/` → `src/`
- Tailwind utility-first; extract into components only when reused or when classes get unwieldy
- Forms: React Hook Form + Zod resolver. Schemas live next to the form

### Supabase

- **Schema source of truth = `supabase/migrations/`**. Never make schema changes via Studio without then capturing them as a migration (`supabase db diff`)
- After schema changes, regenerate types: `supabase gen types typescript --local > src/integrations/supabase/types.ts`
- All tables get RLS enabled. Multi-tenant queries are scoped by `company_id` via policies
- Storage buckets for evidence files; never store raw files in tables
- `src/integrations/supabase/client.ts` is the only place that calls `createClient`

### Secrets

- `.env.local` only; never commit
- Anon publishable key is safe to share (it's gated by RLS) but still don't commit it
- Service-role keys never appear in this repo

### Testing

- Unit tests next to the file under test: `Foo.tsx` + `Foo.test.tsx`
- Vitest + Testing Library for component tests
- Aim for tests on data transforms, form validation, and route guards. Don't snapshot-test entire pages

## Things to avoid

- Don't reintroduce `lovable-tagger` if it gets removed; it's optional
- Don't hand-edit `src/integrations/supabase/types.ts` — regenerate
- Don't commit `.env`, `.env.local`, `node_modules`, `dist`, `.supabase/`
- Don't bypass RLS by using the service-role key in the frontend
- Don't add new dependencies without checking bundle impact for things in the hot path

## Open questions / TODO

- [ ] v0 schema design (companies, frameworks, controls, evidence, etc.)
- [ ] Auth flow (Supabase Auth — email magic link vs OAuth)
- [ ] Evidence storage bucket policies
- [ ] Azure deployment target decision (Static Web Apps + Azure DB for Postgres vs Container Apps)
