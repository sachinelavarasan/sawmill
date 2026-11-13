# SAWMILL PRO

Timber mill management: an Android app plus a web dashboard, with Owner and Accountant roles.

| Folder | What |
|---|---|
| `backend/` | NestJS API + Drizzle ORM + PostgreSQL. All permission checks happen here. |
| `web/` | React + Vite web dashboard (Owner & Accountant) |
| `mobile/` | Expo React Native Android app |
| `packages/shared/` | Roles, permission matrix, CFT formulas, EN/TA text shared by all three |
| `docs/TECHNICAL_PLAN.md` | Architecture, DB design, API permissions, CFT test cases, phases |

## Run locally

```bash
npm install                       # installs all workspaces, builds packages/shared
cp backend/.env.example backend/.env
npm run db:up                     # PostgreSQL in Docker
npm run db:migrate                # apply backend/drizzle/*.sql
npm run db:seed                   # demo mill + owner + accountant

npm run dev                       # API (http://localhost:3000/api) + web (http://localhost:5173) together
npm run dev:api                   # or just the API
npm run dev:web                   # or just the web dashboard
npm run dev:mobile                # Expo; press "a" for Android emulator
```

## Monorepo (npm workspaces + Turborepo)

Tasks run through [Turborepo](https://turbo.build): each package's task runs after
the packages it depends on (`packages/shared` is always built first), and results
are cached. A task whose inputs haven't changed replays from cache instantly.

```bash
npm run check                     # typecheck + test + build, every package
npm run typecheck                 # all packages
npm run build                     # all packages (shared → backend, web)
npx turbo run test --filter=backend   # one package
```

Task definitions live in `turbo.json`. The project isn't a git repo yet, so Turbo
can't read `.gitignore`; generated folders (`dist`, `.turbo`, `.expo`, …) are
excluded from task inputs explicitly there. Keep that list in sync if you add a new
generated folder, or caching stops working.

Dev logins (from the seed): `owner / Owner@123`, `accountant / Accountant@123`.

Schema changes: edit `backend/src/db/schema.ts`, then `npm run db:generate` (creates a new SQL migration) and `npm run db:migrate`.

For a real phone, copy `mobile/.env.example` to `mobile/.env` and set your computer's LAN IP.

## Tests

```bash
npm test                          # all unit tests (CFT formulas, permissions, edit rules) — cached
npm run test:e2e                  # imports API against a separate <DB_NAME>_test database (wiped each run, never cached)
```

## Status

Phases 1–3 are built: login, the Owner and Accountant dashboards, user management, the audit log, import loads with unloading, log measurement with CFT, and owner-only purchase details and suppliers. The web app has been checked in a browser; the Android screens have not yet been run on a device. See `docs/TECHNICAL_PLAN.md` for the later phases.
