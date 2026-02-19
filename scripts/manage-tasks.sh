#!/bin/bash

# Run locally!

# --- defaults
DRY_RUN=false

# --- parse CLI
while getopts "n" opt; do
  case $opt in
    n) DRY_RUN=true ;;
    *) echo "Usage: $0 [-n] {keep-books|handle-media}"; exit 1 ;;
  esac
done
shift $((OPTIND-1))   # remove the flag(s) so $1 becomes the command

# --- helpers
keep_books() {
  echo "Keeping books..."
  node --env-file=.env ./src/management/keepBooks.mjs
}

handle_media() {
  echo "Uploading media... DRY_RUN=$DRY_RUN"
  if [ "$DRY_RUN" = true ]; then
    echo "→ Dry run mode"
    NODE_DRY_RUN=1 node --env-file=.env ./src/management/uploader/orchestrate.mjs
  else
    echo "→ Live upload mode" 
    node --env-file=.env ./src/management/uploader/orchestrate.mjs
  fi
}

# --- dispatch
case "$1" in
  keep-books) keep_books ;;
  handle-media) handle_media ;;
  *) echo "Usage: $0 [-n] {keep-books|handle-media}"; exit 1 ;;
esac