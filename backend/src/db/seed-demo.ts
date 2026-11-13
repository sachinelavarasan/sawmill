/*
 * Demo data for every screen: ~6 months of imports, production, stock, exports,
 * money and audit history for the DEMO mill, dated relative to today so the
 * dashboards and charts are full whenever it is run.
 *
 *   npm run db:seed          # first: the mill, owner and accountant
 *   npm run db:seed:demo     # then this
 *   npm run db:seed:demo:reset   # wipe the DEMO mill's records and re-create them
 *
 * Rows are written directly (not through the API) so they can be back-dated, but
 * follow the same rules: CFT from the shared formulas, stock movements only for
 * approved records, and nothing in the queue that could not be approved.
 * Development only — refuses to run with NODE_ENV=production.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { exportPieceCft, importLogCft, productionWaste, roundTo, totalCft, unloadingCharges } from '@sawmill/shared';
import * as bcrypt from 'bcryptjs';
import { eq, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { assertStockNotNegative } from '../stock/ledger';
import * as s from './schema';
import { databaseUrl } from './url';

const MILL_CODE = 'DEMO';
const RESET = process.argv.includes('--reset');
const DEMO_PASSWORD = 'Accountant@123';

// ───────────────────────── small helpers ─────────────────────────

/** Deterministic random numbers (mulberry32), so every run produces the same mill. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260101);
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)];
const money = (n: number) => roundTo(n, 2);
const str = (n: number) => String(n);

const MIN = 60_000;
const DAY = 86_400_000;

type Status = s.ApprovalStatus;
type Row<T extends { $inferInsert: unknown }> = T['$inferInsert'];

interface Wood {
  name: string;
  category: string;
  girth: [number, number];
  buy: number;
  sell: number;
  origins: string[];
  supplier: number;
}
const WOODS: Wood[] = [
  { name: 'Teak', category: 'Hardwood', girth: [36, 72], buy: 1200, sell: 4100, origins: ['Nilambur, Kerala', 'Dandeli, Karnataka'], supplier: 0 },
  { name: 'Sal', category: 'Hardwood', girth: [40, 78], buy: 550, sell: 1850, origins: ['Raipur, Chhattisgarh', 'Balaghat, Madhya Pradesh'], supplier: 1 },
  { name: 'Pine', category: 'Softwood', girth: [30, 58], buy: 320, sell: 1150, origins: ['Tuticorin Port (New Zealand pine)', 'Kandla Port'], supplier: 2 },
  { name: 'Neem', category: 'Country wood', girth: [30, 62], buy: 380, sell: 1350, origins: ['Dharmapuri, Tamil Nadu', 'Salem, Tamil Nadu'], supplier: 3 },
];
const WOOD_ORDER = [0, 1, 0, 2, 3, 0, 1, 2, 0, 3];

/** Sawn sections (thickness × width, inches) and lengths (feet) the mill cuts. */
const SECTIONS: [number, number][] = [[4, 2], [3, 2], [2, 3], [6, 2], [4, 3], [6, 3], [1.5, 6], [1, 8], [1, 12]];
const LENGTHS = [6, 8, 10, 12];

const SUPPLIERS = [
  { name: 'Nilambur Teak Traders', phone: '9847012345', address: 'Forest Depot Road, Nilambur, Kerala', gstNumber: '32AAKFN4521C1Z8', notes: 'Teak logs, auction lots. Payment within 30 days.' },
  { name: 'Shree Balaji Timber Depot', phone: '9425167890', address: 'Fafadih Chowk, Raipur, Chhattisgarh', gstNumber: '22AAECS7812H1Z3', notes: 'Sal logs by rail + lorry.' },
  { name: 'Coastal Timber Imports', phone: '9443355667', address: 'Harbour Estate, Tuticorin, Tamil Nadu', gstNumber: '33AABCC9087M1ZQ', notes: 'Imported pine, container lots.' },
  { name: 'Salem Country Wood Suppliers', phone: '9865023411', address: 'Omalur Main Road, Salem, Tamil Nadu', gstNumber: null, notes: 'Neem and other farm-grown logs. Cash on delivery.' },
  { name: 'Western Ghats Timber Co.', phone: '9448076512', address: 'Timber Yard, Dandeli, Karnataka', gstNumber: '29AACCW3345K1Z1', notes: null },
];
const CLIENTS = [
  { name: 'Sri Murugan Furniture Works', phone: '9842211034', address: 'Avinashi Road, Coimbatore', gstNumber: '33AAFFS2210B1Z6', notes: 'Teak sections, pays monthly.' },
  { name: 'Annamalai Builders', phone: '9790045218', address: 'Anna Nagar, Madurai', gstNumber: '33AAJCA5567F1ZV', notes: 'Door and window frames for housing projects.' },
  { name: 'Lakshmi Doors & Plywood', phone: '9003377120', address: 'Mettupalayam Road, Coimbatore', gstNumber: '33AADFL8891Q1Z4', notes: null },
  { name: 'Kovai Packaging Industries', phone: '9655512087', address: 'SIDCO Industrial Estate, Kurichi', gstNumber: '33AAGCK1123P1Z9', notes: 'Pine planks for pallets and crates.' },
  { name: 'Ravi Timber Mart', phone: '9360078455', address: 'Gandhipuram, Erode', gstNumber: null, notes: 'Retail timber shop. Collects by own lorry.' },
];
const DRIVERS = ['Murugan', 'Selvam', 'Rajesh', 'Shaji', 'Basavaraj', 'Karthik', 'Anwar', 'Suresh', 'Ganesan', 'Biju'];
const LORRY_OWNERS = ['KPN Transports', 'Sri Vinayaga Lorry Service', 'Malabar Roadways', 'VRL Logistics', 'Annai Transports'];
const CRANES = [
  { vehicleNumber: 'TN 37 CR 4412', driverName: 'Palani', vehicleOwnerName: 'Sakthi Crane Service' },
  { vehicleNumber: 'TN 66 JC 0917', driverName: 'Dinesh', vehicleOwnerName: 'Vel JCB & Crane' },
];
const MACHINES = ['Band saw 1', 'Band saw 2', 'Horizontal band saw'];
const OPERATORS = ['Mani', 'Senthil', 'Arumugam'];

