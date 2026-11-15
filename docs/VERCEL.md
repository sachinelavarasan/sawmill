# Deploying on Vercel

> **Step-by-step go-live (Neon + Vercel + Play Store), with every environment variable:**
> [GO-LIVE.md](GO-LIVE.md). This page explains how the API behaves on Vercel.

An alternative to the single Linux server in [DEPLOYMENT.md](DEPLOYMENT.md): the API and the
web app run as **two Vercel projects** from this one repository, with PostgreSQL hosted
elsewhere (Neon, Supabase, or any managed Postgres).

```
 browser ──https──▶ web project (mill.example.in)
                     ├─ /        web/dist (static, security headers from web/vercel.json)
                     └─ /api/*  ──rewrite──▶ API project (Nest on Vercel Functions) ──▶ PostgreSQL
 phone app ─────────────────────────────────▶ API project (directly, Bearer tokens)
```

**Why the web app reaches the API through its own domain.** Browser sessions are httpOnly
cookies with `SameSite=Strict`. A browser never sends those to a *different* site, so if the
web app called `https://…-api.vercel.app` directly, sign-in would appear to work and then every
request would come back 401. The `/api/*` rewrite in `web/vercel.json` makes the API look like
part of the web site, so the cookies stay first-party. Leave `VITE_API_URL` unset on the web
project.

## 1. Database (once)

Create a Postgres 16 database and copy its **pooled** connection string (Neon: the
`-pooler` host; Supabase: the "Transaction pooler" URL, port 6543). Serverless functions open
connections often; going through the pooler keeps the database within its connection limit.

Run the migrations and create the first owner from your own machine (Vercel doesn't run them):

```bash
cd backend
DATABASE_URL="postgresql://…" npm run db:migrate
DATABASE_URL="postgresql://…" npm run setup:owner -- --mill "<mill name>" --code <CODE> --name "<owner name>" --username <login>
```

Run `db:migrate` again before deploying any release that adds a migration (`backend/drizzle/`).

## 2. API project

New project → import the repository → **Root Directory: `backend`**. Framework, install and
build commands come from `backend/vercel.json` (installs at the repo root so the workspace
package `@timbertrail/shared` resolves; Turborepo builds it before the API).

Environment variables (Production):

| Name | Value |
|---|---|
| `DATABASE_URL` | the pooled connection string |
| `DB_POOL_MAX` | `3` (connections per function instance; the pooler does the rest) |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 48` (never reuse the dev value) |
| `JWT_ACCESS_TTL` | `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | `30` |
| `CORS_ORIGINS` | the web project's address, e.g. `https://mill.example.in` (no `*`, no localhost) |
| `TRUST_PROXY` | `1` (Vercel sets `X-Forwarded-For`; rate limits and the audit log need the real IP) |
| `EXPO_ACCESS_TOKEN` | only if enhanced push security is on for the Expo project |

`NODE_ENV=production` is set by Vercel. The API refuses to start if a production setting is
missing or still an example value; the reason is in the function's logs.

Check: `https://<api-project>.vercel.app/api/health` → `{"status":"ok",…}`.

## 3. Web project

New project → same repository → **Root Directory: `web`**. In `web/vercel.json`, replace
`REPLACE-WITH-API-PROJECT.vercel.app` with the API project's address and commit. Add your
domain to this project.

## 4. Phone app

Point the app at the API: `EXPO_PUBLIC_API_URL=https://<api-project>.vercel.app/api` in
`mobile/.env` (or the EAS build profile), then rebuild.

## Logs

Every request is one line (`common/request-logger.ts`), as JSON in production:

```
POST /api/imports/3f…/submit 201 84ms · owner · 203.0.113.7 · rid=fra1::abc…
```

5xx responses are logged as errors, 4xx and slow (>1.5 s) requests as warnings, so the level
filter in Vercel → Logs shows problems first. Each response has an `X-Request-Id` header; on
Vercel it is the Vercel request id, so a request a user reports can be found directly. Set
`LOG_FORMAT=text` for plain lines instead of JSON.

## Differences from the server setup

- **Rate limits** are counted per function instance, so they are looser than on one server.
  Account lockout after wrong passwords is stored in the database and is unaffected.
- **Push notifications and inbox entries** are written after the response is sent; the API
  uses Vercel's `waitUntil` so the function stays alive until they're done.
- **Backups**: use the database provider's backups / point-in-time restore instead of
  `deploy/backup/`.
