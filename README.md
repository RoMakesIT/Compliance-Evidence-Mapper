# Compliance Evidence Mapper

Local-first compliance evidence tracking app. Maps compliance controls across frameworks (SOC 2, HIPAA, ISO 27001, NIST CSF) and tracks supporting evidence per company.

## Stack

- Vite 5 + React 18 + TypeScript
- shadcn/ui + Tailwind CSS
- TanStack Query, React Router, React Hook Form + Zod
- Supabase (local via Docker)
- Vitest

## Quickstart

See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for the full Mac setup runbook.

```bash
cp .env.example .env.local
supabase start
npm install
npm run dev
```

App runs at http://localhost:8080.

## Roadmap

- v0: Local Supabase + initial schema (companies, frameworks, controls, evidence)
- v1: Auth + multi-tenant RLS + evidence storage
- v2: Crosswalks + recommendations workflow
- v3: Azure deployment (Static Web Apps + Azure Database for PostgreSQL)
