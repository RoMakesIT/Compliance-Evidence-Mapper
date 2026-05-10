#!/usr/bin/env bash
# Start Compliance Evidence Mapper locally:
#   1. Ensure Docker Desktop is running (launch it if not)
#   2. Start the Supabase stack if it isn't already up
#   3. Run the Vite dev server in the foreground
# Quit the Terminal window or hit Ctrl+C to stop the dev server. Supabase
# keeps running in Docker — use bin/stop.sh (or the Stop app) to shut it down.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

c_grn='\033[0;32m'; c_yel='\033[0;33m'; c_red='\033[0;31m'; c_rst='\033[0m'
say()  { printf "${c_grn}==>${c_rst} %s\n" "$*"; }
warn() { printf "${c_yel}WARN:${c_rst} %s\n" "$*"; }
die()  { printf "${c_red}ERROR:${c_rst} %s\n" "$*" >&2; exit 1; }

# Make sure we can find brew-installed binaries when launched from Finder/.app
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# 1) Docker
if ! docker info >/dev/null 2>&1; then
  say "Docker not running — launching Docker Desktop"
  open -a Docker
  printf "Waiting for Docker to come up"
  for _ in $(seq 1 60); do
    if docker info >/dev/null 2>&1; then printf "\n"; break; fi
    printf "."
    sleep 1
  done
  if ! docker info >/dev/null 2>&1; then
    die "Docker did not start within 60s. Open Docker Desktop manually and rerun."
  fi
fi

# 2) Supabase
if supabase status >/dev/null 2>&1; then
  say "Supabase already running"
else
  say "Starting Supabase"
  supabase start
fi

# 3) Vite (foreground)
say "Starting Vite at http://localhost:8080"
npm run dev
