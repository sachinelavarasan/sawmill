# SAWMILL PRO — Technical Implementation Plan

Status: Phases 1–3 built · Source: *SAWMILL PRO Project Kickoff & Software Requirements*

## 1. Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│  web/  React + Vite │     │ mobile/ React Native│
│  (Owner + Accountant│     │ (Expo, Android)     │
│   web dashboard)    │     │                     │
└──────────┬──────────┘     └──────────┬──────────┘
           │   HTTPS / JSON  (JWT bearer)          │
           └──────────────┬────────────────────────┘
                ┌─────────▼─────────┐
                │ backend/  NestJS  │  ← RBAC enforced here
                │ Drizzle ORM       │
                └─────────┬─────────┘
                ┌─────────▼─────────┐
                │   PostgreSQL 16   │
                └───────────────────┘
packages/shared  → roles, permissions, approval statuses, CFT formulas
                   (used by backend, web and mobile, so all three agree)
```

| Layer    | Choice                                                      |
|----------|-------------------------------------------------------------|
| Backend  | NestJS 10, Drizzle ORM + drizzle-kit migrations, PostgreSQL 16, JWT (access + rotating refresh), bcrypt, Helmet, rate-limited login |
| Web      | React 18 + Vite + TypeScript, React Router, built-in EN/TA i18n |
| Mobile   | Expo SDK 52 (React Native), expo-secure-store for tokens      |
| Shared   | `@sawmill/shared` TypeScript package                         |

### Multi-sawmill (multi-tenant) design
Every business table carries `millId`. The mill is taken from the logged-in
user on the server — never from the request body — so one mill can never read
another's data. Per-mill settings (default unloading rate, units, language) live
in `Mill.settings`.

## 2. Security model (RBAC)

* **Authentication:** username + password → short-lived access JWT (15 min) +
  refresh token (30 days, stored only as a SHA-256 hash, rotated on every use,
  revoked on logout / password reset / deactivation).
* **Every request re-loads the user from the database.** Role and active status
  come from the DB, not from the token, so disabling an accountant or changing
  their role takes effect immediately.
* **Permission guard (global):** every route is denied unless it declares
  `@RequirePermissions(...)` or `@Public()`. Permissions map to roles in
  `packages/shared/src/permissions.ts` — the single source of truth.
* **Restricted data is physically separated.** Purchase prices, selling prices,
  client links and payments live in separate `*Financials` / `Client` /
  `Supplier` / `Expense` tables that only Owner-permission endpoints read.
  Accountant endpoints never `include` them, so leaks through "hidden in UI"
  fields are impossible.
* **Approval lock:** records in `SUBMITTED` or `APPROVED` state are rejected by
  the service layer for accountant edits (HTTP 409/403).
* **Audit log:** login, logout, user changes, create/update/submit/approve/
  reject/owner-edit — with before/after JSON snapshots, user, IP, timestamp.

### Permission matrix

| Permission              | Owner | Accountant | Notes |
|-------------------------|:-----:|:----------:|-------|
| `dashboard:owner`       | ✅ | ❌ | financial KPIs, activity monitor |
| `dashboard:accountant`  | ✅ | ✅ | operational KPIs (own entries for accountant) |
| `users:manage`          | ✅ | ❌ | create / disable / reset accountants |
| `audit:view`            | ✅ | ❌ | |
| `settings:manage`       | ✅ | ❌ | |
| `operations:create`     | ✅ | ✅ | import, unloading, measurement, production, export, stock adj. |
| `operations:view_all`   | ✅ | ❌ | accountant sees only own entries |
| `operations:submit`     | ✅ | ✅ | own Draft / Rejected only |
| `operations:approve`    | ✅ | ❌ | approve / reject |
| `operations:edit_approved` | ✅ | ❌ | always audited |
| `finance:view`          | ✅ | ❌ | purchase/selling rates, sales, expenses, P&L |
| `clients:manage`        | ✅ | ❌ | client details & contacts |
| `suppliers:manage`      | ✅ | ❌ | supplier financial details |
| `reports:operational`   | ✅ | ✅ | accountant: operational only |
| `reports:financial`     | ✅ | ❌ | |

## 3. Database architecture

Full schema: [`backend/src/db/schema.ts`](../backend/src/db/schema.ts) · SQL migrations in `backend/drizzle/`.
All tables are created now so later phases add APIs, not migrations of the core model.

| Area | Tables | Restricted (Owner only) |
|------|--------|-------------------------|
| Tenant & users | `Mill`, `User`, `RefreshToken`, `Counter` | — |
| Audit | `AuditLog` | yes |
| Master data | `Supplier`, `Client` | yes |
| Import | `ImportLoad`, `UnloadingEntry`, `LogMeasurement` | `ImportFinancials` |
| Production | `ProductionRun`, `ProductionOutput` | — |
| Stock | `StockMovement` (ledger), `StockAdjustment` | — |
| Export | `ExportLoad`, `ExportMeasurement` | `ExportFinancials` |
| Accounts | — | `Expense` |

**Stock is a ledger.** Raw and finished stock balances are the sum of
`StockMovement` rows. Movements are written **only inside the approval
transaction** (import approved → +raw CFT; production approved → −raw / +finished;
export approved → −finished; adjustment approved → ±). This satisfies "stock must
not change until approved" and gives full traceability to the Import Load ID.

**Approval status** on every operational record:
`DRAFT → SUBMITTED → APPROVED` or `SUBMITTED → REJECTED → (edit) → SUBMITTED`.

**IDs:** human-readable per-mill codes (`IMP-2026-0001`, `EXP-2026-0001`,
`PRD-2026-0001`) generated from the `Counter` table inside a transaction.
Log numbers are sequential per import load (`MAX(logNumber)+1`, unique index).
Log count is always `COUNT(LogMeasurement)` — no default or assumed count.

## 4. CFT formulas & test cases

Implemented in `packages/shared/src/cft.ts`, tested in `cft.test.ts`.
Each line is rounded to 3 decimals; totals are the sum of the rounded lines so
printed reports always add up.

**Import (logs):** `CFT = (Girth × Girth × Length) / 2304` — girth in inches, length in feet.

| # | Length (ft) | Girth (in) | Expected CFT |
|---|------------:|-----------:|-------------:|
| 1 | 8    | 12   | **0.500** (document example) |
| 2 | 10   | 24   | 2.500 |
| 3 | 12   | 36   | 6.750 |
| 4 | 7.5  | 18.5 | 1.114 |
| 5 | 0 or negative | — | rejected (validation error) |

**Export (sawn pieces):** `CFT = (Thickness × Width × Length × Pieces) / 144` — thickness & width in inches, length in feet.

| # | T (in) | W (in) | L (ft) | Pcs | Expected CFT |
|---|------:|------:|------:|----:|-------------:|
| 1 | 4 | 2 | 8 | 10 | **4.444** (document example) |
| 2 | 3 | 2 | 8 | 10 | 3.333 |
| 3 | 2 | 3 | 8 | 20 | 6.667 |
|   |   |   |   | **Total (Method B table)** | **14.444** |
| 4 | 6 | 4 | 12 | 5 | 10.000 |

## 5. API outline

Base path `/api`. ✅ = implemented, with the phase it was delivered in.

| Method & path | Permission | Phase |
|---|---|---|
| `POST /auth/login` | public (rate limited) | ✅ 1 |
| `POST /auth/refresh` | public (refresh token) | ✅ 1 |
| `POST /auth/logout` | authenticated | ✅ 1 |
| `GET /auth/me` | authenticated | ✅ 1 |
| `GET /dashboard/owner` | `dashboard:owner` | ✅ 1 |
| `GET /dashboard/accountant` | `dashboard:accountant` | ✅ 1 |
| `GET/POST /users`, `PATCH /users/:id`, `POST /users/:id/reset-password` | `users:manage` | ✅ 1 |
| `GET /audit-logs` | `audit:view` | ✅ 1 |
| `/imports`, `/imports/:id`, `/imports/:id/unloading` | `operations:create` | ✅ 2 |
| `/imports/:id/logs` | `operations:create` | ✅ 3 |
| `/imports/:id/financials`, `/suppliers` | `finance:view`, `suppliers:manage` | ✅ 2 |
| `/production`, `/production/:id/outputs`, `/stock`, `/stock/movements`, `/stock-adjustments` | `operations:*` | ✅ 4 |
| `POST /{imports,production,stock-adjustments}/:id/submit` · `/approve` · `/reject` | `operations:submit` / `approve` | ✅ 4 (per record type) |
| `/exports`, `/exports/:id/measurements` | `operations:*` | ✅ 5 |
| `/exports/:id/financials`, `/clients` | `finance:view`, `clients:manage` | ✅ 5 |
| `GET /approvals` (queue of everything submitted) | `operations:approve` | ✅ 6 |
| `GET/PATCH /settings` | `settings:manage` | ✅ 6 |
| `GET /accounts/summary`, `/expenses` | `finance:view` | ✅ 7 |
| `GET /reports`, `/reports/:key`, `/reports/:key/xlsx` (PDF = browser print) | `reports:operational` / `reports:financial` | ✅ 7 |

## 6. Screens (wireframe outline)

**Owner (web + mobile):** Dashboard (KPI cards: import/export loads, raw/finished
stock, today's import/export, pending approvals, sales, expenses, pending payments,
P&L) · Accountant Activity Monitor table · Approvals queue · Imports · Production ·
Stock · Exports · Clients · Suppliers · Accounts · Reports · Users · Audit Log · Settings.

**Accountant (web + mobile):** Dashboard (today's import/export entries,
measurement progress, pending / approved / rejected counts) · New Import ·
Log Measurement (big numeric keypad, running count + total CFT) · Production ·
Export + Measurement · My Entries.

Theme: dark green (`#1B4332`) + white. Tamil/English toggle on every screen.

