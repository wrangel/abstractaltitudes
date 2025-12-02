#!/bin/bash
set -e

# Run locally!

echo "🧹 Cleaning Vite cache..."
rm -rf node_modules/.vite dist

# Remove Docker containers if Docker is running
if docker info >/dev/null 2>&1; then
    echo "Stopping Docker containers and cleaning up..."
    docker compose down --rmi all && docker system prune -af
else
    echo "⚠️  Docker not running or not installed — skipping Docker cleanup."
fi

# Check for the -u flag to update dependencies
if [[ "$1" == "-u" ]]; then
    echo "📦 Updating dependencies..."

    pnpm self-update

    # Update all dependencies to latest allowed by package.json
    pnpm update

    # Force latest for Vite and its plugins (ensure compatibility)
    pnpm update vite @vitejs/plugin-react vite-plugin-eslint eslint eslint-plugin-react globals

    # Clean and reinstall to ensure lockfile and node_modules match
    rm -rf node_modules pnpm-lock.yaml
    pnpm install

    # Security and cleanup
    pnpm audit fix
    pnpm prune
    pnpm depcheck --ignores="exif,exifreader,node-exif,vite-plugin-eslint"
else
    echo "✅ Skipping dependency updates..."
fi

# Start the backend server
echo "🚀 Starting backend server..."
node --env-file=.env ./src/backend/server.mjs &

# Start the frontend Vite dev server
echo "🚀 Starting Vite frontend on port 3000..."
pnpm run frontend:dev

# Wait for both processes to finish (Ctrl+C will kill both)
wait
