/**
 * The owner's approval queue and mill settings — end to end.
 * Run: cd backend && npx jest --config test/jest-e2e.json --runInBand
 */
import { client, Ctx, startApp, stopApp } from './harness';

let ctx: Ctx;
let owner: ReturnType<typeof client>;
let accA: ReturnType<typeof client>;
let otherMill: ReturnType<typeof client>;

const today = new Date().toISOString().slice(0, 10);

interface Queue {
  counts: { IMPORT: number; PRODUCTION: number; EXPORT: number; ADJUSTMENT: number; total: number };
  items: { type: string; id: string; code: string; createdByName: string }[];
}

/** Submit an import with one 2.5-CFT log; returns its id. */
async function submittedImport() {
  const { body: load } = await accA('POST', '/imports', { lorryNumber: 'TN 01 AA 1111', woodType: 'Savukku' });
  await accA('POST', `/imports/${load.id}/logs`, { girthIn: 24, lengthFt: 10 });
  expect((await accA('POST', `/imports/${load.id}/submit`)).status).toBe(200);
  return load.id as string;
}

beforeAll(async () => {
  ctx = await startApp();
  owner = client(ctx, ctx.tokens.owner);
  accA = client(ctx, ctx.tokens.accA);
  otherMill = client(ctx, ctx.tokens.otherMillOwner);
});
afterAll(() => stopApp(ctx));

describe('approval queue', () => {
  it('lists every submitted record of every kind, oldest first, and empties as they are reviewed', async () => {
    const first = await submittedImport();

    // an approved load gives stock for a production run and an adjustment
    const second = await submittedImport();
    await owner('POST', `/imports/${second}/approve`);
    const { body: run } = await accA('POST', '/production', { importLoadId: second, productionDate: today, inputCft: 1 });
    await accA('POST', `/production/${run.id}/outputs`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 1 });
    expect((await accA('POST', `/production/${run.id}/submit`)).status).toBe(200);
    const { body: adj } = await accA('POST', '/stock-adjustments', { kind: 'RAW', importLoadId: second, cftDelta: -0.5, reason: 'Recount' });
    expect((await accA('POST', `/stock-adjustments/${adj.id}/submit`)).status).toBe(200);
    // a draft is not in the queue
    await accA('POST', '/exports', { exportDate: today, lorryNumber: 'TN 45 BB 2222', woodType: 'Savukku' });

    const { status, body } = await owner('GET', '/approvals');
    expect(status).toBe(200);
    const q = body as Queue;
    expect(q.counts).toEqual({ IMPORT: 1, PRODUCTION: 1, EXPORT: 0, ADJUSTMENT: 1, total: 3 });
    expect(q.items.map((i) => i.type)).toEqual(['IMPORT', 'PRODUCTION', 'ADJUSTMENT']);
    expect(q.items[0]).toMatchObject({ id: first, createdByName: 'Accountant A' });

    // reviewing through the record's own endpoint takes it off the queue
    await owner('POST', `/imports/${first}/approve`);
    await owner('POST', `/production/${run.id}/reject`, { reason: 'Check the input' });
    const after = (await owner('GET', '/approvals')).body as Queue;
    expect(after.counts.total).toBe(1);
    expect(after.items.map((i) => i.type)).toEqual(['ADJUSTMENT']);

    // the dashboard count agrees
    expect((await owner('GET', '/dashboard/owner')).body.kpis.pendingApprovals).toBe(1);
  });

  it('is owner-only and per mill', async () => {
    expect((await accA('GET', '/approvals')).status).toBe(403);
    expect(((await otherMill('GET', '/approvals')).body as Queue).counts.total).toBe(0);
  });
});

describe('mill settings', () => {
  it('owner reads and updates them; the change is audited', async () => {
    const { body: before } = await owner('GET', '/settings');
    expect(before).toMatchObject({ name: 'Test Mill', code: 'TEST', defaultUnloadingRatePerHour: 400, utcOffsetMinutes: 330 });

    const res = await owner('PATCH', '/settings', { name: 'Sri Murugan Saw Mill', defaultUnloadingRatePerHour: 450, defaultLanguage: 'ta' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Sri Murugan Saw Mill', defaultUnloadingRatePerHour: 450, defaultLanguage: 'ta', utcOffsetMinutes: 330 });

    // the new rate is what new imports offer for unloading
    const { body: load } = await accA('POST', '/imports', { lorryNumber: 'TN 01 AA 3333', woodType: 'Savukku' });
    expect(load.defaultUnloadingRate).toBe(450);
    // new users get the mill's language
    const { body: u } = await owner('POST', '/users', { name: 'New Accountant', username: 'new_acc', password: 'Passw0rd!x' });
    expect(u.preferredLanguage).toBe('ta');

    const audit = await owner('GET', '/audit-logs?entityType=Mill');
    expect(audit.body.items[0]).toMatchObject({ action: 'UPDATE', entityType: 'Mill' });

    // null clears the default rate
    expect((await owner('PATCH', '/settings', { defaultUnloadingRatePerHour: null })).body.defaultUnloadingRatePerHour).toBeNull();
  });

  it('validates input and is owner-only', async () => {
    expect((await owner('PATCH', '/settings', { utcOffsetMinutes: 5000 })).status).toBe(400);
    expect((await owner('PATCH', '/settings', { defaultLanguage: 'fr' })).status).toBe(400);
    expect((await owner('PATCH', '/settings', { code: 'HACK' })).status).toBe(400);
    expect((await accA('GET', '/settings')).status).toBe(403);
    expect((await accA('PATCH', '/settings', { name: 'Mine now' })).status).toBe(403);
  });
});