## 7. Phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Project setup, login, role-based dashboards, permission architecture | done |
| 2 | Import management & unloading | built — web checked in a browser; Android not yet run on a device |
| 3 | Import measurement & CFT | built — same as Phase 2. Submitted/approved loads are locked for everyone until Phase 6 |
| 4 | Production & stock | built (web) — production runs with finished sizes, stock by load/size, movement history, adjustments; submit/approve/reject on each record page. Android screens not yet built. The Approvals queue page is still Phase 6 |
| 5 | Export management & measurement | built (web) — export loads, lines picked from finished stock (each line names its import load), owner-only sale details and clients. Android screens not yet built |
| 6 | Approval workflow & owner controls | built (web) — approval queue across imports, production, exports and adjustments; mill settings (name, unloading rate, new-user language, time zone). Android screens not yet built |
| 7 | Accounts, reports & analytics (PDF/Excel) | built (web) — Accounts: P&L for any period, other expenses, supplier/client balances. Reports: import/production/export registers, stock summary, P&L, balances, expenses; Excel download (server, exceljs) and Print / Save as PDF (browser, keeps Tamil text correct). Android screens not yet built |
| 8 | Security testing, UAT, deployment, backups | — |

Per the kickoff document, Phases 2–3 (Import + Measurement) will be demonstrated
for workflow approval before Phases 4+ are built.

## 8. Open questions for the client

1. Login identifier: username (current) or mobile number + OTP?
2. Should unloading rate per hour default from a mill setting, editable per entry?
3. Is accountant allowed to see unloading charges (they enter them)? Currently yes.
4. Rounding: 3 decimals per log, total = sum of rounded lines — confirm.
5. Can one export lorry carry stock from multiple import loads? (Schema allows one
   reference per export *measurement line*, so yes.)
6. Production: is input raw CFT recorded per run, or derived at load level?
   *Built as: entered per run (the form offers "use all" of what's left in the load).
   Waste = input − finished CFT. Finished CFT higher than input is allowed but flagged,
   since log CFT (girth formula) can under-measure.* Confirm with the client.
7. Stock never goes below zero: approving a run, an adjustment, or an owner correction
   that would overdraw a load is refused. Confirm this is wanted (vs. allowing it with a warning).
