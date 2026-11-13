#!/usr/bin/env bash
# SAWMILL PRO — database backup. Run daily from cron (see docs/DEPLOYMENT.md):
#   15 1 * * *  sawmill  /opt/sawmill/deploy/backup/sawmill-backup.sh >> /var/log/sawmill/backup.log 2>&1
#
# What it does:
#   1. pg_dump (custom format, compressed) into $BACKUP_DIR/daily/
#   2. checks the file is a readable dump (pg_restore --list) — a broken dump fails loudly
#   3. keeps a weekly copy (Sunday) and a monthly copy (1st of the month)
#   4. deletes old copies: 14 daily, 8 weekly, 12 monthly by default
#   5. optional: encrypts with GPG and copies off the server with rclone
#
# Settings come from /etc/sawmill/backup.env (or the file in $SAWMILL_BACKUP_ENV):
#   DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD   — same database as the API
#   BACKUP_DIR=/var/backups/sawmill
#   KEEP_DAILY=14 KEEP_WEEKLY=8 KEEP_MONTHLY=12
#   GPG_RECIPIENT=owner@example.in    (optional: encrypt off-site copies to this public key)
#   RCLONE_REMOTE=gdrive:sawmill-backups  (optional: off-site copy; set up with `rclone config`)
set -euo pipefail
umask 077

ENV_FILE="${SAWMILL_BACKUP_ENV:-/etc/sawmill/backup.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${DB_NAME:?DB_NAME is not set}" "${DB_USER:?DB_USER is not set}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/sawmill}"
KEEP_DAILY="${KEEP_DAILY:-14}"
KEEP_WEEKLY="${KEEP_WEEKLY:-8}"
KEEP_MONTHLY="${KEEP_MONTHLY:-12}"
export PGPASSWORD="${DB_PASSWORD:-}"

log() { echo "$(date '+%F %T') $*"; }
die() { log "BACKUP FAILED: $*"; exit 1; }

mkdir -p "$BACKUP_DIR"/{daily,weekly,monthly}
stamp="$(date +%Y-%m-%d_%H%M)"
file="$BACKUP_DIR/daily/${DB_NAME}_${stamp}.dump"
tmp="$file.partial"

log "dumping $DB_NAME@$DB_HOST:$DB_PORT"
pg_dump --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" --dbname="$DB_NAME" \
  --format=custom --compress=6 --no-owner --no-privileges --file="$tmp" || { rm -f "$tmp"; die "pg_dump"; }

# A dump that can't be listed can't be restored either.
tables=$(pg_restore --list "$tmp" | grep -c ' TABLE DATA ' || true)
[[ "$tables" -gt 0 ]] || { rm -f "$tmp"; die "dump has no table data"; }
mv "$tmp" "$file"
sha256sum "$file" > "$file.sha256"
log "ok: $file ($(du -h "$file" | cut -f1), $tables tables)"

# Weekly (Sunday) and monthly (1st) copies are hard links: no extra disk space.
[[ "$(date +%u)" == 7 ]] && ln -f "$file" "$BACKUP_DIR/weekly/" && ln -f "$file.sha256" "$BACKUP_DIR/weekly/"
[[ "$(date +%d)" == 01 ]] && ln -f "$file" "$BACKUP_DIR/monthly/" && ln -f "$file.sha256" "$BACKUP_DIR/monthly/"

prune() { # keep the newest N dumps in a folder
  local dir="$1" keep="$2"
  # (an empty folder is fine: `|| true` keeps pipefail from stopping the script)
  { ls -1t "$dir"/*.dump 2>/dev/null || true; } | tail -n +"$((keep + 1))" | while read -r old; do
    rm -f "$old" "$old.sha256"
    log "removed old $old"
  done
}
prune "$BACKUP_DIR/daily" "$KEEP_DAILY"
prune "$BACKUP_DIR/weekly" "$KEEP_WEEKLY"
prune "$BACKUP_DIR/monthly" "$KEEP_MONTHLY"

# Off-site copy: a backup on the same disk doesn't survive a dead disk or a stolen server.
if [[ -n "${RCLONE_REMOTE:-}" ]]; then
  upload="$file"
  if [[ -n "${GPG_RECIPIENT:-}" ]]; then
    upload="$file.gpg"
    gpg --batch --yes --trust-model always --recipient "$GPG_RECIPIENT" --output "$upload" --encrypt "$file" || die "gpg"
  fi
  rclone copy "$upload" "$RCLONE_REMOTE/" || die "rclone copy to $RCLONE_REMOTE"
  [[ "$upload" != "$file" ]] && rm -f "$upload"
  # off-site retention: same number of days as the daily copies, plus the monthly ones on the server
  rclone delete "$RCLONE_REMOTE/" --min-age "$((KEEP_DAILY + 1))d" || log "warning: off-site cleanup failed"
  log "off-site copy: $RCLONE_REMOTE/$(basename "$upload")"
fi

log "done"
