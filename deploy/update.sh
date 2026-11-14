#!/usr/bin/env bash
# TimberTrail — install a new release on the server. Run from /opt/sawmill after the new
# code is in place (git pull, or files copied over):
#   sudo -u sawmill ./deploy/update.sh
# (the sawmill user may restart the service: see "sudoers" in docs/DEPLOYMENT.md)
#
# Order: backup → install → test & build → migrate → publish web → restart API → health check.
# Stops at the first failure; the running app is untouched until the migrate step.
set -euo pipefail
cd "$(dirname "$0")/.."

API_ENV="${API_ENV:-/etc/sawmill/api.env}"
WEB_ROOT="${WEB_ROOT:-/var/www/sawmill}"
step() { echo; echo "▶ $*"; }

step "backup before changing anything"
./deploy/backup/sawmill-backup.sh

step "install exact dependency versions"
npm ci --no-audit --no-fund

step "typecheck, unit tests and build"
npm run check

step "database migrations"
set -a
# shellcheck disable=SC1090
source "$API_ENV"
set +a
npm run db:migrate

step "publish the web app"
# Copy without deleting: a browser that still has the previous release open loads
# its page chunks by their old names. Chunks unused for 30 days are removed instead.
rsync -a web/dist/ "$WEB_ROOT/"
find "$WEB_ROOT/assets" -type f -mtime +30 -delete

step "restart the API"
sudo systemctl restart sawmill-api

step "health check"
for i in {1..15}; do
  if curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health" > /dev/null; then
    echo "✓ API is up — release installed"
    exit 0
  fi
  sleep 2
done
echo "✗ API did not come back. Logs: journalctl -u sawmill-api -n 100"
exit 1
