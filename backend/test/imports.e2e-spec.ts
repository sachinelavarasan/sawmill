/**
 * Imports, unloading and log measurement — end to end through the real API.
 * Run: cd backend && npx jest --config test/jest-e2e.json --runInBand
 */
import { eq } from 'drizzle-orm';
import { client, Ctx, startApp, stopApp } from './harness';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const schema = require('../src/db/schema') as typeof import('../src/db/schema');

let ctx: Ctx;
let owner: ReturnType<typeof client>;
let accA: ReturnType<typeof client>;
let accB: ReturnType<typeof client>;
let otherMill: ReturnType<typeof client>;

const year = new Date().getFullYear();
const newLoad = (over: Record<string, unknown> = {}) => ({
  lorryNumber: 'tn 38 ab 1234',
  woodType: 'Savukku',
  woodCategory: 'Uruttu Maram',
  driverName: 'Murugan',
  driverMobile: '9876543210',
  originLocation: 'Pollachi',
  ...over,
});

async function createLoad(as = accA, over: Record<string, unknown> = {}) {
  const res = await as('POST', '/imports', newLoad(over));
  expect(res.status).toBe(201);
  return res.body as { id: string; code: string; totalLogs: number; totalCft: number; lorryNumber: string };
}

beforeAll(async () => {
  ctx = await startApp();
  owner = client(ctx, ctx.tokens.owner);
  accA = client(ctx, ctx.tokens.accA);
  accB = client(ctx, ctx.tokens.accB);
  otherMill = client(ctx, ctx.tokens.otherMillOwner);
});
afterAll(() => stopApp(ctx));

describe('import entry', () => {
  it('creates a draft with a sequential per-mill code and no assumed log count', async () => {
    const a = await createLoad();
    const b = await createLoad();
    expect(a.code).toBe(`IMP-${year}-0001`);
    expect(b.code).toBe(`IMP-${year}-0002`);
    expect(a.totalLogs).toBe(0);
    expect(a.totalCft).toBe(0);
    expect(a.lorryNumber).toBe('TN 38 AB 1234');
  });

  it('requires the wood type to be entered (no default)', async () => {
    const res = await accA('POST', '/imports', newLoad({ woodType: undefined }));
    expect(res.status).toBe(400);
  });

  it('rejects unknown fields (no mass-assignment of status / createdById)', async () => {
    const res = await accA('POST', '/imports', newLoad({ status: 'APPROVED' }));
    expect(res.status).toBe(400);
  });
});

