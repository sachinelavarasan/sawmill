#!/usr/bin/env bash
# TimberTrail — restore a backup.
#
#   sawmill-restore.sh <file.dump>                 restore into a NEW database (safe; for checking a backup)
#   sawmill-restore.sh <file.dump> --replace       replace the live database (stops the API first)
#
# Encrypted off-site copies (.dump.gpg) are decrypted first with: gpg --output x.dump --decrypt x.dump.gpg
# Settings: same /etc/sawmill/backup.env as the backup script. The database user needs CREATEDB
# (docs/DEPLOYMENT.md creates it that way). --replace also stops/starts the service, so run it with sudo.
set -euo pipefail

ENV_FILE="${SAWMILL_BACKUP_ENV:-/etc/sawmill/backup.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

dump="${1:-}"
mode="${2:-}"
[[ -f "$dump" ]] || { echo "usage: $0 <file.dump> [--replace]"; exit 1; }
: "${DB_NAME:?DB_NAME is not set}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
export PGPASSWORD="${DB_PASSWORD:-}"
pg=(--host="$DB_HOST" --port="$DB_PORT")
[[ -n "${DB_USER:-}" ]] && pg+=(--username="$DB_USER")

if [[ -f "$dump.sha256" ]]; then
  sha256sum --check --status "$dump.sha256" || { echo "checksum does not match: $dump is damaged"; exit 1; }
  echo "checksum ok"
fi
pg_restore --list "$dump" > /dev/null || { echo "$dump is not a readable dump"; exit 1; }

restore_into() {
  createdb "${pg[@]}" --owner="${DB_OWNER:-${DB_USER:-sawmill}}" "$1"
  pg_restore "${pg[@]}" --dbname="$1" --no-owner --role="${DB_OWNER:-${DB_USER:-sawmill}}" --exit-on-error "$dump"
}

if [[ "$mode" != "--replace" ]]; then
  target="${DB_NAME}_restore_$(date +%Y%m%d_%H%M)"
  echo "restoring into new database $target …"
  restore_into "$target"
  echo
  psql "${pg[@]}" --dbname="$target" --tuples-only --command \
    "select 'import loads: ' || count(*) from import_loads union all
     select 'exports: '      || count(*) from export_loads union all
     select 'users: '        || count(*) from users union all
     select 'last audit entry: ' || coalesce(max(created_at)::text, '-') from audit_logs"
  echo "Restored into $target. Compare the numbers with the live app, then drop it:"
  echo "  dropdb ${pg[*]} $target"
  exit 0
fi

echo "This REPLACES the live database '$DB_NAME' with $dump."
echo "Everything entered after that backup was taken will be lost."
read -r -p "Type the database name to continue: " answer
[[ "$answer" == "$DB_NAME" ]] || { echo "cancelled"; exit 1; }

systemctl stop sawmill-api || echo "warning: could not stop sawmill-api (not running?)"
old="${DB_NAME}_before_restore_$(date +%Y%m%d_%H%M)"
# keep the current database instead of dropping it, until the restore is confirmed good
psql "${pg[@]}" --dbname=postgres --command "ALTER DATABASE \"$DB_NAME\" RENAME TO \"$old\""
restore_into "$DB_NAME"
systemctl start sawmill-api
echo "Restored. The previous database is kept as '$old' — drop it once you have checked the app:"
echo "  dropdb ${pg[*]} $old"
