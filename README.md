# TimberTrail

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
# set DB_USER / DB_PASSWORD for your local PostgreSQL in backend/.env
npm run db:migrate                # apply backend/drizzle/*.sql
npm run db:seed                   # demo mill + owner + accountant
npm run db:seed:demo              # optional: ~6 months of demo data for every screen (db:seed:demo:reset wipes the DEMO mill's records and re-creates it)

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

## Web UI (shadcn/ui + Tailwind v4)

Every screen is built from shadcn components + Tailwind classes; there is no hand-written page CSS.

- `web/src/components/ui/` — shadcn components ("new-york" style). Add more with
  `cd web && npm run ui:add -- <name>` (wraps the shadcn CLI and fixes an import it gets wrong here).
- `web/src/components/page.tsx` — app building blocks: Page, PageHeader, Section, Stat/StatGrid,
  TableCard, Pager, Notice, LoadState, Field/FormGrid/FormActions, StatusFilter, EntryRow (fast numeric entry).
- Colours live once in `web/src/tokens.css` (light + dark; mirrored for Android in
  `packages/shared/src/theme.ts`). `web/src/index.css` maps them to Tailwind/shadcn names
  (`bg-primary`, `text-muted-foreground`, `bg-success-soft`, …). Change colours there, never in components.
- Dark mode follows the theme toggle (`data-theme` on `<html>`) or the device; `dark:` classes work as usual.
- Confirmations: `useConfirm()` / `useConfirmDelete()` from `web/src/components/confirm.tsx` — not `window.confirm`.
- Icons: `lucide-react`.
- Tables: put the pager in the card footer — `usePaging()` for lists the API pages (`?take=&skip=`),
  `useClientPaging(rows)` for lists loaded whole; pass `pager={…}` to `TableCard`.
- Fonts (Inter, Noto Sans Tamil) are bundled via `@fontsource`, so the site loads nothing from other domains.
- Charts: `web/src/components/charts.tsx` (plain SVG, no chart library) — LineChart, ColumnChart, StackedBars in a
  ChartCard with legend, hover/keyboard tooltip and a Table view. Series colours are `--chart-1` / `--chart-2` in
  `tokens.css` (blue/orange, checked for colour-blind safety in light and dark). Never use the status colours
  (green/amber/red) for chart series.

## Tests

```bash
npm test                          # all unit tests (CFT formulas, permissions, edit rules) — cached
npm run test:e2e                  # whole API against a separate <DB_NAME>_test database (wiped each run, never cached)
```

## Status

Phases 1–3 are built: login, the Owner and Accountant dashboards, user management, the audit log, import loads with unloading, log measurement with CFT, and owner-only purchase details and suppliers. The web app has been checked in a browser; the Android screens have not yet been run on a device.

Phase 4 (production & stock) is built on the web: production runs, finished sizes, stock balances and history, stock adjustments, and submit/approve/reject buttons on each record. Stock changes only on approval and never goes below zero (`backend/src/stock/ledger.ts`). Not built yet on Android.

Phase 5 (exports) is built on the web: export loads, measurement lines picked from finished stock, owner-only sale details, and clients. Approving an export takes the pieces out of finished stock, traceable to each import load.

Phase 6 is built on the web: the owner's Approvals queue (everything submitted, oldest first, approve/reject in place) and Settings (mill name, standard unloading rate, language for new users, time zone). See `docs/TECHNICAL_PLAN.md` for the later phases.

Phase 7 is built on the web: Accounts (profit & loss for any period, other expenses, what suppliers are owed and clients owe) and Reports (registers, stock, P&L, balances, expenses) with Excel download and Print / Save as PDF.

Phase 8 (web): security hardening, deployment and backups.
- Security: account lockout after 5 wrong passwords, sessions end at once on password reset / disable / role change,
  production settings checked at startup, report size limits, and a test that every API route has a permission
  rule (`backend/src/security/routes.spec.ts`, with a reviewable route → permission snapshot).
- Deployment on one Linux server (nginx + systemd + PostgreSQL), daily verified backups with off-site copy, restore,
  and a one-command update: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md), files in `deploy/`.
- Create the real mill and owner with `npm run setup:owner` (the demo seed refuses to run in production).
- Acceptance testing with the client: [`docs/UAT.md`](docs/UAT.md).

