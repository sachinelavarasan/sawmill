/**
 * Payments against loads and supplier / client statements — end to end.
 * Run: cd backend && npx jest --config test/jest-e2e.json --runInBand payments
 */
import { client, Ctx, startApp, stopApp } from './harness';

let ctx: Ctx;
let owner: ReturnType<typeof client>;
let accA: ReturnType<typeof client>;
let otherMill: ReturnType<typeof client>;

const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  ctx = await startApp();
  owner = client(ctx, ctx.tokens.owner);
  accA = client(ctx, ctx.tokens.accA);
  otherMill = client(ctx, ctx.tokens.otherMillOwner);
});
afterAll(() => stopApp(ctx));

/** An approved import of 5 CFT, billed `amount` to a new supplier. */
async function approvedImport(amount: number, supplierId?: string) {
  const sup = supplierId ?? (await owner('POST', '/suppliers', { name: `Sup ${Math.random().toString(36).slice(2, 7)}` })).body.id;
  const { body: load } = await accA('POST', '/imports', { lorryNumber: 'TN 01 AB 1234', woodType: 'Teak' });
  await accA('POST', `/imports/${load.id}/logs`, { girthIn: 24, lengthFt: 10 });
  await accA('POST', `/imports/${load.id}/logs`, { girthIn: 24, lengthFt: 10 });
  await accA('POST', `/imports/${load.id}/submit`);
  await owner('POST', `/imports/${load.id}/approve`);
  await owner('PUT', `/imports/${load.id}/financials`, { supplierId: sup, purchaseAmount: amount });
  return { load, supplierId: sup as string };
}

describe('payments on a load', () => {
  it('each payment is its own record; the load total and status follow them', async () => {
    const { load } = await approvedImport(10_000);
    const path = `/imports/${load.id}/payments`;

    const first = await owner('POST', path, { date: daysAgo(3), amount: 2500.5, mode: 'CASH' });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ billAmount: 10_000, totalPaid: 2500.5, paymentStatus: 'PARTIAL', balance: 7499.5 });

    const second = await owner('POST', path, { date: today, amount: 7499.5, mode: 'UPI', reference: 'UPI998877', notes: 'Final' });
    expect(second.body).toMatchObject({ totalPaid: 10_000, paymentStatus: 'PAID', balance: 0 });
    // newest first, with who recorded it
    expect(second.body.items.map((p: { mode: string }) => p.mode)).toEqual(['UPI', 'CASH']);
    expect(second.body.items[0]).toMatchObject({ reference: 'UPI998877', notes: 'Final', createdByName: 'Test Owner' });

    // the financials row (what dashboards and reports read) carries the same total
    expect((await owner('GET', `/imports/${load.id}/financials`)).body).toMatchObject({ amountPaid: 10_000, paymentStatus: 'PAID' });

    // deleting one re-sums
    const cashId = second.body.items[1].id;
    const del = await owner('DELETE', `${path}/${cashId}`);
    expect(del.status).toBe(200);
    expect(del.body).toMatchObject({ totalPaid: 7499.5, paymentStatus: 'PARTIAL' });
    expect((await owner('GET', `/imports/${load.id}/financials`)).body.amountPaid).toBe(7499.5);

    const audit = await owner('GET', '/audit-logs?entityType=Payment');
    expect(audit.body.items.map((a: { action: string }) => a.action)).toEqual(expect.arrayContaining(['CREATE', 'DELETE']));
  });

  it('an advance before the bill is entered creates the purchase record and shows as part-paid', async () => {
    const { body: load } = await accA('POST', '/imports', { lorryNumber: 'TN 02 CD 5678', woodType: 'Pine' });
    const res = await owner('POST', `/imports/${load.id}/payments`, { date: today, amount: 20_000, mode: 'BANK' });
    expect(res.body).toMatchObject({ billAmount: null, totalPaid: 20_000, paymentStatus: 'PARTIAL', balance: 0 });
    const fin = (await owner('PUT', `/imports/${load.id}/financials`, { purchaseAmount: 15_000 })).body;
    expect(fin).toMatchObject({ amountPaid: 20_000, paymentStatus: 'PAID' });
    expect((await owner('GET', `/imports/${load.id}/payments`)).body.overpaid).toBe(5000);
  });

  it('works the same for money received on an export', async () => {
    const { body: exp } = await accA('POST', '/exports', { exportDate: today, lorryNumber: 'TN 45 ZZ 1', woodType: 'Teak' });
    await owner('PUT', `/exports/${exp.id}/financials`, { saleAmount: 3000 });
    const res = await owner('POST', `/exports/${exp.id}/payments`, { date: today, amount: 3000, mode: 'CHEQUE', reference: '000123' });
    expect(res.body).toMatchObject({ totalPaid: 3000, paymentStatus: 'PAID' });
    expect((await owner('GET', `/exports/${exp.id}/financials`)).body).toMatchObject({ amountReceived: 3000, paymentStatus: 'PAID' });
  });

  it('is validated: positive amount, known mode, real date not in the future', async () => {
    const { load } = await approvedImport(1000);
    const path = `/imports/${load.id}/payments`;
    expect((await owner('POST', path, { date: today, amount: 0, mode: 'CASH' })).status).toBe(400);
    expect((await owner('POST', path, { date: today, amount: 10, mode: 'BITCOIN' })).status).toBe(400);
    expect((await owner('POST', path, { date: '2026-02-30', amount: 10, mode: 'CASH' })).status).toBe(400);
    const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
    expect((await owner('POST', path, { date: nextYear, amount: 10, mode: 'CASH' })).status).toBe(400);
  });

  it('is owner-only and scoped to the mill', async () => {
    const { load, supplierId } = await approvedImport(1000);
    const path = `/imports/${load.id}/payments`;
    expect((await accA('GET', path)).status).toBe(403);
    expect((await accA('POST', path, { date: today, amount: 10, mode: 'CASH' })).status).toBe(403);
    expect((await accA('GET', `/suppliers/${supplierId}/statement`)).status).toBe(403);
    expect((await otherMill('GET', path)).status).toBe(404);
    expect((await otherMill('POST', path, { date: today, amount: 10, mode: 'CASH' })).status).toBe(404);
    expect((await otherMill('GET', `/suppliers/${supplierId}/statement`)).status).toBe(404);

    // a payment id from another load is not found on this one
    const { load: other } = await approvedImport(1000);
    const { body } = await owner('POST', `/imports/${other.id}/payments`, { date: today, amount: 10, mode: 'CASH' });
    expect((await owner('DELETE', `${path}/${body.items[0].id}`)).status).toBe(404);
  });
});

