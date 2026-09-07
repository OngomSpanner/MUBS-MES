#!/bin/bash
# Import a MySQL dump into mubs_super_admin.
# Skips if tables already exist unless FORCE=1.
#   DUMP=/path/to/backup.sql.gz bash /var/www/mubsme/deploy/import-db.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/mubsme}"
DUMP="${DUMP:-$APP_DIR/backups/mubs_super_admin.sql.gz}"
cd "$APP_DIR"

if [ ! -f "$DUMP" ]; then
  echo "Dump not found: $DUMP"
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

docker compose up -d db
for i in $(seq 1 60); do
  if docker compose exec -T db mysqladmin ping -h 127.0.0.1 -uroot -p"${MYSQL_ROOT_PASSWORD}" --silent; then
    break
  fi
  sleep 2
done

table_count="$(docker compose exec -T db mysql -N -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='mubs_super_admin';")"
table_count="${table_count//[^0-9]/}"
if [ "${table_count:-0}" -gt 0 ] && [ "${FORCE:-0}" != "1" ]; then
  echo "mubs_super_admin already has ${table_count} tables; skip import (FORCE=1 to replace)."
  exit 0
fi

echo "Importing ${DUMP}..."
case "$DUMP" in
  *.gz) gzip -dc "$DUMP" | docker compose exec -T db mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" --default-character-set=utf8mb4 ;;
  *) docker compose exec -T db mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" --default-character-set=utf8mb4 < "$DUMP" ;;
esac

# Ensure app user can access restored objects
docker compose exec -T db mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "
GRANT ALL PRIVILEGES ON mubs_super_admin.* TO 'mubsme'@'%';
FLUSH PRIVILEGES;
"

docker compose exec -T db mysql -N -uroot -p"${MYSQL_ROOT_PASSWORD}" mubs_super_admin -e "
SELECT COUNT(*) AS users FROM users;
SELECT COUNT(*) AS departments FROM departments;
SELECT COUNT(*) AS evaluations FROM evaluations;
"
echo IMPORT_OK
