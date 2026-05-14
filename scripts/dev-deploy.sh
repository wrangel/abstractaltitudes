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

# FULL UPGRADE (-u flag)
if [[ "$1" == "-u" ]]; then
  echo -e "${GREEN}🚀📦 FULL UPGRADE: Latest secure packages...${NC}"
  if command -v brew &> /dev/null; then
    brew update && brew upgrade && brew cleanup
  fi
  corepack prepare pnpm@latest --activate
  
  rm -rf node_modules pnpm-lock.yaml
  echo -e "${GREEN}📈 Updating ALL packages to LATEST...${NC}"
  pnpm up --latest
  pnpm install --ignore-scripts
  
  echo -e "${GREEN}🔒 Running security audit...${NC}"
  pnpm audit --prod --silent || true
  pnpm prune || true
else
  echo -e "${GREEN}✅ Ensuring dependencies are up to date...${NC}"
  pnpm install --ignore-scripts
fi

echo -e "\n${GREEN}🔍 RUNNING STATIC ANALYSIS${NC}"

# 1. KNIP (Unused files and exports)
echo -e "${YELLOW}Checking for unused files/exports (Knip)...${NC}"
pnpm knip --reporter json > knip-report.json 2>/dev/null || true

# 2. DEPCHECK (Unused dependencies)
echo -e "${YELLOW}Checking for unused packages (depcheck)...${NC}"
# We ignore concurrently and knip because they are CLI tools
pnpm dlx depcheck . --json --ignores="concurrently,knip,globals" > depcheck-report.json 2>/dev/null || true

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
  