#!/bin/bash
# Weekly backup of the MongoDB Atlas database.
#
# The cluster is on Atlas's free tier, which keeps no backups at all. Atlas
# admits only the home IP, so this runs on the NAS — DSM Task Scheduler, user
# root, weekly:
#
#   bash /volume1/homes/Matthias/Drive/Programming/abstractaltitudes/scripts/backup-db.sh
#
# The export runs inside the backend container (it has the connection
# settings) and lands in backups/db/ in this project folder. That folder is in
# Synology Drive, so every backup is also copied to the Mac — and from there
# into Time Machine. backups/ is gitignored.
#
# Restore: see "Database backups" in README.md.
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/volume1/homes/Matthias/Drive/Programming/abstractaltitudes}"
CONTAINER="${CONTAINER:-abstractaltitudes-backend-1}"
KEEP="${KEEP:-12}"          # weekly files kept: about three months
MIN_DOCS="${MIN_DOCS:-50}"  # the gallery has ~120; fewer means something is wrong

OUT_DIR="${PROJECT_DIR}/backups/db"
mkdir -p "$OUT_DIR"
file="${OUT_DIR}/atlas-$(date +%Y-%m-%d).json.gz"
tmp="${file}.partial"
trap 'rm -f "$tmp"' EXIT

# pipefail: if the export fails, so does this line, and the previous backups
# are left alone. Collection counts (stderr) appear in the task result.
docker exec -e BACKUP_MIN_DOCS="$MIN_DOCS" "$CONTAINER" \
  node src/backend/tools/exportDb.mjs | gzip -9 > "$tmp"
mv "$tmp" "$file"

# Task Scheduler runs as root; hand the files to the folder's owner so
# Synology Drive syncs them like any other file.
chown --reference="$PROJECT_DIR" "$OUT_DIR" "$file" 2>/dev/null || true
echo "Saved $(basename "$file") ($(du -h "$file" | cut -f1))"

# Keep the newest $KEEP, delete the rest.
ls -1t "$OUT_DIR"/atlas-*.json.gz | tail -n +"$((KEEP + 1))" | while read -r old; do
  rm -f "$old"
  echo "Removed $(basename "$old")"
done