describe('party statement', () => {
  it('lists approved bills and payments in date order with a running balance that matches Accounts', async () => {
    const { load: a, supplierId } = await approvedImport(10_000);
    const { load: b } = await approvedImport(6_000, supplierId);
    await owner('POST', `/imports/${a.id}/payments`, { date: daysAgo(2), amount: 4000, mode: 'BANK' });
    await owner('POST', `/imports/${b.id}/payments`, { date: today, amount: 1000, mode: 'CASH' });

    // a submitted (not yet approved) load for the same supplier stays out
    const { body: pending } = await accA('POST', '/imports', { lorryNumber: 'TN 09 P 1', woodType: 'Teak' });
    await accA('POST', `/imports/${pending.id}/logs`, { girthIn: 12, lengthFt: 8 });
    await accA('POST', `/imports/${pending.id}/submit`);
    await owner('PUT', `/imports/${pending.id}/financials`, { supplierId, purchaseAmount: 99_999 });

    const { status, body } = await owner('GET', `/suppliers/${supplierId}/statement`);
    expect(status).toBe(200);
    expect(body.totals).toEqual({ billed: 16_000, paid: 5000, balance: 11_000 });
    expect(body.entries).toHaveLength(4);
    expect(body.entries.map((e: { loadCode: string }) => e.loadCode)).not.toContain(pending.code);
    // dates never go backwards and the last running balance is the total balance
    const dates = body.entries.map((e: { date: string }) => e.date);
    expect([...dates].sort()).toEqual(dates);
    expect(body.entries.at(-1).balance).toBe(11_000);

    const summary = (await owner('GET', '/accounts/summary')).body;
    expect(summary.payables.find((p: { id: string }) => p.id === supplierId)).toMatchObject({ amount: 16_000, paid: 5000, balance: 11_000 });
  });

  it('unknown party is 404', async () => {
    expect((await owner('GET', '/clients/00000000-0000-4000-8000-000000000000/statement')).status).toBe(404);
  });
});
