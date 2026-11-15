# Deploying on Vercel

> **Step-by-step go-live (Neon + Vercel + Play Store), with every environment variable:**
> [GO-LIVE.md](GO-LIVE.md). This page explains how the API behaves on Vercel.

An alternative to the single Linux server in [DEPLOYMENT.md](DEPLOYMENT.md): the API and the
web app run as **one Vercel project with two [services](https://vercel.com/docs/services)**,
configured in the root `vercel.json`, with PostgreSQL hosted elsewhere (Neon, Supabase, or any
managed Postgres).

```
 browser ───https──▶ mill.example.in (one Vercel project)
 phone app ─────────▶  ├─ /api/*  ──▶ backend service (Nest on Vercel Functions) ──▶ PostgreSQL
                       └─ /*      ──▶ web service (web/dist, SPA fallback to index.html)
```

| Service | Folder | Public path | Notes |
|---|---|---|---|
| `backend` | `backend/` | `/api/*` | Receives the full path (`/api/users`), matching Nest's global `api` prefix. |
| `web` | `web/` | everything else | Static Vite build; unknown paths fall back to `index.html` so deep links survive a refresh. Security headers (CSP, HSTS…) are set on this service. |

Neither service calls the other server-side, so there are no service bindings: the browser
loads the web app and calls `/api` on the same domain.

**Why one domain matters.** Browser sessions are httpOnly cookies with `SameSite=Strict`, scoped
to `/api`. A browser never sends those to a *different* site, so the web app must call the API on
its own origin. With both services behind one domain this is automatic — leave `VITE_API_URL`
unset.

Both services install at the repo root (`cd .. && npm ci`) so the workspace package
`@timbertrail/shared` resolves, and Turborepo builds it before the API / web app.

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

## 2. The Vercel project

New project → import the repository → **Root Directory: the repository root** (where
`vercel.json` is). Vercel reads both services from `vercel.json`; leave framework, build and
install settings on their defaults.

Environment variables (Production) — the web service needs none, these are for `backend`:

| Name | Value |
|---|---|
| `DATABASE_URL` | the pooled connection string |
| `DB_POOL_MAX` | `3` (connections per function instance; the pooler does the rest) |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 48` (never reuse the dev value) |
| `JWT_ACCESS_TTL` | `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | `30` |
| `CORS_ORIGINS` | the project's own address, e.g. `https://mill.example.in` (no `*`, no localhost) |
| `TRUST_PROXY` | `1` (Vercel sets `X-Forwarded-For`; rate limits and the audit log need the real IP) |
| `EXPO_ACCESS_TOKEN` | only if enhanced push security is on for the Expo project |

`NODE_ENV=production` is set by Vercel. The API refuses to start if a production setting is
missing or still an example value; the reason is in the function's logs.

Check: `https://mill.example.in/api/health` → `{"status":"ok",…}`, then open
`https://mill.example.in` and sign in.

## 3. Phone app

Point the app at the same domain: `EXPO_PUBLIC_API_URL=https://mill.example.in/api` in
`mobile/.env` (or the EAS build profile), then rebuild.

## Local testing

`npm run dev` (Nest on :3000, Vite on :5173 proxying `/api`) is still the everyday setup.
To try the Vercel routing itself, run `vercel dev` from the repo root — it runs both services
behind one address, exactly as deployed.

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