describe('log measurement & CFT', () => {
  it('numbers logs 1, 2, 3 … and computes CFT = G×G×L/2304', async () => {
    const load = await createLoad();
    const r1 = await accA('POST', `/imports/${load.id}/logs`, { girthIn: 12, lengthFt: 8 });
    const r2 = await accA('POST', `/imports/${load.id}/logs`, { girthIn: 24, lengthFt: 10 });
    const r3 = await accA('POST', `/imports/${load.id}/logs`, { girthIn: 18.5, lengthFt: 7.5 });
    expect([r1.status, r2.status, r3.status]).toEqual([201, 201, 201]);
    expect(r1.body.log).toMatchObject({ logNumber: 1, cft: 0.5 });
    expect(r2.body.log).toMatchObject({ logNumber: 2, cft: 2.5 });
    expect(r3.body.log).toMatchObject({ logNumber: 3, cft: 1.114 });
    expect(r3.body).toMatchObject({ totalLogs: 3, totalCft: 4.114 });

    const detail = await accA('GET', `/imports/${load.id}`);
    expect(detail.body).toMatchObject({ totalLogs: 3, totalCft: 4.114 });
    expect(detail.body.logs.map((l: { logNumber: number }) => l.logNumber)).toEqual([1, 2, 3]);
  });

  it('never hands out the same log number when phones save at the same moment', async () => {
    const load = await createLoad();
    const results = await Promise.all(
      Array.from({ length: 25 }, () => accA('POST', `/imports/${load.id}/logs`, { girthIn: 12, lengthFt: 8 })),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    const numbers = results.map((r) => r.body.log.logNumber).sort((x: number, y: number) => x - y);
    expect(numbers).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));

    const detail = await accA('GET', `/imports/${load.id}`);
    expect(detail.body.totalLogs).toBe(25);
    expect(detail.body.totalCft).toBe(12.5);
  });

  it('editing a log recalculates its CFT and the load total', async () => {
    const load = await createLoad();
    const { body } = await accA('POST', `/imports/${load.id}/logs`, { girthIn: 12, lengthFt: 8 });
    const upd = await accA('PATCH', `/imports/${load.id}/logs/${body.log.id}`, { girthIn: 36, lengthFt: 12 });
    expect(upd.status).toBe(200);
    expect(upd.body.log).toMatchObject({ logNumber: 1, cft: 6.75 });
    expect(upd.body).toMatchObject({ totalLogs: 1, totalCft: 6.75 });
  });

  it('deleting a log keeps the other numbers; count comes from the rows; the next log continues after the highest', async () => {
    const load = await createLoad();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await accA('POST', `/imports/${load.id}/logs`, { girthIn: 12, lengthFt: 8 })).body.log.id);

    const del = await accA('DELETE', `/imports/${load.id}/logs/${ids[1]}`);
    expect(del.status).toBeLessThan(300);

    let detail = await accA('GET', `/imports/${load.id}`);
    expect(detail.body.logs.map((l: { logNumber: number }) => l.logNumber)).toEqual([1, 3]);
    expect(detail.body).toMatchObject({ totalLogs: 2, totalCft: 1 });

    const next = await accA('POST', `/imports/${load.id}/logs`, { girthIn: 12, lengthFt: 8 });
    expect(next.body.log.logNumber).toBe(4);
    detail = await accA('GET', `/imports/${load.id}`);
    expect(detail.body.totalLogs).toBe(3);
  });

  it('rejects zero, negative and missing measurements', async () => {
    const load = await createLoad();
    for (const bad of [{ girthIn: 0, lengthFt: 8 }, { girthIn: 12, lengthFt: -1 }, { girthIn: 12 }, { girthIn: '12', lengthFt: 8 }]) {
      expect((await accA('POST', `/imports/${load.id}/logs`, bad)).status).toBe(400);
    }
    expect((await accA('GET', `/imports/${load.id}`)).body.totalLogs).toBe(0);
  });

  it('records edits and deletions of logs in the audit log', async () => {
    const load = await createLoad();
    const { body } = await accA('POST', `/imports/${load.id}/logs`, { girthIn: 12, lengthFt: 8 });
    await accA('PATCH', `/imports/${load.id}/logs/${body.log.id}`, { girthIn: 13, lengthFt: 8 });
    await accA('DELETE', `/imports/${load.id}/logs/${body.log.id}`);
    const rows = await ctx.db.select().from(schema.auditLogs).where(eq(schema.auditLogs.entityId, body.log.id));
    expect(rows.map((r) => r.action).sort()).toEqual(['DELETE', 'UPDATE']);
  });
});

describe('unloading', () => {
  it('computes duration and charges from start, end and rate', async () => {
    const load = await createLoad();
    const res = await accA('POST', `/imports/${load.id}/unloading`, {
      vehicleNumber: 'tn 41 x 9',
      startAt: '2026-11-13T04:00:00.000Z',
      endAt: '2026-11-13T06:30:00.000Z',
      ratePerHour: 500,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ vehicleNumber: 'TN 41 X 9', durationMinutes: 150, ratePerHour: 500, totalCharges: 1250 });
  });

  it("uses the mill's default rate when none is given, and leaves totals empty while in progress", async () => {
    const load = await createLoad();
    const open = await accA('POST', `/imports/${load.id}/unloading`, { vehicleNumber: 'TN 01', startAt: '2026-11-13T04:00:00.000Z' });
    expect(open.body).toMatchObject({ ratePerHour: 400, durationMinutes: null, totalCharges: null });

    const done = await accA('PATCH', `/imports/${load.id}/unloading/${open.body.id}`, { endAt: '2026-11-13T04:45:00.000Z' });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ durationMinutes: 45, totalCharges: 300 });
  });

  it('rejects an end time before the start time', async () => {
    const load = await createLoad();
    const res = await accA('POST', `/imports/${load.id}/unloading`, {
      vehicleNumber: 'TN 02',
      startAt: '2026-11-13T06:00:00.000Z',
      endAt: '2026-11-13T05:00:00.000Z',
    });
    expect(res.status).toBe(400);
  });
});

