#!/bin/bash
# Pull main and rebuild the app. Does not recreate MySQL or re-import dumps.
#   bash /var/www/mubsme/deploy/update.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/mubsme}"
cd "$APP_DIR"

git fetch origin
git pull --ff-only origin main

docker builder prune -f --filter until=24h >/dev/null 2>&1 || true
docker compose up -d --build --no-deps app
docker compose ps
curl -fsS "http://127.0.0.1:3053/api/health"
echo
echo "mubsme is up at $(git rev-parse --short HEAD)"