const phone = () => `9${int(600000000, 999999999)}`;
const lorry = (state = 'TN') => `${state} ${int(10, 99)} ${pick(['AB', 'BC', 'CK', 'DM', 'AX', 'BZ'])} ${int(1000, 9999)}`;
const paymentStatus = (amount: number, paid: number) => (paid <= 0 ? 'UNPAID' : paid >= amount ? 'PAID' : 'PARTIAL') as 'UNPAID' | 'PARTIAL' | 'PAID';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo data is for development only (NODE_ENV=production)');

  const pool = new Pool({ connectionString: databaseUrl() });
  const db = drizzle(pool, { schema: s });

  const [mill] = await db.select({ id: s.mills.id, settings: s.mills.settings }).from(s.mills).where(eq(s.mills.code, MILL_CODE));
  if (!mill) throw new Error(`Mill ${MILL_CODE} not found — run "npm run db:seed" first`);
  const millId = mill.id;
  const off = Number(mill.settings?.utcOffsetMinutes ?? 330);
  const standardRate = Number(mill.settings?.defaultUnloadingRatePerHour ?? 500);

  // ───────── time: everything is relative to "now", in the mill's local days ─────────
  const now = Date.now();
  const today = new Date(now + off * MIN).toISOString().slice(0, 10);
  /** The local date `d` days ago, YYYY-MM-DD. */
  const day = (d: number) => new Date(Date.parse(`${today}T00:00:00Z`) - d * DAY).toISOString().slice(0, 10);
  /** `d` days ago at hh:mm local time (never in the future). */
  const at = (d: number, h: number, m = 0) => new Date(Math.min(Date.parse(`${day(d)}T00:00:00Z`) + (h * 60 + m - off) * MIN, now - MIN));
  const plus = (t: Date, minutes: number) => new Date(Math.min(t.getTime() + minutes * MIN, now - MIN));
  const ago = (minutes: number) => new Date(now - minutes * MIN);
  const localYear = (t: Date) => new Date(t.getTime() + off * MIN).getUTCFullYear();

  await db.transaction(async (tx) => {
    // ───────── guard / reset ─────────
    const [{ n: existing }] = await tx
      .select({ n: sql<number>`(select count(*) from ${s.importLoads} where ${s.importLoads.millId} = ${millId})::int
        + (select count(*) from ${s.suppliers} where ${s.suppliers.millId} = ${millId})::int
        + (select count(*) from ${s.clients} where ${s.clients.millId} = ${millId})::int
        + (select count(*) from ${s.expenses} where ${s.expenses.millId} = ${millId})::int` })
      .from(s.mills)
      .where(eq(s.mills.id, millId));
    if (existing > 0) {
      if (!RESET) {
        throw new Error(
          `The ${MILL_CODE} mill already has records. To delete ALL of its imports, production, stock, exports, expenses, suppliers, clients and audit history and re-create the demo data, run: npm run db:seed:demo:reset`,
        );
      }
      await tx.delete(s.stockMovements).where(eq(s.stockMovements.millId, millId));
      await tx.delete(s.stockAdjustments).where(eq(s.stockAdjustments.millId, millId));
      await tx.delete(s.exportLoads).where(eq(s.exportLoads.millId, millId)); // lines + sale details cascade
      await tx.delete(s.expenses).where(eq(s.expenses.millId, millId));
      await tx.delete(s.productionRuns).where(eq(s.productionRuns.millId, millId)); // outputs cascade
      await tx.delete(s.importLoads).where(eq(s.importLoads.millId, millId)); // unloading, logs, purchase details cascade
      await tx.delete(s.suppliers).where(eq(s.suppliers.millId, millId));
      await tx.delete(s.clients).where(eq(s.clients.millId, millId));
      await tx.delete(s.counters).where(eq(s.counters.millId, millId));
      await tx.delete(s.auditLogs).where(eq(s.auditLogs.millId, millId));
      console.log(`Reset: deleted the ${MILL_CODE} mill's existing records`);
    }

    // ───────── users (raw SQL with explicit columns, so a pending users migration can't break the seed) ─────────
    const ownerName = (process.env.SEED_OWNER_USERNAME ?? 'owner').toLowerCase();
    const accName = (process.env.SEED_ACCOUNTANT_USERNAME ?? 'accountant').toLowerCase();
    const userCols = { id: s.users.id, username: s.users.username, role: s.users.role, millId: s.users.millId };
    const base = await tx.select(userCols).from(s.users).where(inArray(s.users.username, [ownerName, accName]));
    const owner = base.find((u) => u.username === ownerName && u.role === 'OWNER' && u.millId === millId);
    const acc1 = base.find((u) => u.username === accName && u.role === 'ACCOUNTANT' && u.millId === millId);
    if (!owner || !acc1) throw new Error(`Users "${ownerName}" and "${accName}" not found in ${MILL_CODE} — run "npm run db:seed" first`);

    const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const extraUsers = [
      { username: 'priya', name: 'Priya S', phone: '9876501234', active: true, lang: 'ta', createdAt: at(150, 10), lastLoginAt: at(0, 8, 10) },
      { username: 'kumar', name: 'Kumar R', phone: '9876505678', active: false, lang: 'en', createdAt: at(178, 10), lastLoginAt: at(96, 8, 30) },
    ];
    for (const u of extraUsers) {
      await tx.execute(sql`
        insert into users (mill_id, name, username, phone, password_hash, role, is_active, preferred_language, last_login_at, created_by_id, created_at, updated_at)
        values (${millId}, ${u.name}, ${u.username}, ${u.phone}, ${hash}, 'ACCOUNTANT', ${u.active}, ${u.lang}, ${u.lastLoginAt.toISOString()}, ${owner.id}, ${u.createdAt.toISOString()}, ${u.createdAt.toISOString()})
        on conflict (username) do nothing`);
    }
    const extras = await tx.select(userCols).from(s.users).where(inArray(s.users.username, extraUsers.map((u) => u.username)));
    const priya = extras.find((u) => u.username === 'priya' && u.millId === millId);
    const kumar = extras.find((u) => u.username === 'kumar' && u.millId === millId);
    if (!priya || !kumar) throw new Error('Usernames "priya" / "kumar" are already taken by another mill');

    // ───────── collectors ─────────
    const audits: Row<typeof s.auditLogs>[] = [];
    const audit = (createdAt: Date, userId: string, action: string, entityType: string, entityId: string, after?: unknown, ip: string | null = null) =>
      audits.push({ millId, userId, action, entityType, entityId, after: after ?? null, ip, createdAt });
    const movements: Row<typeof s.stockMovements>[] = [];
    const counters = new Map<string, number>();
    const code = (prefix: 'IMP' | 'PRD' | 'EXP' | 'ADJ', createdAt: Date) => {
      const key = `${prefix}-${localYear(createdAt)}`;
      const value = (counters.get(key) ?? 0) + 1;
      counters.set(key, value);
      return `${key}-${String(value).padStart(4, '0')}`;
    };
    /** The approval columns for a record in `status`. */
    const approval = (status: Status, createdById: string, createdAt: Date, submittedAt: Date, reviewedAt: Date, rejectionReason?: string) => ({
      status,
      createdById,
      createdAt,
      submittedAt: status === 'DRAFT' ? null : submittedAt,
      reviewedById: status === 'APPROVED' || status === 'REJECTED' ? owner.id : null,
      reviewedAt: status === 'APPROVED' || status === 'REJECTED' ? reviewedAt : null,
      rejectionReason: status === 'REJECTED' ? (rejectionReason ?? null) : null,
      updatedAt: status === 'DRAFT' ? createdAt : status === 'SUBMITTED' ? submittedAt : reviewedAt,
    });
    /** CREATE / SUBMIT / APPROVE / REJECT audit rows for an approvable record. */
    const auditTrail = (entityType: string, r: { id: string; code: string; status: Status; createdById: string; createdAt: Date; submittedAt: Date | null; reviewedAt: Date | null }) => {
      audit(r.createdAt, r.createdById, 'CREATE', entityType, r.id, { code: r.code, status: 'DRAFT' });
      if (r.submittedAt) audit(r.submittedAt, r.createdById, 'SUBMIT', entityType, r.id, { code: r.code, status: 'SUBMITTED' });
      if (r.reviewedAt) audit(r.reviewedAt, owner.id, r.status === 'APPROVED' ? 'APPROVE' : 'REJECT', entityType, r.id, { code: r.code, status: r.status });
    };

    // ───────── suppliers & clients ─────────
    const setupAt = at(176, 11);
    const suppliers = SUPPLIERS.map((p, i) => ({ id: randomUUID(), millId, ...p, createdAt: plus(setupAt, i * 4), updatedAt: plus(setupAt, i * 4) }));
    const clients = CLIENTS.map((p, i) => ({ id: randomUUID(), millId, ...p, createdAt: plus(setupAt, 30 + i * 4), updatedAt: plus(setupAt, 30 + i * 4) }));
    for (const p of suppliers) audit(p.createdAt, owner.id, 'CREATE', 'Supplier', p.id, { name: p.name });
    for (const p of clients) audit(p.createdAt, owner.id, 'CREATE', 'Client', p.id, { name: p.name });
    audit(at(177, 9, 40), owner.id, 'UPDATE', 'Mill', millId, { settings: mill.settings });
    audit(extraUsers[1].createdAt, owner.id, 'CREATE', 'User', kumar.id, { username: 'kumar', role: 'ACCOUNTANT' });
    audit(extraUsers[0].createdAt, owner.id, 'CREATE', 'User', priya.id, { username: 'priya', role: 'ACCOUNTANT' });
    audit(at(95, 18, 5), owner.id, 'UPDATE', 'User', kumar.id, { username: 'kumar', isActive: false });

    // ───────── imports ─────────
    interface Import {
      row: Row<typeof s.importLoads> & { id: string; createdAt: Date; code: string; status: Status; createdById: string; submittedAt: Date | null; reviewedAt: Date | null };
      wood: Wood;
      d: number;
      cft: number;
      /** raw CFT not yet used (or promised to a submitted run / adjustment) */
      rawLeft: number;
    }
    const imports: Import[] = [];
    const unloadings: Row<typeof s.unloadingEntries>[] = [];
    const logs: Row<typeof s.logMeasurements>[] = [];
    const importFinancials: Row<typeof s.importFinancials>[] = [];

    interface ImportSpec {
      d: number;
      status: Status;
      creator: string;
      wood: Wood;
      logCount: number;
      /** today's loads are placed relative to now instead of a clock time */
      arrival?: Date;
      unloading?: 'done' | 'running' | 'none';
      reason?: string;
      notes?: string;
    }
    const importSpecs: ImportSpec[] = [];
    const APPROVED_DAYS = [172, 166, 160, 154, 148, 142, 136, 130, 124, 118, 112, 106, 100, 94, 88, 82, 76, 70, 64, 58, 52, 46, 40, 34, 28, 22, 16, 10, 8, 4];
    APPROVED_DAYS.forEach((d, i) => {
      const creator = d > 100 && i % 4 === 1 ? kumar.id : i % 3 === 2 ? priya.id : i % 10 === 6 ? owner.id : acc1.id;
      importSpecs.push({ d, status: 'APPROVED', creator, wood: WOODS[WOOD_ORDER[i % WOOD_ORDER.length]], logCount: int(28, 52) });
    });
    importSpecs.push(
      { d: 5, status: 'REJECTED', creator: acc1.id, wood: WOODS[1], logCount: 31, reason: 'Girth of logs 12 to 15 looks too high — please re-measure and submit again.' },
      { d: 3, status: 'SUBMITTED', creator: acc1.id, wood: WOODS[0], logCount: 44 },
      { d: 2, status: 'SUBMITTED', creator: priya.id, wood: WOODS[2], logCount: 38 },
      { d: 2, status: 'REJECTED', creator: priya.id, wood: WOODS[3], logCount: 26, reason: 'Lorry number does not match the weighbridge slip.' },
      { d: 1, status: 'SUBMITTED', creator: acc1.id, wood: WOODS[1], logCount: 35 },
      { d: 1, status: 'DRAFT', creator: acc1.id, wood: WOODS[0], logCount: 18, notes: 'Measuring paused at log 18 — rain. Continue tomorrow.' },
      { d: 0, status: 'DRAFT', creator: acc1.id, wood: WOODS[3], logCount: 9, arrival: ago(150), unloading: 'running' },
      { d: 0, status: 'DRAFT', creator: priya.id, wood: WOODS[2], logCount: 0, arrival: ago(40), unloading: 'none', notes: 'Waiting for the crane.' },
    );

    for (const spec of importSpecs) {
      const { wood, d } = spec;
      const id = randomUUID();
      const arrivalAt = spec.arrival ?? at(d, int(6, 10), int(0, 59));
      const createdAt = plus(arrivalAt, 8);

      // unloading: one crane, sometimes a second one after it
      let lastTouch = createdAt;
      const mode = spec.unloading ?? 'done';
      if (mode !== 'none') {
        const count = mode === 'done' && rnd() < 0.2 ? 2 : 1;
        let startAt = plus(arrivalAt, 22);
        for (let u = 0; u < count; u++) {
          const crane = CRANES[(imports.length + u) % CRANES.length];
          const minutes = int(55, 165);
          const rate = pick([standardRate, standardRate, standardRate, 450, 600]);
          const endAt = mode === 'running' ? null : plus(startAt, minutes);
          unloadings.push({
            importLoadId: id,
            ...crane,
            driverMobile: phone(),
            startAt,
            endAt,
            durationMinutes: endAt ? minutes : null,
            ratePerHour: str(rate),
            totalCharges: endAt ? str(unloadingCharges(minutes, rate)) : null,
            createdById: spec.creator,
            createdAt: startAt,
            updatedAt: endAt ?? startAt,
          });
          if (endAt) startAt = plus(endAt, 10);
        }
      }

      // logs, measured one after another
      const cfts: number[] = [];
      const firstLogAt = plus(arrivalAt, 40);
      const gap = spec.arrival ? 3 : 2.4;
      for (let n = 1; n <= spec.logCount; n++) {
        const girthIn = int(wood.girth[0], wood.girth[1]) + (rnd() < 0.3 ? 0.5 : 0);
        const lengthFt = pick([8, 10, 10, 12, 12, 14, 16, 18, 20]) + (rnd() < 0.15 ? 0.5 : 0);
        const cft = importLogCft(girthIn, lengthFt);
        cfts.push(cft);
        const measuredAt = plus(firstLogAt, Math.round(n * gap));
        logs.push({ importLoadId: id, logNumber: n, lengthFt: str(lengthFt), girthIn: str(girthIn), cft: str(cft), createdById: spec.creator, createdAt: measuredAt, updatedAt: measuredAt });
        lastTouch = measuredAt;
      }
      const cft = totalCft(cfts);

      const submittedAt = plus(arrivalAt, 300);
      const reviewedAt = at(d - 1, 10, int(0, 50));
      const a = approval(spec.status, spec.creator, createdAt, submittedAt, reviewedAt, spec.reason);
      const state = wood.origins[0].includes('Kerala') ? pick(['KL', 'TN']) : wood.origins[0].includes('Chhattisgarh') ? pick(['CG', 'TN']) : 'TN';
      const row = {
        id,
        millId,
        code: '', // numbered below, in arrival order
        arrivalAt,
        lorryNumber: lorry(state),
        driverName: pick(DRIVERS),
        driverMobile: phone(),
        lorryOwnerName: pick(LORRY_OWNERS),
        lorryOwnerMobile: phone(),
        originLocation: pick(wood.origins),
        woodType: wood.name,
        woodCategory: wood.category,
        notes: spec.notes ?? null,
        totalLogs: spec.logCount,
        totalCft: str(cft),
        ...a,
        updatedAt: spec.status === 'DRAFT' ? lastTouch : a.updatedAt,
      };
      imports.push({ row, wood, d, cft, rawLeft: spec.status === 'APPROVED' ? cft : 0 });

      if (spec.status === 'APPROVED') {
        movements.push({ millId, kind: 'RAW', woodType: wood.name, importLoadId: id, piecesDelta: spec.logCount, cftDelta: str(cft), source: 'IMPORT', sourceId: id, postedById: owner.id, createdAt: reviewedAt });
        // purchase details: old loads settled, recent ones part-paid or unpaid; the newest has none entered yet
        if (d !== 4) {
          const rate = wood.buy + int(-4, 4) * 10;
          const amount = money(rate * cft);
          const paid = d > 70 ? amount : d > 30 ? (rnd() < 0.4 ? amount : int(3, 7) * 0.1 * Math.floor(amount / 1000) * 1000) : rnd() < 0.5 ? 0 : 25_000;
          const supplier = suppliers[wood.name === 'Teak' && rnd() < 0.3 ? 4 : wood.supplier];
          importFinancials.push({
            importLoadId: id,
            supplierId: supplier.id,
            purchaseRatePerCft: str(rate),
            purchaseAmount: str(amount),
            transportCharges: str(int(8, 24) * 1000),
            amountPaid: str(money(paid)),
            paymentStatus: paymentStatus(amount, money(paid)),
            notes: paid > 0 && paid < amount ? 'Balance after the next auction settlement.' : null,
            updatedAt: plus(reviewedAt, 45),
          });
          audit(plus(reviewedAt, 45), owner.id, 'CREATE', 'ImportFinancials', id, { supplier: supplier.name, purchaseAmount: amount });
        }
      }
    }
    imports.sort((x, y) => x.row.createdAt.getTime() - y.row.createdAt.getTime());
    for (const i of imports) {
      i.row.code = code('IMP', i.row.createdAt);
      auditTrail('ImportLoad', i.row);
    }
    const approvedImport = (d: number) => {
      const found = imports.find((i) => i.d === d && i.row.status === 'APPROVED');
      if (!found) throw new Error(`No approved import ${d} days ago`);
      return found;
    };

    // ───────── production ─────────
    /** Finished stock from one output line of an approved run. */
    interface Lot {
      wood: Wood;
      importLoadId: string;
      thicknessIn: number;
      widthIn: number;
      lengthFt: number;
      pieces: number;
      cft: number;
      availableAt: Date;
      touched: boolean;
    }
    const lots: Lot[] = [];
    type Run = Row<typeof s.productionRuns> & { id: string; code: string; status: Status; createdById: string; createdAt: Date; submittedAt: Date | null; reviewedAt: Date | null };
    const runs: Run[] = [];
    const outputs: Row<typeof s.productionOutputs>[] = [];

    /** Output lines adding up to about `targetCft`, each a different size. */
    const makeOutputs = (targetCft: number, sizes: number) => {
      const chosen = new Map<string, [number, number, number]>();
      while (chosen.size < sizes) {
        const [t, w] = pick(SECTIONS);
        const l = pick(LENGTHS);
        chosen.set(`${t}x${w}x${l}`, [t, w, l]);
      }
      const weights = [...chosen.values()].map(() => 0.5 + rnd());
      const sum = weights.reduce((x, y) => x + y, 0);
      return [...chosen.values()].map(([thicknessIn, widthIn, lengthFt], i) => {
        const pieces = Math.max(1, Math.floor(((targetCft * weights[i]) / sum) / exportPieceCft(thicknessIn, widthIn, lengthFt, 1)));
        return { thicknessIn, widthIn, lengthFt, pieces, cft: exportPieceCft(thicknessIn, widthIn, lengthFt, pieces) };
      });
    };

    interface RunSpec {
      imp: Import;
      status: Status;
      creator: string;
      /** days ago the wood was sawn */
      d: number;
      inputCft: number | null;
      /** finished CFT as a share of the input (0 = no sizes entered yet) */
      recovery: number;
      sizes: number;
      reason?: string;
      wasteNotes?: string;
      inProgress?: boolean;
    }
    const addRun = (spec: RunSpec) => {
      const { imp, d } = spec;
      const id = randomUUID();
      const startAt = spec.inProgress ? ago(190) : at(d, 8, int(15, 45));
      const endAt = spec.inProgress ? null : plus(startAt, int(360, 540));
      const createdAt = spec.inProgress ? ago(180) : plus(endAt!, 20);
      const submittedAt = plus(createdAt, 35);
      const reviewedAt = at(d - 1, 10, int(0, 55));
      const lines = spec.inputCft != null && spec.recovery > 0 ? makeOutputs(spec.inputCft * spec.recovery, spec.sizes) : [];
      const outputCft = totalCft(lines.map((l) => l.cft));
      for (const l of lines) {
        outputs.push({ productionRunId: id, thicknessIn: str(l.thicknessIn), widthIn: str(l.widthIn), lengthFt: str(l.lengthFt), pieces: l.pieces, cft: str(l.cft) });
      }
      const row: Run = {
        id,
        millId,
        code: '',
        importLoadId: imp.row.id,
        woodType: imp.wood.name,
        productionDate: spec.inProgress ? today : day(d),
        cuttingMachine: pick(MACHINES),
        machineOperator: pick(OPERATORS),
        workerDetails: `${int(3, 6)} helpers`,
        startAt,
        endAt,
        inputCft: spec.inputCft == null ? null : str(spec.inputCft),
        outputCft: str(outputCft),
        wasteCft: spec.inputCft == null ? null : str(productionWaste(spec.inputCft, outputCft)),
        wasteNotes: spec.wasteNotes ?? null,
        ...approval(spec.status, spec.creator, createdAt, submittedAt, reviewedAt, spec.reason),
      };
      runs.push(row);

      if (spec.status === 'APPROVED' || spec.status === 'SUBMITTED') imp.rawLeft = roundTo(imp.rawLeft - (spec.inputCft ?? 0));
      if (imp.rawLeft < 0) throw new Error(`Seed bug: ${imp.row.code} raw stock would go negative`);
      if (spec.status === 'APPROVED') {
        const posted = { millId, woodType: imp.wood.name, importLoadId: imp.row.id, sourceId: id, postedById: owner.id, createdAt: reviewedAt };
        movements.push({ ...posted, kind: 'RAW', piecesDelta: 0, cftDelta: str(-spec.inputCft!), source: 'PRODUCTION_INPUT' });
        for (const l of lines) {
          movements.push({ ...posted, kind: 'FINISHED', thicknessIn: str(l.thicknessIn), widthIn: str(l.widthIn), lengthFt: str(l.lengthFt), piecesDelta: l.pieces, cftDelta: str(l.cft), source: 'PRODUCTION_OUTPUT' });
          lots.push({ wood: imp.wood, importLoadId: imp.row.id, ...l, availableAt: reviewedAt, touched: false });
        }
      }
    };

    for (const imp of imports.filter((i) => i.row.status === 'APPROVED' && i.d >= 10)) {
      const creator = imp.row.createdById;
      const wasteNotes = rnd() < 0.35 ? 'Off-cuts and sawdust sold as firewood.' : undefined;
      const first = imp.d - int(2, 4);
      if (imp.d > 45) {
        // old loads are fully sawn, some over two days
        if (rnd() < 0.4) {
          const part = roundTo(imp.cft * (0.45 + rnd() * 0.15));
          addRun({ imp, status: 'APPROVED', creator, d: first, inputCft: part, recovery: 0.58 + rnd() * 0.14, sizes: int(3, 4), wasteNotes });
          addRun({ imp, status: 'APPROVED', creator, d: first - int(1, 3), inputCft: roundTo(imp.cft - part), recovery: 0.58 + rnd() * 0.14, sizes: int(2, 4) });
        } else {
          addRun({ imp, status: 'APPROVED', creator, d: first, inputCft: imp.cft, recovery: 0.58 + rnd() * 0.14, sizes: int(4, 5), wasteNotes });
        }
      } else {
        addRun({ imp, status: 'APPROVED', creator, d: first, inputCft: roundTo(imp.cft * (0.5 + rnd() * 0.3)), recovery: 0.58 + rnd() * 0.14, sizes: int(3, 5), wasteNotes });
      }
    }
    // the queue and the accountant's open work
    addRun({ imp: approvedImport(8), status: 'SUBMITTED', creator: acc1.id, d: 1, inputCft: roundTo(approvedImport(8).cft * 0.6), recovery: 0.66, sizes: 4 });
    addRun({ imp: approvedImport(10), status: 'SUBMITTED', creator: priya.id, d: 1, inputCft: roundTo(approvedImport(10).rawLeft * 0.5), recovery: 0.61, sizes: 3 });
    addRun({ imp: approvedImport(16), status: 'REJECTED', creator: acc1.id, d: 3, inputCft: 90, recovery: 1.12, sizes: 3, reason: 'Finished CFT is more than the raw CFT used — check the piece counts.' });
    addRun({ imp: approvedImport(22), status: 'DRAFT', creator: priya.id, d: 1, inputCft: roundTo(approvedImport(22).rawLeft * 0.5), recovery: 0.4, sizes: 2 });
    addRun({ imp: approvedImport(4), status: 'DRAFT', creator: acc1.id, d: 0, inputCft: null, recovery: 0, sizes: 0, inProgress: true });

    runs.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
    for (const r of runs) {
      r.code = code('PRD', r.createdAt);
      auditTrail('ProductionRun', r);
    }

    // ───────── exports ─────────
    /**
     * Take pieces out of a lot. A whole lot is only ever taken in one go; a part
     * take leaves at least two pieces behind, so rounding can never leave a
     * position at 0 pieces with a stray ±0.001 CFT.
     */
    const maxTake = (lot: Lot) => (lot.touched ? Math.max(0, lot.pieces - 2) : lot.pieces);
    const take = (lot: Lot, pieces: number) => {
      const cft = exportPieceCft(lot.thicknessIn, lot.widthIn, lot.lengthFt, pieces);
      lot.pieces -= pieces;
      lot.cft = roundTo(lot.cft - cft);
      lot.touched = true;
      if (lot.pieces < 0 || lot.cft < 0) throw new Error('Seed bug: finished stock would go negative');
      return cft;
    };

    type Export = Row<typeof s.exportLoads> & { id: string; code: string; status: Status; createdById: string; createdAt: Date; submittedAt: Date | null; reviewedAt: Date | null };
    const exportsOut: Export[] = [];
    const exportLines: Row<typeof s.exportMeasurements>[] = [];
    const exportFinancials: Row<typeof s.exportFinancials>[] = [];

    interface ExportSpec {
      d: number;
      status: Status;
      creator: string;
      createdAt: Date;
      /** truck load in CFT; 0 = no lines yet */
      capacity: number;
      /** approved and submitted exports hold the pieces; drafts and rejected ones only point at them */
      hold: boolean;
      reason?: string;
      notes?: string;
    }
    const addExport = (spec: ExportSpec) => {
      const { d, createdAt } = spec;
      const available = lots.filter((l) => l.availableAt < createdAt && maxTake(l) > 0);
      const byWood = new Map<Wood, number>();
      for (const l of available) byWood.set(l.wood, (byWood.get(l.wood) ?? 0) + l.cft);
      const woods = [...byWood.entries()].filter(([, cft]) => cft > 40).sort((x, y) => y[1] - x[1]);
      if (!woods.length) return; // nothing sawn yet on that day
      const wood = (rnd() < 0.55 ? woods[0] : pick(woods))[0];

      const id = randomUUID();
      const lines: { lot: Lot; pieces: number; cft: number }[] = [];
      let loaded = 0;
      for (const lot of available.filter((l) => l.wood === wood).sort((x, y) => x.availableAt.getTime() - y.availableAt.getTime())) {
        if (spec.capacity === 0 || lines.length >= 5 || loaded >= spec.capacity) break;
        const pieceCft = exportPieceCft(lot.thicknessIn, lot.widthIn, lot.lengthFt, 1);
        const old = createdAt.getTime() - lot.availableAt.getTime() > 35 * DAY;
        const wanted = spec.hold && old && !lot.touched ? lot.pieces : Math.floor(lot.pieces * (0.35 + rnd() * 0.4));
        let pieces = Math.min(wanted, Math.floor((spec.capacity - loaded) / pieceCft));
        if (pieces < lot.pieces) pieces = Math.min(pieces, lot.pieces - 2);
        if (pieces < 1) continue;
        const cft = spec.hold ? take(lot, pieces) : exportPieceCft(lot.thicknessIn, lot.widthIn, lot.lengthFt, pieces);
        lines.push({ lot, pieces, cft });
        loaded += cft;
      }
      const cft = totalCft(lines.map((l) => l.cft));
      const totalPieces = lines.reduce((n, l) => n + l.pieces, 0);
      lines.forEach((l, i) => {
        const lineAt = plus(createdAt, 10 + i * 6);
        exportLines.push({
          exportLoadId: id,
          lineNumber: i + 1,
          importLoadId: l.lot.importLoadId,
          thicknessIn: str(l.lot.thicknessIn),
          widthIn: str(l.lot.widthIn),
          lengthFt: str(l.lot.lengthFt),
          pieces: l.pieces,
          cft: str(l.cft),
          createdById: spec.creator,
          createdAt: lineAt,
          updatedAt: lineAt,
        });
      });

      const submittedAt = plus(createdAt, 120);
      const reviewedAt = plus(createdAt, int(300, 420));
      const startAt = plus(createdAt, 45);
      const row: Export = {
        id,
        millId,
        code: '',
        exportDate: new Date(createdAt.getTime() + off * MIN).toISOString().slice(0, 10),
        lorryNumber: lorry(),
        driverName: pick(DRIVERS),
        driverMobile: phone(),
        lorryOwnerName: pick(LORRY_OWNERS),
        lorryOwnerMobile: phone(),
        startAt: lines.length ? startAt : null,
        endAt: lines.length && spec.status !== 'DRAFT' ? plus(startAt, int(50, 110)) : null,
        woodType: wood.name,
        importLoadId: lines[0]?.lot.importLoadId ?? null,
        notes: spec.notes ?? null,
        totalPieces,
        totalCft: str(cft),
        ...approval(spec.status, spec.creator, createdAt, submittedAt, reviewedAt, spec.reason),
      };
      exportsOut.push(row);

      if (spec.status === 'APPROVED') {
        for (const l of lines) {
          movements.push({
            millId,
            kind: 'FINISHED',
            woodType: wood.name,
            importLoadId: l.lot.importLoadId,
            thicknessIn: str(l.lot.thicknessIn),
            widthIn: str(l.lot.widthIn),
            lengthFt: str(l.lot.lengthFt),
            piecesDelta: -l.pieces,
            cftDelta: str(-l.cft),
            source: 'EXPORT',
            sourceId: id,
            postedById: owner.id,
            createdAt: reviewedAt,
          });
        }
        // sale details: old loads paid, recent ones part-paid or unpaid
        const rate = wood.sell + int(-5, 5) * 10;
        const amount = money(rate * cft);
        const received = d > 60 ? amount : d > 25 ? (rnd() < 0.45 ? amount : int(4, 7) * 0.1 * Math.floor(amount / 1000) * 1000) : rnd() < 0.5 ? 0 : 50_000;
        const client = wood.name === 'Pine' && rnd() < 0.6 ? clients[3] : pick(clients);
        exportFinancials.push({
          exportLoadId: id,
          clientId: client.id,
          sellingRatePerCft: str(rate),
          saleAmount: str(amount),
          amountReceived: str(money(Math.min(received, amount))),
          paymentStatus: paymentStatus(amount, money(Math.min(received, amount))),
          notes: received > 0 && received < amount ? 'Balance by cheque, due this month.' : null,
          updatedAt: plus(reviewedAt, 30),
        });
        audit(plus(reviewedAt, 30), owner.id, 'CREATE', 'ExportFinancials', id, { client: client.name, saleAmount: amount });
      }
    };

    const EXPORT_DAYS = Array.from({ length: 30 }, (_, i) => 150 - i * 5); // every 5 days, the last one 5 days ago
    EXPORT_DAYS.forEach((d, i) => {
      const creator = i % 4 === 3 ? priya.id : i % 9 === 4 ? owner.id : acc1.id;
      addExport({ d, status: 'APPROVED', creator, createdAt: at(d, 11, int(0, 40)), capacity: int(280, 460), hold: true });
    });
    addExport({ d: 1, status: 'SUBMITTED', creator: acc1.id, createdAt: at(1, 15, 20), capacity: 180, hold: true });
    addExport({ d: 0, status: 'SUBMITTED', creator: priya.id, createdAt: ago(170), capacity: 150, hold: true, notes: 'Client lorry waiting at the gate.' });
    addExport({ d: 3, status: 'REJECTED', creator: acc1.id, createdAt: at(3, 12, 10), capacity: 120, hold: false, reason: 'Client asked for 10 ft lengths, not these — correct the lines and submit again.' });
    addExport({ d: 0, status: 'DRAFT', creator: acc1.id, createdAt: ago(75), capacity: 90, hold: false });
    addExport({ d: 1, status: 'DRAFT', creator: priya.id, createdAt: at(1, 16, 45), capacity: 0, hold: false, notes: 'Lorry booked, loading tomorrow.' });

    exportsOut.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
    for (const e of exportsOut) {
      e.code = code('EXP', e.createdAt);
      auditTrail('ExportLoad', e);
    }

    // ───────── stock adjustments ─────────
    type Adjustment = Row<typeof s.stockAdjustments> & { id: string; code: string; status: Status; createdById: string; createdAt: Date; submittedAt: Date | null; reviewedAt: Date | null };
    const adjustments: Adjustment[] = [];
    const addAdjustment = (spec: {
      d: number;
      status: Status;
      creator: string;
      createdAt: Date;
      reason: string;
      rejection?: string;
      finished?: { lot: Lot; pieces: number };
      raw?: { imp: Import; cft: number; logs: number };
    }) => {
      const id = randomUUID();
      const posts = spec.status === 'APPROVED';
      const holds = posts || spec.status === 'SUBMITTED';
      let position: Pick<Adjustment, 'kind' | 'woodType' | 'importLoadId' | 'thicknessIn' | 'widthIn' | 'lengthFt' | 'piecesDelta' | 'cftDelta'>;
      if (spec.finished) {
        const { lot, pieces } = spec.finished;
        const cft = Math.sign(pieces) * exportPieceCft(lot.thicknessIn, lot.widthIn, lot.lengthFt, Math.abs(pieces));
        if (holds) {
          if (pieces < 0) take(lot, -pieces);
          else {
            lot.pieces += pieces;
            lot.cft = roundTo(lot.cft + cft);
          }
        }
        position = { kind: 'FINISHED', woodType: lot.wood.name, importLoadId: lot.importLoadId, thicknessIn: str(lot.thicknessIn), widthIn: str(lot.widthIn), lengthFt: str(lot.lengthFt), piecesDelta: pieces, cftDelta: str(roundTo(cft)) };
      } else {
        const { imp, cft, logs: logCount } = spec.raw!;
        if (holds) imp.rawLeft = roundTo(imp.rawLeft + cft);
        if (imp.rawLeft < 0) throw new Error(`Seed bug: ${imp.row.code} raw stock would go negative`);
        position = { kind: 'RAW', woodType: imp.wood.name, importLoadId: imp.row.id, thicknessIn: null, widthIn: null, lengthFt: null, piecesDelta: logCount, cftDelta: str(cft) };
      }
      const reviewedAt = plus(spec.createdAt, int(180, 300));
      adjustments.push({ id, millId, code: '', ...position, reason: spec.reason, ...approval(spec.status, spec.creator, spec.createdAt, plus(spec.createdAt, 15), reviewedAt, spec.rejection) });
      if (posts) {
        movements.push({ millId, kind: position.kind, woodType: position.woodType, importLoadId: position.importLoadId, thicknessIn: position.thicknessIn, widthIn: position.widthIn, lengthFt: position.lengthFt, piecesDelta: position.piecesDelta, cftDelta: position.cftDelta, source: 'ADJUSTMENT', sourceId: id, postedById: owner.id, createdAt: reviewedAt });
      }
    };
    /** A different well-stocked lot each time it is called. */
    const used = new Set<Lot>();
    const stockedLot = () => {
      const lot = lots.filter((l) => !used.has(l) && l.pieces >= 40).sort((x, y) => y.pieces - x.pieces)[0];
      if (!lot) throw new Error('Seed bug: not enough finished stock left for the adjustments');
      used.add(lot);
      return lot;
    };
    addAdjustment({ d: 20, status: 'APPROVED', creator: acc1.id, createdAt: at(20, 16, 10), reason: 'Cracked pieces found while stacking — removed from stock.', finished: { lot: stockedLot(), pieces: -6 } });
    addAdjustment({ d: 14, status: 'APPROVED', creator: owner.id, createdAt: at(14, 12, 30), reason: 'One log hollow inside — written off.', raw: { imp: approvedImport(28), cft: -roundTo(Math.min(6.25, approvedImport(28).rawLeft / 4)), logs: -1 } });
    addAdjustment({ d: 7, status: 'APPROVED', creator: priya.id, createdAt: at(7, 17, 5), reason: 'Yard recount — extra pieces found.', finished: { lot: stockedLot(), pieces: 4 } });
    addAdjustment({ d: 4, status: 'REJECTED', creator: acc1.id, createdAt: at(4, 15, 40), reason: 'Extra stock found behind shed 2.', rejection: 'No proof — recount with the supervisor and attach the count sheet.', finished: { lot: stockedLot(), pieces: 50 } });
    addAdjustment({ d: 1, status: 'SUBMITTED', creator: acc1.id, createdAt: at(1, 17, 30), reason: 'Termite damage in the bottom row of the stack.', finished: { lot: stockedLot(), pieces: -3 } });
    addAdjustment({ d: 0, status: 'DRAFT', creator: priya.id, createdAt: ago(55), reason: 'Measurement correction after re-check.', raw: { imp: approvedImport(22), cft: -1.5, logs: 0 } });
    for (const a of adjustments) {
      a.code = code('ADJ', a.createdAt);
      auditTrail('StockAdjustment', a);
    }

    // ───────── other expenses ─────────
    const expenses: Row<typeof s.expenses>[] = [];
    const expense = (d: number, category: string, amount: number, notes: string | null = null, importLoadId: string | null = null) => {
      const id = randomUUID();
      const createdAt = at(d, 18, int(0, 40));
      expenses.push({ id, millId, date: day(d), category, amount: str(amount), importLoadId, notes, createdById: owner.id, createdAt, updatedAt: createdAt });
      audit(createdAt, owner.id, 'CREATE', 'Expense', id, { category, amount });
    };
    for (let d = 175; d >= 0; d--) {
      const date = new Date(`${day(d)}T00:00:00Z`);
      const dom = date.getUTCDate();
      if (date.getUTCDay() === 6) expense(d, 'Labour', int(18, 26) * 1000, 'Weekly wages');
      if (dom === 5) expense(d, 'Electricity', int(320, 480) * 100, 'TNEB bill');
      if (dom === 1) expense(d, 'Rent', 30_000, 'Yard and shed rent');
      if (d % 9 === 4) expense(d, 'Diesel', int(40, 90) * 100, 'Generator and forklift');
      if (d % 14 === 6) expense(d, 'Maintenance', int(15, 35) * 100, 'Saw blade sharpening');
      if (d % 41 === 20) expense(d, 'Maintenance', int(80, 180) * 100, 'Band saw service and bearings');
    }
    imports
      .filter((i) => i.row.status === 'APPROVED')
      .forEach((i, n) => {
        if (n % 4 === 0) expense(i.d, 'Loading labour', int(12, 30) * 100, 'Stacking logs in the yard', i.row.id);
      });

    // ───────── logins, so the audit log reads like a working week ─────────
    for (let d = 9; d >= 0; d--) {
      audits.push({ millId, userId: acc1.id, action: 'LOGIN', entityType: 'User', entityId: acc1.id, ip: '192.168.1.24', createdAt: at(d, 7, int(40, 58)) });
      audits.push({ millId, userId: priya.id, action: 'LOGIN', entityType: 'User', entityId: priya.id, ip: '192.168.1.31', createdAt: at(d, 8, int(5, 25)) });
      audits.push({ millId, userId: owner.id, action: 'LOGIN', entityType: 'User', entityId: owner.id, ip: '192.168.1.10', createdAt: at(d, 9, int(0, 30)) });
    }

    // ───────── write ─────────
    const insert = async (table: Parameters<typeof tx.insert>[0], rows: object[]) => {
      for (let i = 0; i < rows.length; i += 500) await tx.insert(table).values(rows.slice(i, i + 500) as never);
    };
    await insert(s.suppliers, suppliers);
    await insert(s.clients, clients);
    await insert(s.importLoads, imports.map((i) => i.row));
    await insert(s.unloadingEntries, unloadings);
    await insert(s.logMeasurements, logs);
    await insert(s.importFinancials, importFinancials);
    await insert(s.productionRuns, runs);
    await insert(s.productionOutputs, outputs);
    await insert(s.stockAdjustments, adjustments);
    await insert(s.exportLoads, exportsOut);
    await insert(s.exportMeasurements, exportLines);
    await insert(s.exportFinancials, exportFinancials);
    await insert(s.stockMovements, movements);
    await insert(s.expenses, expenses);
    await insert(s.auditLogs, audits);
    for (const [key, value] of counters) {
      await tx
        .insert(s.counters)
        .values({ millId, key, value })
        .onConflictDoUpdate({ target: [s.counters.millId, s.counters.key], set: { value: sql`greatest(${s.counters.value}, ${value})` } });
    }

    // the same check every approval runs: no stock position below zero
    await assertStockNotNegative(tx, imports.map((i) => i.row.id));

    const tally = (rows: { status?: Status | null }[]) => {
      const c = { DRAFT: 0, SUBMITTED: 0, APPROVED: 0, REJECTED: 0 };
      for (const r of rows) c[r.status ?? 'DRAFT']++;
      return `${rows.length} (${c.APPROVED} approved, ${c.SUBMITTED} submitted, ${c.DRAFT} draft, ${c.REJECTED} rejected)`;
    };
    console.log(`Demo data created for the ${MILL_CODE} mill:`);
    console.log(`  Import loads       ${tally(imports.map((i) => i.row))}, ${logs.length} logs measured`);
    console.log(`  Production runs    ${tally(runs)}`);
    console.log(`  Export loads       ${tally(exportsOut)}`);
    console.log(`  Stock adjustments  ${tally(adjustments)}`);
    console.log(`  Stock movements    ${movements.length}`);
    console.log(`  Suppliers ${suppliers.length}, clients ${clients.length}, expenses ${expenses.length}, audit entries ${audits.length}`);
    console.log(`  Extra logins       priya / ${DEMO_PASSWORD} (accountant, Tamil), kumar (disabled accountant)`);
  });

  await pool.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
