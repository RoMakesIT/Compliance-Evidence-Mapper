# Local Setup (macOS)

Step-by-step setup for the Compliance Evidence Mapper on a Mac.

## Prerequisites

| Tool | Check command | Install command |
|---|---|---|
| Homebrew | `brew --version` | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |
| Git | `git --version` | `brew install git` |
| Node 20+ | `node --version` | `brew install node` |
| Docker Desktop | `docker --version` && `docker info` | `brew install --cask docker` then launch from Applications |
| Supabase CLI | `supabase --version` | `brew install supabase/tap/supabase` |
| GitHub CLI (optional) | `gh --version` | `brew install gh` |

Make sure Docker Desktop is **running** (the whale icon in the menu bar) before starting Supabase.

## One-time setup

The bootstrap script does everything below in one go. If you'd rather do it manually, the steps are listed after.

### Option A — bootstrap script (recommended)

1. Save `bootstrap.sh` to `~/Documents/Claude/Projects/Compliance compass/`
2. Open Terminal, run:
   ```bash
   cd ~/Documents/Claude/Projects/Compliance\ compass
   chmod +x bootstrap.sh
   ./bootstrap.sh
   ```
3. The script will:
   - Verify prerequisites
   - Clone the Lovable source
   - Wipe its git history and remove the committed `.env`
   - Drop in the new scaffolding (`.gitignore`, `.env.example`, `README.md`, `CLAUDE.md`, this file)
   - Initialize a fresh git repo pointing at `https://github.com/RoMakesIT/Compliance-Evidence-Mapper`
   - Run `npm install`
   - Run `supabase init`
   - Make the first commit and push to `main`

### Option B — manual steps

```bash
cd ~/Documents/Claude/Projects/Compliance\ compass

# 1. Pull the Lovable code without its git history
git clone --depth 1 https://github.com/RoMakesIT/compliance-compass.git Compliance-Evidence-Mapper
cd Compliance-Evidence-Mapper
rm -rf .git .env

# 2. Drop in the new scaffolding files (copy from the parent folder)
cp ../.gitignore ../.env.example ../README.md ../CLAUDE.md ../LOCAL_SETUP.md .

# 3. Init the new repo
git init -b main
git remote add origin https://github.com/RoMakesIT/Compliance-Evidence-Mapper.git

# 4. Install deps
npm install

# 5. Initialize Supabase locally
supabase init

# 6. First commit + push
cp .env.example .env.local
git add -A
git commit -m "chore: initial scaffolding for local dev"
git push -u origin main
```

## Daily development

### Easiest: double-click apps

After running `mac/build-apps.sh` once, three apps live in `~/Applications`:

- **Compliance Compass — Start** — launches Docker if needed, starts Supabase, runs the dev server. Opens http://localhost:8080.
- **Compliance Compass — Stop** — stops Vite and the Supabase stack.
- **Compliance Compass — Backup** — snapshots the Postgres DB + the storage bucket to `backups/<timestamp>/`. Includes a `RESTORE.md` next to each snapshot.

Drag any of them onto the Dock for a one-click on/off. Re-run `mac/build-apps.sh` after moving the project folder — the apps encode an absolute path.

### Or from the terminal

```bash
./bin/start.sh    # Docker + Supabase + Vite
./bin/stop.sh     # stops Vite + Supabase
./bin/backup.sh   # writes backups/YYYYMMDD-HHMMSS/
```

### Or by hand

```bash
supabase start      # Supabase services in Docker
npm run dev         # Vite at http://localhost:8080
# Ctrl+C, then `supabase stop` when done
```

## Working with the database

```bash
# Open Supabase Studio (local)
open http://127.0.0.1:54323

# Create a new migration
supabase migration new add_companies_table
# Edit the generated SQL file in supabase/migrations/

# Apply pending migrations to the local DB
supabase db reset      # nuclear: drops + recreates DB + applies all migrations + seed
# or, less destructive:
supabase migration up

# Regenerate TypeScript types from the local schema
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

## Backups

`./bin/backup.sh` (or the **Compliance Compass — Backup** app) writes a snapshot to `backups/<timestamp>/`:

- `db.dump` — `pg_dump -Fc` of the entire local Postgres (covers schemas `public`, `auth`, `storage`, etc.)
- `storage.tar.gz` — every file in the storage container's bucket directory
- `migrations/` — copy of the migrations that were applied at backup time
- `RESTORE.md` — paste-ready commands to restore onto a fresh stack

`backups/` is gitignored. Move them off this Mac periodically if your evidence matters — Time Machine, an external drive, or a cloud sync of just `~/compliance compass/Compliance-Evidence-Mapper/backups/`.

## Working with Claude Code

```bash
cd ~/Documents/Claude/Projects/Compliance\ compass/Compliance-Evidence-Mapper
claude        # opens Claude Code in the repo; reads CLAUDE.md automatically
```

## Troubleshooting

- **`supabase start` hangs or errors** → Docker Desktop not running. Start it from Applications, wait for the whale icon to stop animating, retry.
- **Port 54321/54322/54323 already in use** → another Supabase project is running. `supabase stop --project-id <other>` or change ports in `supabase/config.toml`.
- **Vite says port 8080 is taken** → edit `vite.config.ts` `server.port` or pass `--port` to `npm run dev`.
- **TypeScript errors after schema change** → you forgot `supabase gen types typescript --local > src/integrations/supabase/types.ts`.
- **Auth redirects break in local dev** → make sure `supabase/config.toml` has `site_url = "http://localhost:8080"` and `additional_redirect_urls` includes your dev URL.

## Azure migration (later)

Recommended target stack:

- **Frontend:** Azure Static Web Apps (free tier, GitHub Actions deploy from `main`)
- **Database:** Azure Database for PostgreSQL Flexible Server
- **Auth + Storage:** Either keep self-hosted Supabase in Azure Container Apps, or replace with Microsoft Entra External ID (auth) + Azure Blob Storage (files)

Do this after the local v0 is working end-to-end. Migrations in `supabase/migrations/` will replay onto Azure Postgres with minor adjustments.
