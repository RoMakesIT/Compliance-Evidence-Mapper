-- =============================================================================
-- Source-system hints
-- =============================================================================
-- Adds a multi-value tag column to controls (where the evidence typically
-- lives) and a single-value source field to evidence rows (where the operator
-- says it came from). Free-text storage so the taxonomy can evolve without
-- migrations; populate from the application's curated list.
-- =============================================================================

alter table public.controls
  add column source_hints text[] not null default '{}';

alter table public.evidence
  add column source_system text;

-- GIN index so chip filters with .contains / .overlaps stay fast as the
-- catalog grows.
create index if not exists controls_source_hints_idx
  on public.controls using gin (source_hints);
