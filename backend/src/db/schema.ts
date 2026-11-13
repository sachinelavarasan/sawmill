/**
 * SAWMILL PRO — complete database architecture (Drizzle ORM, PostgreSQL).
 *
 * Every business table carries millId (multi-sawmill). Tables marked
 * [OWNER-ONLY] hold restricted data and are never read by accountant endpoints.
 * numeric columns are returned as strings by the driver — convert explicitly.
 */
import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ───────────────────────── Enums ─────────────────────────

export const roleEnum = pgEnum('role', ['OWNER', 'ACCOUNTANT']);
export const approvalStatusEnum = pgEnum('approval_status', ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']);
export const stockKindEnum = pgEnum('stock_kind', ['RAW', 'FINISHED']);
export const stockSourceEnum = pgEnum('stock_source', [
  'IMPORT',
  'PRODUCTION_INPUT',
  'PRODUCTION_OUTPUT',
  'EXPORT',
  'ADJUSTMENT',
]);
export const paymentStatusEnum = pgEnum('payment_status', ['UNPAID', 'PARTIAL', 'PAID']);

// ───────────────────────── Column helpers ─────────────────────────

const id = () => uuid('id').primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => ts('created_at').notNull().defaultNow();
const updatedAt = () =>
  ts('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const millRef = () =>
  uuid('mill_id')
    .notNull()
    .references(() => mills.id);
const cftCol = (name: string) => numeric(name, { precision: 14, scale: 3 });
const moneyCol = (name: string) => numeric(name, { precision: 14, scale: 2 });
const dimCol = (name: string) => numeric(name, { precision: 8, scale: 2 });

/** Columns shared by every record that goes through Owner approval. */
const approvalColumns = () => ({
  status: approvalStatusEnum('status').notNull().default('DRAFT'),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id),
  submittedAt: ts('submitted_at'),
  reviewedById: uuid('reviewed_by_id').references(() => users.id),
  reviewedAt: ts('reviewed_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ───────────────────────── Tenant, users, security ─────────────────────────

export interface MillSettings {
  defaultUnloadingRatePerHour?: number;
  defaultLanguage?: 'en' | 'ta';
  /** minutes from UTC used for "today" (default 330 = India) */
  utcOffsetMinutes?: number;
}

export const mills = pgTable('mills', {
  id: id(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  settings: jsonb('settings').$type<MillSettings>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable(
  'users',
  {
    id: id(),
    millId: millRef(),
    name: text('name').notNull(),
    /** stored lower-case, globally unique login id */
    username: text('username').notNull().unique(),
    phone: text('phone'),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    preferredLanguage: text('preferred_language').notNull().default('en'),
    lastLoginAt: ts('last_login_at'),
    /** bumped to end every session at once (password reset, disable, role change) — checked on each request */
    tokenVersion: integer('token_version').notNull().default(0),
    createdById: uuid('created_by_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('users_mill_role_idx').on(t.millId, t.role)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the token; the raw token is never stored */
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [index('refresh_tokens_user_idx').on(t.userId)],
);

/** [OWNER-ONLY] Every important action, with before/after snapshots. */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    millId: millRef(),
    userId: uuid('user_id').references(() => users.id),
    action: text('action').notNull(), // LOGIN, CREATE, UPDATE, SUBMIT, APPROVE, REJECT, OWNER_EDIT …
    entityType: text('entity_type').notNull(), // User, ImportLoad, LogMeasurement …
    entityId: text('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_logs_mill_created_idx').on(t.millId, t.createdAt),
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
  ],
);

/** Per-mill sequential codes: IMP-2026-0001, EXP-2026-0001, PRD-2026-0001 … */
export const counters = pgTable(
  'counters',
  {
    millId: millRef(),
    key: text('key').notNull(),
    value: integer('value').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.millId, t.key] })],
);

// ───────────────────────── Master data [OWNER-ONLY] ─────────────────────────

export const suppliers = pgTable(
  'suppliers',
  {
    id: id(),
    millId: millRef(),
    name: text('name').notNull(),
    phone: text('phone'),
    address: text('address'),
    gstNumber: text('gst_number'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('suppliers_mill_idx').on(t.millId)],
);

export const clients = pgTable(
  'clients',
  {
    id: id(),
    millId: millRef(),
    name: text('name').notNull(),
    phone: text('phone'),
    address: text('address'),
    gstNumber: text('gst_number'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('clients_mill_idx').on(t.millId)],
);

// ───────────────────────── Import ─────────────────────────

export const importLoads = pgTable(
  'import_loads',
  {
    id: id(),
    millId: millRef(),
    code: text('code').notNull(), // IMP-2026-0001
    arrivalAt: ts('arrival_at').notNull(),
    lorryNumber: text('lorry_number').notNull(),
    driverName: text('driver_name'),
    driverMobile: text('driver_mobile'),
    lorryOwnerName: text('lorry_owner_name'),
    lorryOwnerMobile: text('lorry_owner_mobile'),
    originLocation: text('origin_location'),
    /** free text entered by the user — no hard-coded default */
    woodType: text('wood_type').notNull(),
    woodCategory: text('wood_category'),
    notes: text('notes'),
    /** denormalised; recomputed from log_measurements on every change */
    totalLogs: integer('total_logs').notNull().default(0),
    totalCft: cftCol('total_cft').notNull().default('0'),
    ...approvalColumns(),
  },
  (t) => [
    uniqueIndex('import_loads_mill_code_uq').on(t.millId, t.code),
    index('import_loads_mill_status_idx').on(t.millId, t.status),
    index('import_loads_mill_arrival_idx').on(t.millId, t.arrivalAt),
    index('import_loads_created_by_idx').on(t.createdById),
  ],
);

export const unloadingEntries = pgTable(
  'unloading_entries',
  {
    id: id(),
    importLoadId: uuid('import_load_id')
      .notNull()
      .references(() => importLoads.id, { onDelete: 'cascade' }),
    vehicleNumber: text('vehicle_number').notNull(),
    driverName: text('driver_name'),
    driverMobile: text('driver_mobile'),
    vehicleOwnerName: text('vehicle_owner_name'),
    startAt: ts('start_at').notNull(),
    endAt: ts('end_at'),
    durationMinutes: integer('duration_minutes'),
    ratePerHour: numeric('rate_per_hour', { precision: 12, scale: 2 }),
    totalCharges: moneyCol('total_charges'),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('unloading_import_idx').on(t.importLoadId)],
);

export const logMeasurements = pgTable(
  'log_measurements',
  {
    id: id(),
    importLoadId: uuid('import_load_id')
      .notNull()
      .references(() => importLoads.id, { onDelete: 'cascade' }),
    /** sequential per import load; log count = number of rows (no assumed total) */
    logNumber: integer('log_number').notNull(),
    lengthFt: dimCol('length_ft').notNull(),
    girthIn: dimCol('girth_in').notNull(),
    cft: numeric('cft', { precision: 12, scale: 3 }).notNull(),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('log_measurements_load_number_uq').on(t.importLoadId, t.logNumber)],
);

/** [OWNER-ONLY] purchase side of an import load */
export const importFinancials = pgTable('import_financials', {
  id: id(),
  importLoadId: uuid('import_load_id')
    .notNull()
    .unique()
    .references(() => importLoads.id, { onDelete: 'cascade' }),
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  purchaseRatePerCft: numeric('purchase_rate_per_cft', { precision: 12, scale: 2 }),
  purchaseAmount: moneyCol('purchase_amount'),
  transportCharges: moneyCol('transport_charges'),
  amountPaid: moneyCol('amount_paid').notNull().default('0'),
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('UNPAID'),
  notes: text('notes'),
  updatedAt: updatedAt(),
});

// ───────────────────────── Production ─────────────────────────

export const productionRuns = pgTable(
  'production_runs',
  {
    id: id(),
    millId: millRef(),
    code: text('code').notNull(), // PRD-2026-0001
    importLoadId: uuid('import_load_id')
      .notNull()
      .references(() => importLoads.id),
    woodType: text('wood_type').notNull(),
    productionDate: date('production_date', { mode: 'string' }).notNull(),
    cuttingMachine: text('cutting_machine'),
    machineOperator: text('machine_operator'),
    workerDetails: text('worker_details'),
    startAt: ts('start_at'),
    endAt: ts('end_at'),
    /** raw CFT consumed from the import load's raw stock */
    inputCft: cftCol('input_cft'),
    outputCft: cftCol('output_cft').notNull().default('0'),
    wasteCft: cftCol('waste_cft'),
    wasteNotes: text('waste_notes'),
    ...approvalColumns(),
  },
  (t) => [
    uniqueIndex('production_runs_mill_code_uq').on(t.millId, t.code),
    index('production_runs_mill_status_idx').on(t.millId, t.status),
    index('production_runs_import_idx').on(t.importLoadId),
  ],
);

/** one row per finished size (4×2, 3×2, 2×3 …) */
export const productionOutputs = pgTable('production_outputs', {
  id: id(),
  productionRunId: uuid('production_run_id')
    .notNull()
    .references(() => productionRuns.id, { onDelete: 'cascade' }),
  thicknessIn: dimCol('thickness_in').notNull(),
  widthIn: dimCol('width_in').notNull(),
  lengthFt: dimCol('length_ft').notNull(),
  pieces: integer('pieces').notNull(),
  cft: numeric('cft', { precision: 12, scale: 3 }).notNull(),
});

// ───────────────────────── Stock (ledger) ─────────────────────────

/**
 * Written ONLY when the source transaction is approved.
 * Balance = SUM(pieces_delta / cft_delta) grouped by kind, wood type, size, import load.
 */
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: id(),
    millId: millRef(),
    kind: stockKindEnum('kind').notNull(),
    woodType: text('wood_type').notNull(),
    importLoadId: uuid('import_load_id')
      .notNull()
      .references(() => importLoads.id),
    thicknessIn: dimCol('thickness_in'),
    widthIn: dimCol('width_in'),
    lengthFt: dimCol('length_ft'),
    piecesDelta: integer('pieces_delta').notNull().default(0),
    cftDelta: cftCol('cft_delta').notNull(),
    source: stockSourceEnum('source').notNull(),
    sourceId: uuid('source_id').notNull(),
    postedById: uuid('posted_by_id')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('stock_movements_mill_kind_wood_idx').on(t.millId, t.kind, t.woodType),
    index('stock_movements_import_idx').on(t.importLoadId),
    index('stock_movements_source_idx').on(t.source, t.sourceId),
  ],
);

export const stockAdjustments = pgTable(
  'stock_adjustments',
  {
    id: id(),
    millId: millRef(),
    code: text('code').notNull(), // ADJ-2026-0001
    kind: stockKindEnum('kind').notNull(),
    woodType: text('wood_type').notNull(),
    importLoadId: uuid('import_load_id')
      .notNull()
      .references(() => importLoads.id),
    thicknessIn: dimCol('thickness_in'),
    widthIn: dimCol('width_in'),
    lengthFt: dimCol('length_ft'),
    piecesDelta: integer('pieces_delta').notNull().default(0),
    cftDelta: cftCol('cft_delta').notNull(),
    reason: text('reason').notNull(),
    ...approvalColumns(),
  },
  (t) => [
    uniqueIndex('stock_adjustments_mill_code_uq').on(t.millId, t.code),
    index('stock_adjustments_mill_status_idx').on(t.millId, t.status),
  ],
);

// ───────────────────────── Export ─────────────────────────

export const exportLoads = pgTable(
  'export_loads',
  {
    id: id(),
    millId: millRef(),
    code: text('code').notNull(), // EXP-2026-0001
    exportDate: date('export_date', { mode: 'string' }).notNull(),
    lorryNumber: text('lorry_number').notNull(),
    driverName: text('driver_name'),
    driverMobile: text('driver_mobile'),
    lorryOwnerName: text('lorry_owner_name'),
    lorryOwnerMobile: text('lorry_owner_mobile'),
    startAt: ts('start_at'),
    endAt: ts('end_at'),
    woodType: text('wood_type').notNull(),
    /** primary import load reference; each measurement line may also carry its own */
    importLoadId: uuid('import_load_id').references(() => importLoads.id),
    notes: text('notes'),
    totalPieces: integer('total_pieces').notNull().default(0),
    totalCft: cftCol('total_cft').notNull().default('0'),
    ...approvalColumns(),
  },
  (t) => [
    uniqueIndex('export_loads_mill_code_uq').on(t.millId, t.code),
    index('export_loads_mill_status_idx').on(t.millId, t.status),
    index('export_loads_mill_date_idx').on(t.millId, t.exportDate),
    index('export_loads_created_by_idx').on(t.createdById),
  ],
);

export const exportMeasurements = pgTable(
  'export_measurements',
  {
    id: id(),
    exportLoadId: uuid('export_load_id')
      .notNull()
      .references(() => exportLoads.id, { onDelete: 'cascade' }),
    lineNumber: integer('line_number').notNull(),
    importLoadId: uuid('import_load_id').references(() => importLoads.id),
    thicknessIn: dimCol('thickness_in').notNull(),
    widthIn: dimCol('width_in').notNull(),
    lengthFt: dimCol('length_ft').notNull(),
    pieces: integer('pieces').notNull(),
    cft: numeric('cft', { precision: 12, scale: 3 }).notNull(),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('export_measurements_load_line_uq').on(t.exportLoadId, t.lineNumber)],
);

/** [OWNER-ONLY] sale side of an export load — the client link lives here, not on export_loads */
export const exportFinancials = pgTable('export_financials', {
  id: id(),
  exportLoadId: uuid('export_load_id')
    .notNull()
    .unique()
    .references(() => exportLoads.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id),
  sellingRatePerCft: numeric('selling_rate_per_cft', { precision: 12, scale: 2 }),
  saleAmount: moneyCol('sale_amount'),
  amountReceived: moneyCol('amount_received').notNull().default('0'),
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('UNPAID'),
  notes: text('notes'),
  updatedAt: updatedAt(),
});

// ───────────────────────── Accounts [OWNER-ONLY] ─────────────────────────

export const expenses = pgTable(
  'expenses',
  {
    id: id(),
    millId: millRef(),
    date: date('date', { mode: 'string' }).notNull(),
    category: text('category').notNull(), // labour, unloading, electricity, maintenance, transport …
    amount: moneyCol('amount').notNull(),
    importLoadId: uuid('import_load_id').references(() => importLoads.id),
    notes: text('notes'),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('expenses_mill_date_idx').on(t.millId, t.date)],
);

// ───────────────────────── Relations (for db.query.*) ─────────────────────────

export const millsRelations = relations(mills, ({ many }) => ({ users: many(users) }));
export const usersRelations = relations(users, ({ one }) => ({
  mill: one(mills, { fields: [users.millId], references: [mills.id] }),
}));
export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));
export const importLoadsRelations = relations(importLoads, ({ many, one }) => ({
  unloadings: many(unloadingEntries),
  logs: many(logMeasurements),
  financials: one(importFinancials, { fields: [importLoads.id], references: [importFinancials.importLoadId] }),
}));
export const unloadingEntriesRelations = relations(unloadingEntries, ({ one }) => ({
  importLoad: one(importLoads, { fields: [unloadingEntries.importLoadId], references: [importLoads.id] }),
}));
export const logMeasurementsRelations = relations(logMeasurements, ({ one }) => ({
  importLoad: one(importLoads, { fields: [logMeasurements.importLoadId], references: [importLoads.id] }),
}));
export const productionRunsRelations = relations(productionRuns, ({ many }) => ({ outputs: many(productionOutputs) }));
export const productionOutputsRelations = relations(productionOutputs, ({ one }) => ({
  run: one(productionRuns, { fields: [productionOutputs.productionRunId], references: [productionRuns.id] }),
}));
export const exportLoadsRelations = relations(exportLoads, ({ many, one }) => ({
  measurements: many(exportMeasurements),
  financials: one(exportFinancials, { fields: [exportLoads.id], references: [exportFinancials.exportLoadId] }),
}));
export const exportMeasurementsRelations = relations(exportMeasurements, ({ one }) => ({
  exportLoad: one(exportLoads, { fields: [exportMeasurements.exportLoadId], references: [exportLoads.id] }),
}));

export type Role = (typeof roleEnum.enumValues)[number];
export type ApprovalStatus = (typeof approvalStatusEnum.enumValues)[number];
export type User = typeof users.$inferSelect;
export type Mill = typeof mills.$inferSelect;
