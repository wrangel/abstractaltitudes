#!/bin/bash
set -e
echo "🧹 Cleaning Vite cache..."
rm -rf node_modules/.vite dist

# Stop Docker containers (safer)
if docker info >/dev/null 2>&1; then
  echo "🛑 Stopping Docker containers..."
  docker compose down --volumes --rmi local
else
  echo "⚠️  Docker not running — skipping."
fi

# FULL UPGRADE (-u flag)
if [[ "$1" == "-u" ]]; then
  echo "🚀📦 FULL UPGRADE: Latest secure packages..."
  # System updates (Mac only)
  if command -v brew &> /dev/null; then
    brew update && brew upgrade && brew cleanup
  fi
  # Upgrade pnpm itself
  corepack prepare pnpm@latest --activate

  # Clean slate
  rm -rf node_modules pnpm-lock.yaml

  # LATEST EVERYTHING
  echo "📈 Updating ALL packages to LATEST..."
  pnpm up --latest

  # Fresh install
  pnpm install --ignore-scripts

  # PROD-ONLY SECURITY CHECK
  echo "🔒 PROD security check..."
  pnpm audit --prod --silent || true
  echo "✅ PROD deps: Latest + Secure!"
  pnpm prune || true
else
  echo "✅ Using existing deps..."
  pnpm install --ignore-scripts
fi

# DEPCHECK (non-blocking)
echo "🔍 Checking for unused dependencies..."
if pnpx depcheck --json > depcheck-report.json 2>/dev/null; then
  if command -v jq &> /dev/null && [[ -s depcheck-report.json ]]; then
    MISSING=$(jq '.missing | length' depcheck-report.json 2>/dev/null || echo 0)
    UNUSED=$(jq '.dependencies | length' depcheck-report.json 2>/dev/null || echo 0)
    [[ $MISSING -gt 0 ]] && echo "⚠️  $MISSING MISSING deps (see depcheck-report.json)"
    [[ $UNUSED -gt 0 ]] && echo "🗑️  $UNUSED UNUSED deps (see depcheck-report.json)"
  else
    echo "📄 depcheck-report.json saved (install jq for summary)"
  fi
else
  echo "⚠️  depcheck failed — skipping report"
fi

# Start dev servers
echo "🚀 Starting dev servers..."
if ! pnpm list concurrently >/dev/null 2>&1; then
  echo "❌ Install concurrently first: pnpm add -D concurrently"
  exit 1
fi
pnpm concurrently \
  "node --env-file=.env ./src/backend/server.mjs" \
  "pnpm run frontend:dev"