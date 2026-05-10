#!/usr/bin/env bash
# Stop Supabase and any local Vite dev server.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

c_grn='\033[0;32m'; c_yel='\033[0;33m'; c_rst='\033[0m'
say()  { printf "${c_grn}==>${c_rst} %s\n" "$*"; }
warn() { printf "${c_yel}WARN:${c_rst} %s\n" "$*"; }

# Kill the Vite dev server if any (started via npm run dev)
if pgrep -f "vite" >/dev/null 2>&1; then
  say "Stopping Vite"
  pkill -f "vite" || true
fi

if ! docker info >/dev/null 2>&1; then
  warn "Docker isn't running, nothing to stop on the Supabase side."
  exit 0
fi

if supabase status >/dev/null 2>&1; then
  say "Stopping Supabase"
  supabase stop
else
  warn "Supabase wasn't running."
fi

say "Done. Press any key to close."
read -n 1 -s -r
