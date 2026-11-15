# Going live: Neon + Vercel + Expo / Play Store

Step-by-step for this setup:

| Part | Runs on | Folder |
|---|---|---|
| Database | **Neon** (PostgreSQL) | `backend/drizzle/` (migrations) |
| API | **Vercel** — `backend` service (NestJS on Vercel Functions) | `backend/` |
| Web dashboard | **Vercel** — `web` service (static Vite build), same project | `web/` |
| Android app | **Expo EAS** build → **Google Play** | `mobile/` |

The API and web dashboard are **one Vercel project** with two services, configured in the root
`vercel.json` (see [VERCEL.md](VERCEL.md)). Do the parts **in this order** — each one needs an
address from the one before.

```
 browser ─────https──▶ one Vercel project (https://mill.example.in)
 Android app ─────────▶  ├─ /api/*  ──▶ backend service ──▶ Neon
                         └─ /*      ──▶ web service (static web app)
```

The web app reaches the API **on its own domain**: sign-in cookies are `SameSite=Strict`, so a
browser would not send them to a different site. Both services sharing one domain takes care of
that. The phone uses Bearer tokens and calls the same `https://mill.example.in/api`.

Throughout, replace these placeholders with your real values:

| Placeholder | Meaning |
|---|---|
| `mill.example.in` | your domain (or the project's `*.vercel.app` address until you add one) |
| `<NEON_POOLED_URL>` / `<NEON_DIRECT_URL>` | the two Neon connection strings (step 1) |
| `<EAS_PROJECT_ID>` | from `npx eas init` (step 3) |

---

## 0. Accounts you need (once)

| Account | For | Cost / note |
|---|---|---|
| [neon.tech](https://neon.tech) | database | Free plan = 0.5 GB storage (matches the app's small-database design). Paid plans add longer restore history. |
| [vercel.com](https://vercel.com) | API + web | **Hobby is for non-commercial use only** — a business should use **Pro**. |
| [expo.dev](https://expo.dev) | Android builds, OTA updates, push | Free plan works; `resourceClass: "large"` in `eas.json` needs a paid plan (remove that line on Free). |
| [play.google.com/console](https://play.google.com/console) | publishing | One-time US $25 registration; identity verification can take a few days — start early. |
| [console.firebase.google.com](https://console.firebase.google.com) | Android push notifications (FCM) | Free. Optional: without it the app works, only push is off. |

Tools on your computer: Node 20+, `npm`, `openssl`, and `npx eas-cli` (no global install needed).

---

## 1. Database — Neon

| # | Step |
|---|---|
| 1.1 | Neon → **New project**. Name `timbertrail`, Postgres **16** (what the tests run on), region **AWS Asia Pacific (Singapore)** — or whichever is nearest; the API's Vercel region (step 2.4) must match it. |
| 1.2 | Database name `timbertrail`, keep the owner role Neon creates. |
| 1.3 | **Connect** → copy **two** connection strings and keep them safe: <br>• **Pooled** (host contains `-pooler`) → `<NEON_POOLED_URL>` — used by the API <br>• **Direct** (toggle "Connection pooling" off) → `<NEON_DIRECT_URL>` — used only for migrations |
| 1.4 | Both must end with `?sslmode=require` (Neon adds it). |
| 1.5 | Settings → **History / restore window**: set as long as your plan allows (this is your backup — Neon restores to any moment inside it). |

**Create the tables** (from your computer, with the **direct** URL — DDL and the data clean-up in
migration `0006` should not go through the pooler):

```bash
cd sawmill/backend
DATABASE_URL="<NEON_DIRECT_URL>" npm run db:migrate
```

**Create the mill and its first owner** (asks for the password twice, not echoed; 10+ characters
with a letter and a digit):

```bash
DATABASE_URL="<NEON_DIRECT_URL>" npm run setup:owner -- \
  --mill "Sri Murugan Saw Mill" --code SMSM --name "R. Murugan" --username murugan --lang ta --utc-offset 330
```

> Never run `npm run db:seed` or `db:seed:demo` against Neon — they create demo logins.
> Accountants are added later from the web app (Users page).

**Every later release that adds a file in `backend/drizzle/`:** run the `db:migrate` command
above **before** deploying.

---

## 2. API + web — one Vercel project

| # | Step |
|---|---|
| 2.1 | Vercel → **Add New → Project** → import the Git repository. |
| 2.2 | **Root Directory: the repository root** (where `vercel.json` is). Leave framework / build / install on the defaults — both services (`backend`, `web`) and their build commands come from `vercel.json` (each installs at the repo root so the shared package builds first). |
| 2.3 | Settings → General → **Node.js version: 20.x** (or 22.x). |
| 2.4 | Settings → Functions → **Region**: the same as Neon (e.g. Singapore `sin1`). Far apart = every request waits on the database round trip. |
| 2.5 | Add the environment variables below (Settings → Environment Variables), scope **Production**. Put the project's `*.vercel.app` address in `CORS_ORIGINS` for now. |
| 2.6 | **Deploy**. Then open `https://<project>.vercel.app/api/health` → `{"status":"ok",…}`, and `https://<project>.vercel.app` → sign in with the owner from step 1. If the deployment fails at start, the function log says exactly which variable is wrong. |
| 2.7 | Settings → **Domains** → add `mill.example.in`, set the DNS records Vercel shows. Then add that address to `CORS_ORIGINS` (keep the `*.vercel.app` one too if you still use it) and **redeploy**. |
| 2.8 | In the web app as owner: **Settings** (mill name, unloading rate, wood types), **Users** (add accountants), **Suppliers / Clients**. |

### Environment variables

The `web` service needs none — in particular leave **`VITE_API_URL` unset**: the app calls `/api`
on its own domain, and pointing it anywhere else breaks sign-in (cookies). The rest are for the
`backend` service:

| Name | Value | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | `<NEON_POOLED_URL>` | ✅ | The **pooled** one. |
| `DB_POOL_MAX` | `3` | ✅ | Connections per function instance; Neon's pooler handles the rest. |
| `JWT_ACCESS_SECRET` | output of `openssl rand -base64 48` | ✅ | 32+ random characters; the API refuses example values. Never reuse the dev value. Changing it signs everyone out. |
| `JWT_ACCESS_TTL` | `15m` | ✅ | Access-token lifetime. |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | ✅ | How long a device stays signed in (1–90). |
| `CORS_ORIGINS` | `https://mill.example.in` | ✅ | The project's address(es), comma-separated, exact `https://` origin, no trailing `/`. No `*`, no localhost — the API refuses them. Put the `*.vercel.app` address here first, add your domain later (step 2.7). |
| `TRUST_PROXY` | `1` | ✅ | Vercel sets `X-Forwarded-For`; rate limits and the audit log need the real IP. |
| `LOG_FORMAT` | `json` | optional | Default in production already; `text` for plain lines. |
| `EXPO_ACCESS_TOKEN` | expo.dev → Account → Access tokens | optional | Only if "Enhanced push security" is on for the Expo project. |
| `NODE_ENV` | — | — | **Don't set**: Vercel sets `production`. |
| `SEED_OWNER_PASSWORD`, `SEED_ACCOUNTANT_PASSWORD` | — | ❌ | **Must not exist** in production (the API refuses to start). |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | — | — | Not needed when `DATABASE_URL` is set. |

> Changing an environment variable takes effect only after a **redeploy**
> (Deployments → ⋯ → Redeploy).

---

## 3. Android app — Expo EAS → Google Play

### 3a. Expo project (once)

| # | Step |
|---|---|
| 3.1 | `cd sawmill/mobile && npx eas-cli login` (your expo.dev account). |
| 3.2 | `npx eas-cli init` → creates the project on expo.dev and prints the **project id** = `<EAS_PROJECT_ID>`. If it offers to write it into the config, say no (the config is `app.config.js`, which reads it from the environment). |
| 3.3 | Put the values from the table below into **`eas.json`** → `build.preview.env`, `build.previewInternal.env` and `build.production.env` (and `EAS_PROJECT_ID` into `mobile/.env` too, for local runs). Commit `eas.json`. |
| 3.4 | *(Push notifications, optional)* Firebase → new project → add an **Android app** with package `com.timbertrail.app` → download `google-services.json`. Then expo.dev → Project → **Environment variables** → add `GOOGLE_SERVICES_JSON` as a **file**, visibility **Secret**, environments Preview + Production. And expo.dev → Project → **Credentials** → Android → **FCM V1 service account key** (Firebase → Project settings → Service accounts → Generate new private key) — this lets Expo deliver the pushes. |

### Android build environment variables

| Name | Where | Value | Notes |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | `eas.json` → each profile's `env` | `https://mill.example.in/api` | Baked into the app when it is bundled. Must include `/api`. The app refuses to start without it. |
| `EAS_PROJECT_ID` | `eas.json` → each profile's `env` | `<EAS_PROJECT_ID>` | Turns on OTA updates and push. Without it the app works, but updates and push are off. |
| `GOOGLE_SERVICES_JSON` | expo.dev → Environment variables (**file**, Secret) | your `google-services.json` | Optional; Android push. Never commit the file. |
| `EXPO_ACCESS_TOKEN` | Vercel project environment variables (step 2) | — | Only with enhanced push security. |

Build profiles already in `eas.json`:

| Profile | Output | OTA channel | Use |
|---|---|---|---|
| `development` | APK with dev client | — | your own testing with Metro |
| `preview` | **APK** (install directly) | `staging` | test on real phones before the store |
| `previewInternal` | AAB, version code auto-increment | `staging` | upload to Play **internal testing** |
| `production` | **AAB**, version code auto-increment | `production` | Play Store releases |

### 3b. Test build (APK)

```bash
cd sawmill/mobile
npx eas-cli build -p android --profile preview
```

Install the APK from the link EAS prints on 2–3 phones and run the manual test list
(payments, offline measuring, app lock, wood types…). Signing keys are created and kept by EAS
the first time — say **yes** when it asks to generate a keystore.

### 3c. Google Play Console (once)

| # | Step |
|---|---|
| 3.5 | Play Console → **Create app**: name `TimberTrail`, default language, **App** (not game), **Free**, accept the declarations. |
| 3.6 | **Store listing**: short + full description (EN, and Tamil if you like), app icon 512×512, feature graphic 1024×500, 2+ phone screenshots. |
| 3.7 | **App content**: <br>• **Privacy policy URL** — required; a simple page on your web domain is fine. <br>• **App access** — the app needs a login: give reviewers a test accountant username + password (create one in the web app). <br>• **Data safety** — collects: name & username (account), phone numbers entered for drivers/suppliers, business financial records; all sent over HTTPS; accounts are created by the mill owner (no self sign-up); data deletion on request to the owner. <br>• **Content rating** questionnaire (business app, no user content → Everyone). <br>• **Target audience** 18+. <br>• **Ads**: no. |
| 3.8 | **App signing**: keep **Play App Signing** (default). The key EAS uses becomes the *upload key*. |
| 3.9 | **Service account for `eas submit`**: Google Cloud Console (the project linked to Play Console) → IAM → Service accounts → create → **Keys → Add key → JSON** → save it as `sawmill/mobile/play-console-services.json` (already git- and EAS-ignored). Play Console → **Users and permissions** → invite the service account's e-mail → grant **Release** permissions for this app. |

### 3d. First release

```bash
npx eas-cli build -p android --profile production
```

| # | Step |
|---|---|
| 3.10 | **The very first AAB must be uploaded by hand** (Google doesn't allow the API to create an app's first release): Play Console → **Testing → Internal testing → Create release** → upload the `.aab` from the EAS build page → add testers (an e-mail list) → **Roll out**. |
| 3.11 | Testers install from the opt-in link and check sign-in, measuring and push. |
| 3.12 | Promote: **Internal → Closed/Open testing or Production → Create release from the internal one**. New personal developer accounts must run a **closed test with 12+ testers for 14 days** before production is unlocked; organisation accounts don't. |

### 3e. Every later Android release

**Native change** (new Expo/native package, permission, icon, splash, Expo SDK upgrade):

1. Bump `version` in `mobile/app.config.js` (e.g. `0.1.0` → `0.2.0`) — OTA updates only reach
   builds of the same version, so old phones never get code that needs native parts they lack.
2. Build and send to Play's internal track:
   ```bash
   npx eas-cli build -p android --profile production
   npx eas-cli submit -p android --profile production --latest
   ```
3. In Play Console, promote the internal release to production.

**JavaScript-only fix** (screens, text, logic) — no store review, phones get it in the background:

```bash
cd sawmill/mobile
EXPO_PUBLIC_API_URL=https://mill.example.in/api EAS_PROJECT_ID=<EAS_PROJECT_ID> \
  npx eas-cli update --channel production --message "Fix totals on the measure screen"
```

> ⚠️ Always pass `EXPO_PUBLIC_API_URL` like this. `eas update` bundles on **your computer**, so
> without it the bundle would pick up `mobile/.env` — your LAN development address — and every
> phone would lose the server. Use `--channel staging` to try an update on preview APKs first.

---

## 4. Release checklist (every time)

| Order | What | Command / where |
|---|---|---|
| 1 | Tests pass | `npm run check` (and `npm run test:e2e` locally) |
| 2 | New migrations? Apply them **first** | `DATABASE_URL="<NEON_DIRECT_URL>" npm run db:migrate -w backend` |
| 3 | Push to the main branch | Vercel redeploys the project (**API and web together**) automatically |
| 4 | Check | `/api/health`, sign in on the web |
| 5 | Android | OTA update (JS only) or new build + submit (native) — section 3e |

Rolling back: Vercel → Deployments → pick the previous one → **Promote to Production**.
Database: Neon → **Restore** to a time before the problem (or restore into a new branch first to
look). OTA: `npx eas-cli update:republish` the previous update on the channel.

---

## 5. Troubleshooting

| Symptom | Cause → fix |
|---|---|
| API deploy fails with `Invalid environment: …` | The log lists each bad variable (placeholder secret, wildcard CORS, a `SEED_*` variable set…). Fix it, redeploy. |
| Web: sign-in succeeds, then every page says signed out | `VITE_API_URL` is set on the project — remove it and redeploy. |
| Web: refreshing a page shows a 404 | The `web` service's `rewrites` (SPA fallback to `/index.html`) is missing from `vercel.json`. |
| Web: `CORS` error in the browser console | `CORS_ORIGINS` doesn't exactly match the address in the browser bar (scheme, `www.`, trailing `/`). Redeploy after changing it. |
| API: `too many connections` / timeouts | `DATABASE_URL` is the **direct** string — use the `-pooler` one; keep `DB_POOL_MAX=3`. |
| Slow first request after a quiet night | Neon suspends idle compute; the first query wakes it (~1 s). Normal. A paid plan can disable autosuspend. |
| Phone: "Cannot reach server" | `EXPO_PUBLIC_API_URL` wrong or missing `/api`; open it in the phone's browser + `/health`. |
| Phone never gets OTA updates | Build made before `EAS_PROJECT_ID` was set (make a new build), wrong channel, or the update was published for a different app `version`. |
| No push notifications on Android | `GOOGLE_SERVICES_JSON` not set for that build, or the FCM V1 key missing in expo.dev credentials. |
| `eas submit` permission error | Service account not invited in Play Console, or the first release wasn't uploaded by hand (3.10). |

See also: [VERCEL.md](VERCEL.md) (how the API runs on Vercel: logs, rate limits, background
work) and [DEPLOYMENT.md](DEPLOYMENT.md) (the alternative single-server setup).
