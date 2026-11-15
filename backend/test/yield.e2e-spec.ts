/**
 * Yield reports (by wood type; by supplier with cost per finished CFT) — end to end.
 * Run: cd backend && npx jest --config test/jest-e2e.json --runInBand yield
 */
import { client, Ctx, startApp, stopApp } from './harness';

let ctx: Ctx;
let owner: ReturnType<typeof client>;
let accA: ReturnType<typeof client>;

const today = new Date().toISOString().slice(0, 10);
const q = `from=${today.slice(0, 8)}01&to=${today}`;

beforeAll(async () => {
  ctx = await startApp();
  owner = client(ctx, ctx.tokens.owner);
  accA = client(ctx, ctx.tokens.accA);

  // approved load: 2 logs = 5 CFT, bought for ₹10,000 (₹2,000 / CFT) from "Murugan Timbers"
  const { body: sup } = await owner('POST', '/suppliers', { name: 'Murugan Timbers' });
  const { body: load } = await accA('POST', '/imports', { lorryNumber: 'TN 01 AB 1234', woodType: 'Savukku' });
  await accA('POST', `/imports/${load.id}/logs`, { girthIn: 24, lengthFt: 10 });
  await accA('POST', `/imports/${load.id}/logs`, { girthIn: 24, lengthFt: 10 });
  await accA('POST', `/imports/${load.id}/submit`);
  await owner('POST', `/imports/${load.id}/approve`);
  await owner('PUT', `/imports/${load.id}/financials`, { supplierId: sup.id, purchaseAmount: 10_000 });

  // approved run: all 5 CFT in, 10 pcs 4×2×8 = 4.444 CFT out
  const { body: run } = await accA('POST', '/production', { importLoadId: load.id, productionDate: today, inputCft: 5 });
  await accA('POST', `/production/${run.id}/outputs`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 10 });
  await accA('POST', `/production/${run.id}/submit`);
  await owner('POST', `/production/${run.id}/approve`);

  // a submitted (not approved) run does not count
  const { body: load2 } = await accA('POST', '/imports', { lorryNumber: 'TN 02 CD 5678', woodType: 'Savukku' });
  await accA('POST', `/imports/${load2.id}/logs`, { girthIn: 24, lengthFt: 10 });
  await accA('POST', `/imports/${load2.id}/submit`);
  await owner('POST', `/imports/${load2.id}/approve`);
  const { body: run2 } = await accA('POST', '/production', { importLoadId: load2.id, productionDate: today, inputCft: 2.5 });
  await accA('POST', `/production/${run2.id}/outputs`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 1 });
  await accA('POST', `/production/${run2.id}/submit`);
});
afterAll(() => stopApp(ctx));

describe('yield reports', () => {
  it('by wood type: approved runs only, recovery = out ÷ in, also in the totals', async () => {
    const { status, body } = await accA('GET', `/reports/yieldWood?${q}`);
    expect(status).toBe(200);
    expect(body.rows).toEqual([{ woodType: 'Savukku', runs: 1, inputCft: 5, outputCft: 4.444, wasteCft: 0.556, recovery: 88.9 }]);
    expect(body.totals).toMatchObject({ runs: 1, inputCft: 5, outputCft: 4.444, recovery: 88.9 });
    // operational: no prices or suppliers anywhere
    expect(JSON.stringify(body)).not.toMatch(/Murugan|10000|costPer/);
  });

  it('by supplier: cost per finished CFT = cost of the raw wood used ÷ finished CFT (owner only)', async () => {
    const { status, body } = await owner('GET', `/reports/yieldSupplier?${q}`);
    expect(status).toBe(200);
    expect(body.rows).toEqual([
      { supplier: 'Murugan Timbers', woodType: 'Savukku', loads: 1, inputCft: 5, outputCft: 4.444, recovery: 88.9, avgRate: 2000, costPerFinished: 2250.23 },
    ]);
    expect(body.totals).toMatchObject({ loads: 1, recovery: 88.9, costPerFinished: 2250.23 });
    expect((await accA('GET', `/reports/yieldSupplier?${q}`)).status).toBe(403);
    expect((await accA('GET', `/reports/yieldSupplier/xlsx?${q}`)).status).toBe(403);
  });

  it('downloads as Excel', async () => {
    const res = await fetch(`${ctx.base}/reports/yieldSupplier/xlsx?${q}`, { headers: { Authorization: `Bearer ${ctx.tokens.owner}` } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/spreadsheetml/);
  });
});