describe('approval workflow', () => {
  /** Raw stock posted for one load, straight from the ledger. */
  async function rawStock(loadId: string) {
    const rows = await ctx.db.select().from(schema.stockMovements).where(eq(schema.stockMovements.importLoadId, loadId));
    const byWood: Record<string, { cft: number; pieces: number }> = {};
    for (const r of rows) {
      byWood[r.woodType] ??= { cft: 0, pieces: 0 };
      byWood[r.woodType].cft = Math.round((byWood[r.woodType].cft + Number(r.cftDelta)) * 1000) / 1000;
      byWood[r.woodType].pieces += r.piecesDelta;
    }
    return { rows: rows.length, byWood };
  }

  async function measuredLoad(logs: [number, number][] = [[12, 8], [24, 10]]) {
    const load = await createLoad(accA);
    for (const [g, l] of logs) await accA('POST', `/imports/${load.id}/logs`, { girthIn: g, lengthFt: l });
    return load;
  }

  it('cannot submit a load with no logs measured', async () => {
    const load = await createLoad(accA);
    expect((await accA('POST', `/imports/${load.id}/submit`)).status).toBe(400);
  });

  it('submit → approve: status flows, the accountant is locked out, raw stock is posted once', async () => {
    const load = await measuredLoad(); // 0.5 + 2.5 = 3.000 CFT, 2 logs
    const sub = await accA('POST', `/imports/${load.id}/submit`);
    expect(sub.status).toBe(200);
    expect(sub.body).toMatchObject({ status: 'SUBMITTED', editable: false, canSubmit: false });
    expect((await rawStock(load.id)).rows).toBe(0); // nothing official yet

    // the accountant can neither approve nor resubmit
    expect((await accA('POST', `/imports/${load.id}/approve`)).status).toBe(403);
    expect((await accA('POST', `/imports/${load.id}/submit`)).status).toBe(409);

    const ownerView = await owner('GET', `/imports/${load.id}`);
    expect(ownerView.body).toMatchObject({ canReview: true, editable: true });

    const ok = await owner('POST', `/imports/${load.id}/approve`);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'APPROVED', canReview: false });
    expect(await rawStock(load.id)).toEqual({ rows: 1, byWood: { Savukku: { cft: 3, pieces: 2 } } });

    // approving twice must not post stock twice
    expect((await owner('POST', `/imports/${load.id}/approve`)).status).toBe(409);
    expect((await rawStock(load.id)).rows).toBe(1);

    const dash = await owner('GET', '/dashboard/owner');
    expect(dash.body.kpis.rawStockCft).toBeGreaterThanOrEqual(3);

    const audit = await ctx.db.select().from(schema.auditLogs).where(eq(schema.auditLogs.entityId, load.id));
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['CREATE', 'SUBMIT', 'APPROVE']));
  });

  it('reject → accountant corrects → resubmits; no stock is posted on rejection', async () => {
    const load = await measuredLoad([[12, 8]]);
    await accA('POST', `/imports/${load.id}/submit`);

    expect((await owner('POST', `/imports/${load.id}/reject`, {})).status).toBe(400); // reason required
    const rej = await owner('POST', `/imports/${load.id}/reject`, { reason: 'Log 1 girth looks wrong, re-measure' });
    expect(rej.body).toMatchObject({ status: 'REJECTED', rejectionReason: 'Log 1 girth looks wrong, re-measure' });
    expect((await rawStock(load.id)).rows).toBe(0);

    const mine = await accA('GET', `/imports/${load.id}`);
    expect(mine.body).toMatchObject({ editable: true, canSubmit: true });
    const logId = mine.body.logs[0].id;
    expect((await accA('PATCH', `/imports/${load.id}/logs/${logId}`, { girthIn: 13, lengthFt: 8 })).status).toBe(200);

    const again = await accA('POST', `/imports/${load.id}/submit`);
    expect(again.body).toMatchObject({ status: 'SUBMITTED', rejectionReason: null });
  });

  it('owner corrections on an approved load are audited and move the stock by the difference', async () => {
    const load = await measuredLoad(); // 3.000 CFT
    await accA('POST', `/imports/${load.id}/submit`);
    await owner('POST', `/imports/${load.id}/approve`);

    // a missed log is added: +6.750
    const add = await owner('POST', `/imports/${load.id}/logs`, { girthIn: 36, lengthFt: 12 });
    expect(add.status).toBe(201);
    expect(add.body).toMatchObject({ totalLogs: 3, totalCft: 9.75 });
    expect((await rawStock(load.id)).byWood).toEqual({ Savukku: { cft: 9.75, pieces: 3 } });

    // wood type corrected: stock moves from Savukku to Thekku
    expect((await owner('PATCH', `/imports/${load.id}`, { woodType: 'Thekku' })).status).toBe(200);
    expect((await rawStock(load.id)).byWood).toEqual({ Savukku: { cft: 0, pieces: 0 }, Thekku: { cft: 9.75, pieces: 3 } });

    const audit = await ctx.db.select().from(schema.auditLogs).where(eq(schema.auditLogs.userId, (await owner('GET', '/auth/me')).body.id));
    expect(audit.filter((a) => a.action === 'OWNER_EDIT').length).toBeGreaterThanOrEqual(2);

    // the accountant still cannot touch it
    expect((await accA('POST', `/imports/${load.id}/logs`, { girthIn: 12, lengthFt: 8 })).status).toBe(409);
  });
});

