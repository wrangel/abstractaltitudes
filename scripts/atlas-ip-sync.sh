#!/bin/bash
# Keeps the MongoDB Atlas IP access list on the home connection's current IP.
#
# Atlas admits only the home IP (since 2026-11-18), and that IP is dynamic.
# If it changes, this adds the new one and — once Atlas reports it active —
# removes the old one. Only the entry commented "Home (NAS + Mac)" is managed.
#
# DSM Task Scheduler, user root, hourly:
#
#   bash /volume1/homes/Matthias/Drive/Programming/abstractaltitudes/scripts/atlas-ip-sync.sh
#
# Credentials live in env.atlas next to env.production (gitignored, synced by
# Synology Drive): ATLAS_PROJECT_ID, ATLAS_CLIENT_ID, ATLAS_CLIENT_SECRET.
# A separate file, so the backend server itself never sees them.
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/volume1/homes/Matthias/Drive/Programming/abstractaltitudes}"
CONTAINER="${CONTAINER:-abstractaltitudes-backend-1}"
ENV_FILE="${PROJECT_DIR}/env.atlas"

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

# The backend container has Node and runs on the host network, so the IP it
# sees is the NAS's. It is a short-lived process; the server is untouched.
docker exec --env-file "$ENV_FILE" "$CONTAINER" node src/backend/tools/atlasAccessSync.mjs
