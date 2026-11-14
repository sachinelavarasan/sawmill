/**
 * Accounts (expenses, P&L, balances) and reports (JSON + Excel) — end to end.
 * Run: cd backend && npx jest --config test/jest-e2e.json --runInBand
 */
import ExcelJS from 'exceljs';
import { client, Ctx, startApp, stopApp } from './harness';

let ctx: Ctx;
let owner: ReturnType<typeof client>;
let accA: ReturnType<typeof client>;
let accB: ReturnType<typeof client>;

const today = new Date().toISOString().slice(0, 10);
const month = { from: `${today.slice(0, 8)}01`, to: today };
const q = (o: Record<string, string>) => new URLSearchParams(o).toString();

/** An approved import (2 logs, 5 CFT) with purchase details, and an approved export with sale details. */
async function tradeOnce() {
  const { body: sup } = await owner('POST', '/suppliers', { name: `Supplier ${Math.random().toString(36).slice(2, 6)}` });
  const { body: cli } = await owner('POST', '/clients', { name: `Client ${Math.random().toString(36).slice(2, 6)}` });
  const { body: load } = await accA('POST', '/imports', { lorryNumber: 'TN 01 AA 1111', woodType: 'Savukku' });
  await accA('POST', `/imports/${load.id}/logs`, { girthIn: 24, lengthFt: 10 });
  await accA('POST', `/imports/${load.id}/logs`, { girthIn: 24, lengthFt: 10 });
  await accA('POST', `/imports/${load.id}/unloading`, { vehicleNumber: 'TN 41 X 1', startAt: new Date(Date.now() - 3_600_000).toISOString(), endAt: new Date().toISOString(), ratePerHour: 300 });
  await accA('POST', `/imports/${load.id}/submit`);
  await owner('POST', `/imports/${load.id}/approve`);
  await owner('PUT', `/imports/${load.id}/financials`, { supplierId: sup.id, purchaseAmount: 10000, transportCharges: 1500, amountPaid: 4000 });

  const { body: run } = await accA('POST', '/production', { importLoadId: load.id, productionDate: today, inputCft: 5 });
  await accA('POST', `/production/${run.id}/outputs`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 10 });
  await accA('POST', `/production/${run.id}/submit`);
  await owner('POST', `/production/${run.id}/approve`);

  const { body: exp } = await accA('POST', '/exports', { exportDate: today, lorryNumber: 'TN 45 BB 2222', woodType: 'Savukku', importLoadId: load.id });
  await accA('POST', `/exports/${exp.id}/measurements`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 10 });
  await accA('POST', `/exports/${exp.id}/submit`);
  await owner('POST', `/exports/${exp.id}/approve`);
  await owner('PUT', `/exports/${exp.id}/financials`, { clientId: cli.id, saleAmount: 20000, amountReceived: 5000 });
  return { load, exp, sup, cli };
}

beforeAll(async () => {
  ctx = await startApp();
  owner = client(ctx, ctx.tokens.owner);
  accA = client(ctx, ctx.tokens.accA);
  accB = client(ctx, ctx.tokens.accB);
});
afterAll(() => stopApp(ctx));

describe('expenses', () => {
  it('owner adds, edits and deletes expenses; each change is audited', async () => {
    const res = await owner('POST', '/expenses', { date: today, category: 'Electricity', amount: 2500.5, notes: 'EB bill' });
    expect(res.status).toBe(201);
    const id = res.body.id;
    expect((await owner('PATCH', `/expenses/${id}`, { amount: 2600 })).body.amount).toBe(2600);

    const list = await owner('GET', `/expenses?${q(month)}`);
    expect(list.body.items.find((e: { id: string }) => e.id === id)).toMatchObject({ category: 'Electricity', amount: 2600 });
    expect(list.body.categories).toContain('Electricity');

    expect((await owner('DELETE', `/expenses/${id}`)).status).toBe(204);
    const audit = await owner('GET', '/audit-logs?entityType=Expense');
    expect(audit.body.items.map((a: { action: string }) => a.action)).toEqual(expect.arrayContaining(['CREATE', 'UPDATE', 'DELETE']));
  });

  it('is owner-only and validated', async () => {
    expect((await accA('GET', '/expenses')).status).toBe(403);
    expect((await accA('POST', '/expenses', { date: today, category: 'Labour', amount: 1 })).status).toBe(403);
    expect((await owner('POST', '/expenses', { date: today, category: 'Labour', amount: 0 })).status).toBe(400);
    expect((await owner('POST', '/expenses', { date: '13-11-2026', category: 'Labour', amount: 5 })).status).toBe(400);
  });
});

