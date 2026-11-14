# Deployment, backups and operations

How to run SAWMILL PRO (API + web app) on one Linux server, keep it updated, and keep the
data safe. Written for Ubuntu 22.04/24.04; any systemd Linux works with small changes.

```
 browser ──https──▶ nginx ──▶ /            web/dist (static files)
                          └─▶ /api/  ──▶  Node API on 127.0.0.1:3000 ──▶ PostgreSQL (local)
```

Everything needed is in [`deploy/`](../deploy):

| File | Goes to | What |
|---|---|---|
| `nginx/sawmill.conf` | `/etc/nginx/sites-available/sawmill` | HTTPS site, HTTP→HTTPS redirect, login rate limit |
| `nginx/sawmill-app.conf`, `nginx/sawmill-headers.conf` | `/etc/nginx/snippets/` | web app, API proxy, caching, security headers (CSP) |
| `systemd/sawmill-api.service` | `/etc/systemd/system/` | runs the API, restarts it on failure, sandboxed |
| `api.env.example` | `/etc/sawmill/api.env` | API settings (secrets) |
| `backup/sawmill-backup.sh`, `backup/sawmill-restore.sh` | used in place | daily backup, restore |
| `backup/backup.env.example` | `/etc/sawmill/backup.env` | backup settings |
| `update.sh` | used in place | install a new release |

## 1. Server (once)

Minimum: 2 GB RAM, 2 vCPU, 20 GB disk. A domain name pointing at the server (e.g. `mill.example.in`).

```bash
sudo apt update && sudo apt install -y nginx postgresql rsync curl certbot python3-certbot-nginx
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs

# a user that owns the app and runs the API (no login shell)
sudo adduser --system --group --home /opt/sawmill sawmill
sudo mkdir -p /etc/sawmill /var/www/sawmill /var/backups/sawmill /var/log/sawmill
sudo chown sawmill:sawmill /var/www/sawmill /var/backups/sawmill /var/log/sawmill
sudo chmod 750 /etc/sawmill /var/backups/sawmill

# firewall: only SSH and web
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

PostgreSQL listens only on localhost by default — keep it that way.

```bash
DBPASS=$(openssl rand -base64 24); echo "$DBPASS"     # keep it for api.env and backup.env
# CREATEDB lets the restore script restore into a new database (see Backups)
sudo -u postgres psql -c "CREATE ROLE sawmill LOGIN CREATEDB PASSWORD '$DBPASS'"
sudo -u postgres createdb -O sawmill sawmill
```

## 2. Install the app (once)

```bash
# put the code in /opt/sawmill (git clone, or copy the project folder without node_modules)
sudo chown -R sawmill:sawmill /opt/sawmill

# settings — fill in DB_PASSWORD, JWT_ACCESS_SECRET (openssl rand -base64 48), CORS_ORIGINS
sudo install -m 600 -o sawmill -g sawmill /opt/sawmill/deploy/api.env.example /etc/sawmill/api.env
sudo nano /etc/sawmill/api.env
sudo install -m 600 -o sawmill -g sawmill /opt/sawmill/deploy/backup/backup.env.example /etc/sawmill/backup.env
sudo nano /etc/sawmill/backup.env

# build, migrate, publish the web app
cd /opt/sawmill
sudo -u sawmill npm ci && sudo -u sawmill npm run check
sudo -u sawmill bash -c 'set -a; . /etc/sawmill/api.env; set +a; npm run db:migrate'
sudo -u sawmill rsync -a web/dist/ /var/www/sawmill/

# the mill and its first owner (asks for the password; never use npm run db:seed here)
sudo -u sawmill bash -c 'set -a; . /etc/sawmill/api.env; set +a; npm run setup:owner -- \
  --mill "Sri Murugan Saw Mill" --code SMSM --name "R. Murugan" --username murugan --lang ta'

# API service
sudo cp deploy/systemd/sawmill-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now sawmill-api
curl -s http://127.0.0.1:3000/api/health          # {"status":"ok",...}