describe('access control', () => {
  it("an accountant cannot see or change another accountant's load (reported as not found)", async () => {
    const load = await createLoad(accA);
    expect((await accB('GET', `/imports/${load.id}`)).status).toBe(404);
    expect((await accB('PATCH', `/imports/${load.id}`, { notes: 'x' })).status).toBe(404);
    expect((await accB('POST', `/imports/${load.id}/logs`, { girthIn: 12, lengthFt: 8 })).status).toBe(404);
    const list = await accB('GET', '/imports?take=200');
    expect(list.body.items.some((i: { id: string }) => i.id === load.id)).toBe(false);
  });

  it('the owner sees every load in the mill; another mill sees none of them', async () => {
    const load = await createLoad(accA);
    expect((await owner('GET', `/imports/${load.id}`)).status).toBe(200);
    expect((await otherMill('GET', `/imports/${load.id}`)).status).toBe(404);
    expect((await otherMill('GET', '/imports')).body.total).toBe(0);
  });

  it('purchase details are owner-only and never appear in operational responses', async () => {
    const load = await createLoad(accA);
    const sup = await owner('POST', '/suppliers', { name: 'Sri Murugan Timbers', phone: '9000000001' });
    expect(sup.status).toBe(201);

    const save = await owner('PUT', `/imports/${load.id}/financials`, {
      supplierId: sup.body.id,
      purchaseRatePerCft: 850,
      purchaseAmount: 100000,
      amountPaid: 40000,
    });
    expect(save.status).toBe(200);
    expect(save.body.paymentStatus).toBe('PARTIAL');

    expect((await accA('GET', `/imports/${load.id}/financials`)).status).toBe(403);
    expect((await accA('PUT', `/imports/${load.id}/financials`, { purchaseAmount: 1 })).status).toBe(403);
    expect((await accA('GET', '/suppliers')).status).toBe(403);

    // Match whole keys / values only — ids and timestamps can contain digits like "850" by chance.
    const asText = JSON.stringify((await accA('GET', `/imports/${load.id}`)).body) + JSON.stringify((await accA('GET', '/imports')).body);
    expect(asText).not.toMatch(/"(purchase\w*|supplier\w*|amountPaid|paymentStatus|transportCharges)"\s*:/i);
    expect(asText).not.toMatch(/:\s*(850|100000)(\.0+)?[,}\]]/);
    expect(asText).not.toMatch(/Sri Murugan/i);
  });

  it('payment status is derived from the amounts, never typed in', async () => {
    const load = await createLoad(accA);
    const put = (body: object) => owner('PUT', `/imports/${load.id}/financials`, body);
    expect((await put({ purchaseAmount: 5000 })).body.paymentStatus).toBe('UNPAID');
    expect((await put({ purchaseAmount: 5000, amountPaid: 5000 })).body.paymentStatus).toBe('PAID');
    expect((await put({ purchaseAmount: 5000, amountPaid: 5000, paymentStatus: 'UNPAID' })).status).toBe(400);
  });

  it('once submitted, the accountant can no longer add, change or remove logs or unloading', async () => {
    const load = await createLoad(accA);
    const { body } = await accA('POST', `/imports/${load.id}/logs`, { girthIn: 12, lengthFt: 8 });
    // The submit endpoint arrives with the approval workflow (Phase 6); set the status directly.
    await ctx.db.update(schema.importLoads).set({ status: 'SUBMITTED' }).where(eq(schema.importLoads.id, load.id));

    expect((await accA('POST', `/imports/${load.id}/logs`, { girthIn: 12, lengthFt: 8 })).status).toBe(409);
    expect((await accA('PATCH', `/imports/${load.id}/logs/${body.log.id}`, { girthIn: 13, lengthFt: 8 })).status).toBe(409);
    expect((await accA('DELETE', `/imports/${load.id}/logs/${body.log.id}`)).status).toBe(409);
    expect((await accA('PATCH', `/imports/${load.id}`, { notes: 'late change' })).status).toBe(409);
    expect((await accA('POST', `/imports/${load.id}/unloading`, { vehicleNumber: 'TN 03' })).status).toBe(409);

    const detail = await accA('GET', `/imports/${load.id}`);
    expect(detail.body).toMatchObject({ status: 'SUBMITTED', editable: false, totalLogs: 1 });
  });
});