describe('accounts summary', () => {
  it('P&L for the period follows approved trade; balances show what is still owed', async () => {
    const before = (await owner('GET', `/accounts/summary?${q(month)}`)).body;
    const { sup, cli } = await tradeOnce();
    await owner('POST', '/expenses', { date: today, category: 'Labour', amount: 1000 });

    const { status, body } = await owner('GET', `/accounts/summary?${q(month)}`);
    expect(status).toBe(200);
    expect(body.pnl.sales).toBe(before.pnl.sales + 20000);
    expect(body.pnl.purchases).toBe(before.pnl.purchases + 10000);
    expect(body.pnl.transport).toBe(before.pnl.transport + 1500);
    expect(body.pnl.unloading).toBeCloseTo(before.pnl.unloading + 300, 2);
    expect(body.pnl.profit).toBeCloseTo(body.pnl.sales - body.pnl.totalExpenses, 2);
    expect(body.payables.find((p: { id: string }) => p.id === sup.id)).toMatchObject({ amount: 10000, paid: 4000, balance: 6000 });
    expect(body.receivables.find((r: { id: string }) => r.id === cli.id)).toMatchObject({ amount: 20000, received: 5000, balance: 15000 });

    // a period with no trade has a zero P&L but the same balances (they are "to date")
    const past = (await owner('GET', `/accounts/summary?${q({ from: '2020-01-01', to: '2020-01-31' })}`)).body;
    expect(past.pnl).toMatchObject({ sales: 0, purchases: 0, profit: 0 });
    expect(past.payables.length).toBe(body.payables.length);
  });

  it('rejects a backwards period and is owner-only', async () => {
    expect((await owner('GET', `/accounts/summary?${q({ from: '2026-02-01', to: '2026-01-01' })}`)).status).toBe(400);
    expect((await accA('GET', '/accounts/summary')).status).toBe(403);
  });
});

describe('reports', () => {
  it('lists operational reports for accountants, everything for the owner', async () => {
    expect((await accA('GET', '/reports')).body.map((r: { key: string }) => r.key)).toEqual(['imports', 'production', 'exports', 'stock']);
    expect((await owner('GET', '/reports')).body).toHaveLength(8);
  });

  it('registers default to approved entries, and accountants see only their own', async () => {
    await tradeOnce();
    const { body: draft } = await accB('POST', '/imports', { lorryNumber: 'TN 09 ZZ 9999', woodType: 'Thekku' });

    const approved = (await owner('GET', `/reports/imports?${q(month)}`)).body;
    expect(approved.rows.every((r: { status: string }) => r.status === 'Approved')).toBe(true);
    expect(approved.columns.map((c: { key: string }) => c.key)).toContain('totalCft');
    expect(approved.totals.totalCft).toBeCloseTo(approved.rows.reduce((s: number, r: { totalCft: number }) => s + r.totalCft, 0), 3);

    const all = (await owner('GET', `/reports/imports?${q({ ...month, status: 'ALL' })}`)).body;
    expect(all.rows.find((r: { code: string }) => r.code === draft.code)).toBeTruthy();

    const accAView = (await accA('GET', `/reports/imports?${q({ ...month, status: 'ALL' })}`)).body;
    expect(accAView.rows.find((r: { code: string }) => r.code === draft.code)).toBeUndefined();
  });

  it('financial reports are owner-only, and labels follow the language', async () => {
    expect((await accA('GET', '/reports/pnl')).status).toBe(403);
    expect((await accA('GET', '/reports/pnl/xlsx')).status).toBe(403);
    const ta = (await owner('GET', `/reports/pnl?${q({ ...month, lang: 'ta' })}`)).body;
    expect(ta.title).toBe('லாப நஷ்ட அறிக்கை');
    expect(ta.rows.at(-1).item).toBe('லாபம் / நஷ்டம்');
  });

  it('downloads a real Excel file', async () => {
    const res = await fetch(`${ctx.base}/reports/stock/xlsx`, { headers: { Authorization: `Bearer ${ctx.tokens.owner}` } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="stock_.*\.xlsx"/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    expect(wb.worksheets[0].getCell('A2').value).toBe('Stock Summary');
  });

  it('unknown report → 404', async () => {
    expect((await owner('GET', '/reports/nope')).status).toBe(404);
  });
});