# nginx + HTTPS (replace mill.example.in in sawmill.conf first)
sudo cp deploy/nginx/sawmill-app.conf deploy/nginx/sawmill-headers.conf /etc/nginx/snippets/
sudo cp deploy/nginx/sawmill.conf /etc/nginx/sites-available/sawmill
sudo ln -s /etc/nginx/sites-available/sawmill /etc/nginx/sites-enabled/ && sudo rm -f /etc/nginx/sites-enabled/default
sudo certbot certonly --nginx -d mill.example.in   # certificate (renews automatically)
sudo nginx -t && sudo systemctl reload nginx
```

Let the `sawmill` user restart only its own service (used by `update.sh`):

```bash
echo 'sawmill ALL=(root) NOPASSWD: /usr/bin/systemctl restart sawmill-api' | sudo tee /etc/sudoers.d/sawmill
```

The API refuses to start in production if a secret is missing or still an example value,
if `CORS_ORIGINS` contains `*` or localhost, or if a `SEED_*` password is set. The error
names the setting: `journalctl -u sawmill-api -n 50`.

## 3. Backups

**What is backed up:** the whole database (every record, the audit log, users). The code
can be rebuilt; the database cannot. Nothing else on the server holds data.

```bash
# daily at 01:15
echo '15 1 * * * sawmill /opt/sawmill/deploy/backup/sawmill-backup.sh >> /var/log/sawmill/backup.log 2>&1' \
  | sudo tee /etc/cron.d/sawmill-backup
sudo -u sawmill /opt/sawmill/deploy/backup/sawmill-backup.sh     # run once now to check
```

Each run: `pg_dump` → checks the dump is readable → SHA-256 checksum → keeps 14 daily,
8 weekly (Sunday) and 12 monthly copies in `/var/backups/sawmill`.

**Off-site copy (do this):** a backup on the same disk is lost with the disk or the server.
Install `rclone`, run `rclone config` once (Google Drive, S3, …), then set `RCLONE_REMOTE`
in `/etc/sawmill/backup.env`. Set `GPG_RECIPIENT` too so the copy that leaves the server
is encrypted (the database holds prices, payments and phone numbers).

**Check backups monthly** (a backup that was never restored is a hope, not a backup):

```bash
sudo -u sawmill /opt/sawmill/deploy/backup/sawmill-restore.sh /var/backups/sawmill/daily/<latest>.dump
```

This restores into a *new* database (`sawmill_restore_<date>`), prints record counts to
compare with the app, and leaves the live database alone. Drop it afterwards with the
command it prints.

**Restoring for real** (data loss, bad import, server rebuilt):

```bash
sudo SAWMILL_BACKUP_ENV=/etc/sawmill/backup.env \
  /opt/sawmill/deploy/backup/sawmill-restore.sh /var/backups/sawmill/daily/<file>.dump --replace
```

It asks you to type the database name, stops the API, keeps the current database under
another name (nothing is dropped), restores, and starts the API. Everything entered after
the backup was taken must be entered again.

## 4. Updating to a new release

```bash
cd /opt/sawmill && sudo -u sawmill git pull        # or copy the new files over
sudo -u sawmill ./deploy/update.sh
```

`update.sh`: backup → `npm ci` → typecheck, tests, build → migrations → publish web →
restart API → health check. It stops at the first failure; the running app is not touched
before the migration step. Browsers pick up the new web app on their next page load.

## 5. Security checklist

- [ ] HTTPS works and http:// redirects; certificate auto-renews (`sudo certbot renew --dry-run`)
- [ ] `/etc/sawmill/*.env` are `600`, owned by `sawmill`; JWT secret is fresh and random
- [ ] API listens on 127.0.0.1 only (`ss -ltnp | grep 3000`); PostgreSQL on localhost only
- [ ] Firewall allows only 22, 80, 443; SSH uses keys, password login disabled
- [ ] The demo users (`owner` / `accountant` with known passwords) do **not** exist
- [ ] Backups run (check `/var/log/sawmill/backup.log`), off-site copy works, a restore was tested
- [ ] `sudo apt upgrade` monthly (or `unattended-upgrades` for security updates)

What the app itself enforces (see `docs/TECHNICAL_PLAN.md` §2): every route needs a
permission (checked by `backend/src/security/routes.spec.ts`), each mill sees only its own
data, accountants never receive prices or payments, 5 wrong passwords lock an account for
15 minutes, password reset / disable / role change end that person's sessions at once,
login is rate-limited in nginx and in the API, and every change is in the audit log.

## 6. Troubleshooting

| Symptom | Look at |
|---|---|
| Site shows 502 | `systemctl status sawmill-api`, `journalctl -u sawmill-api -n 100` |
| API won't start: "Invalid environment" | the listed setting in `/etc/sawmill/api.env` |
| Everyone's IP in the audit log is 127.0.0.1 | `TRUST_PROXY=1` missing in `api.env` |
| "Too many wrong passwords" for a user | wait 15 minutes, or the owner resets the password (Users page) |
| Backup failed | `/var/log/sawmill/backup.log`; disk space `df -h /var/backups` |
