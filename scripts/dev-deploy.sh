#!/bin/bash
set -e

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧹 Cleaning Vite cache...${NC}"
rm -rf node_modules/.vite dist

# Stop Docker containers (safer)
if docker info >/dev/null 2>&1; then
  echo -e "${GREEN}🛑 Stopping Docker containers...${NC}"
  docker compose down --volumes --rmi local
else
  echo -e "${YELLOW}⚠️  Docker not running — skipping.${NC}"
fi

# ==============================================================================
# DEPENDENCY MANAGEMENT (Sandboxed to prevent edge-version warnings from killing the script)
# ==============================================================================
set +e # Temporarily disable strict error checking

# No `pnpm self-update` here: it rewrote packageManager in package.json as a
# side effect of starting a dev server, which is how pnpm jumped 11 -> 12
# unreviewed. Renovate now proposes pnpm bumps as PRs like any other dependency.
#
# pnpm-workspace.yaml sets pmOnFail: ignore, so pnpm no longer enforces that pin
# itself — this line is the local reminder instead.
WANT_PNPM=$(node -p "require('./package.json').packageManager.split('@')[1]" 2>/dev/null)
HAVE_PNPM=$(pnpm -v 2>/dev/null)
if [[ -n "$WANT_PNPM" && "$HAVE_PNPM" != "$WANT_PNPM" ]]; then
  echo -e "${YELLOW}⚠️  pnpm $HAVE_PNPM installed, project pins $WANT_PNPM. Fine for dev; to match: npm i -g pnpm@$WANT_PNPM${NC}"
fi

echo -e "${GREEN}✅ Ensuring dependencies are up to date...${NC}"
pnpm install --ignore-scripts

echo -e "${GREEN}🔒 Running security audit...${NC}"
pnpm audit --prod --silent || true

# The old `-u` flag upgraded Homebrew AND deleted pnpm-lock.yaml before running
# `pnpm up --latest`. Both are gone on purpose:
#
#   • Dockerfile.* and ci.yml install with --frozen-lockfile, so the lockfile
#     decides what ships. Regenerating it unreviewed meant production got
#     whatever was newest that morning.
#   • Dependency updates now arrive as Dependabot PRs (.github/dependabot.yml)
#     that CI has actually run the tests against.
#   • Homebrew is per-machine maintenance, not part of starting a dev server —
#     upgrading it here could swap ImageMagick out from under the uploader
#     mid-session. Use scripts/update-mac.sh instead.
if [[ "$1" == "-u" ]]; then
  echo -e "${YELLOW}ℹ️  -u no longer upgrades anything.${NC}"
  echo -e "${YELLOW}   Dependencies → Dependabot PRs on GitHub.${NC}"
  echo -e "${YELLOW}   Homebrew     → ./scripts/update-mac.sh${NC}"
fi

set -e # Re-enable strict error checking for static analysis and servers
# ==============================================================================

echo -e "\n${GREEN}🔍 RUNNING STATIC ANALYSIS${NC}"

# 1. KNIP (Run local package bin directly since it is in dependencies)
echo -e "${YELLOW}Checking for unused files/exports (Knip)...${NC}"
pnpm knip --reporter json > knip-report.json 2>/dev/null || true

# 2. DEPCHECK (Force '--yes' flag to prevent interactive download prompt hang)
echo -e "${YELLOW}Checking for unused packages (depcheck)...${NC}"
pnpm --yes dlx depcheck . --json --ignores="concurrently,knip,globals" > depcheck-report.json 2>/dev/null || true

# SUMMARY SECTION
if command -v jq &> /dev/null; then
  # Parse Knip
  if [[ -s knip-report.json ]]; then
    FILES=$(jq '.files | length' knip-report.json 2>/dev/null || echo 0)
    [[ $FILES -gt 0 ]] && echo -e "${RED}🗑️  $FILES UNUSED FILES detected (see knip-report.json)${NC}"
  fi
  
  # Parse Depcheck
  if [[ -s depcheck-report.json ]]; then
    UNUSED_DEPS=$(jq '.dependencies | length' depcheck-report.json 2>/dev/null || echo 0)
    MISSING_DEPS=$(jq '.missing | length' depcheck-report.json 2>/dev/null || echo 0)
    [[ $UNUSED_DEPS -gt 0 ]] && echo -e "${RED}📦 $UNUSED_DEPS UNUSED dependencies${NC}"
    [[ $MISSING_DEPS -gt 0 ]] && echo -e "${RED}⚠️  $MISSING_DEPS MISSING dependencies${NC}"
  fi
else
  echo -e "${YELLOW}📄 Reports saved to json. Install 'jq' for a terminal summary.${NC}"
fi

# Start dev servers
echo -e "\n${GREEN}🚀 Starting dev servers...${NC}"
if ! pnpm list concurrently >/dev/null 2>&1; then
  echo -e "${RED}❌ Error: concurrently not found. Run: pnpm add -D concurrently${NC}"
  exit 1
fi

pnpm concurrently \
  --kill-others \
  --prefix "[{name}]" \
  --names "BACKEND,FRONTEND" \
  --prefix-colors "yellow,cyan" \
  "node --env-file=.env ./src/backend/server.mjs" \
  "pnpm run frontend:dev"
