#!/bin/bash
set -e

# Run locally!

echo "🧹 Cleaning Vite cache..."
rm -rf node_modules/.vite dist

# Stop Docker containers
if docker info >/dev/null 2>&1; then
    echo "🛑 Stopping Docker containers and cleaning up..."
    docker compose down --rmi all && docker system prune -af
else
    echo "⚠️  Docker not running or not installed — skipping Docker cleanup."
fi

# FULL UPGRADE (-u flag)
if [[ "$1" == "-u" ]]; then
    echo "🚀📦 FULL UPGRADE: Latest secure packages..."

    # System updates
    brew update && brew upgrade && brew cleanup && brew doctor && brew autoremove
    pnpm self-update

    # Clean slate
    rm -rf node_modules pnpm-lock.yaml

    # LATEST EVERYTHING
    echo "📈 Updating ALL packages to LATEST..."
    pnpm up --latest

    # Fix React peer warning (cosmetic only)
    echo "🔧 Fixing React versions..."
    pnpm add "react@^18.3.1" "react-dom@^18.3.1" --save-exact

    # Fresh install
    pnpm install

    # PROD-ONLY SECURITY CHECK
    echo "🔒 PROD security check..."
    pnpm audit --prod --silent || true

    echo "✅ PROD deps: Latest + Secure!"

    # Cleanup
    pnpm prune || true
else
    echo "✅ Using existing deps..."
    pnpm install
fi

# Start dev servers
echo "🚀 Starting backend server..."
node --env-file=.env ./src/backend/server.mjs &

echo "🚀 Starting Vite frontend on port 3000..."
pnpm run frontend:dev

# Wait for both (Ctrl+C kills both)
wait
