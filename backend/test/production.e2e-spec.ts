/**
 * Production, stock balances, the stock ledger and stock adjustments — end to end.
 * Run: cd backend && npx jest --config test/jest-e2e.json --runInBand
 */
import { client, Ctx, startApp, stopApp } from './harness';

let ctx: Ctx;
let owner: ReturnType<typeof client>;
let accA: ReturnType<typeof client>;
let accB: ReturnType<typeof client>;
let otherMill: ReturnType<typeof client>;

const year = new Date().getFullYear();
const today = new Date().toISOString().slice(0, 10);

interface Run {
  id: string;
  code: string;
  status: string;
  inputCft: number | null;
  outputCft: number;
  wasteCft: number | null;
  recoveryPercent: number | null;
  rawAvailableCft: number;
  outputs: { id: string; pieces: number; cft: number }[];
}
interface Balances {
  totals: { rawCft: number; finishedCft: number; finishedPieces: number };
  raw: { importLoadId: string; cft: number; logs: number }[];
  finished: { thicknessIn: number; widthIn: number; lengthFt: number; pieces: number; cft: number }[];
}

/** An approved import load with `logs` logs of girth 24 × length 10 = 2.5 CFT each. */
async function approvedLoad(logs = 4) {
  const { body: load } = await accA('POST', '/imports', { lorryNumber: 'TN 01 AA 1111', woodType: 'Savukku' });
  for (let i = 0; i < logs; i++) await accA('POST', `/imports/${load.id}/logs`, { girthIn: 24, lengthFt: 10 });
  expect((await accA('POST', `/imports/${load.id}/submit`)).status).toBe(200);
  expect((await owner('POST', `/imports/${load.id}/approve`)).status).toBe(200);
  return load as { id: string; code: string };
}

async function newRun(importLoadId: string, inputCft: number | null, as = accA) {
  const res = await as('POST', '/production', { importLoadId, productionDate: today, cuttingMachine: 'Band saw 1', inputCft });
  expect(res.status).toBe(201);
  return res.body as Run;
}

const stock = async () => (await owner('GET', '/stock')).body as Balances;
const rawOf = async (loadId: string) => (await stock()).raw.find((r) => r.importLoadId === loadId)?.cft ?? 0;

beforeAll(async () => {
  ctx = await startApp();
  owner = client(ctx, ctx.tokens.owner);
  accA = client(ctx, ctx.tokens.accA);
  accB = client(ctx, ctx.tokens.accB);
  otherMill = client(ctx, ctx.tokens.otherMillOwner);
});
afterAll(() => stopApp(ctx));

describe('production run', () => {
  it('can only draw on an approved import load', async () => {
    const { body: draft } = await accA('POST', '/imports', { lorryNumber: 'TN 01 AA 2222', woodType: 'Thekku' });
    const res = await accA('POST', '/production', { importLoadId: draft.id, productionDate: today });
    expect(res.status).toBe(400);
  });

  it('takes the wood type from the load, calculates output CFT, waste and recovery', async () => {
    const load = await approvedLoad(); // 10 CFT raw
    const run = await newRun(load.id, 9);
    expect(run.code).toBe(`PRD-${year}-0001`);
    expect(run.status).toBe('DRAFT');
    expect(run.rawAvailableCft).toBe(10);

    // the document example sizes: 4×2×8×10 = 4.444, 3×2×8×10 = 3.333
    await accA('POST', `/production/${run.id}/outputs`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 10 });
    const res = await accA('POST', `/production/${run.id}/outputs`, { thicknessIn: 3, widthIn: 2, lengthFt: 8, pieces: 10 });
    expect(res.status).toBe(201);
    const after = res.body as Run & { woodType: string };
    expect(after.woodType).toBe('Savukku');
    expect(after.outputCft).toBe(7.777);
    expect(after.wasteCft).toBe(1.223);
    expect(after.recoveryPercent).toBe(86.4);
  });

  it('cannot be submitted without an input CFT or without any output size', async () => {
    const load = await approvedLoad();
    const noInput = await newRun(load.id, null);
    await accA('POST', `/production/${noInput.id}/outputs`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 1 });
    expect((await accA('POST', `/production/${noInput.id}/submit`)).status).toBe(400);

    const noOutput = await newRun(load.id, 2);
    expect((await accA('POST', `/production/${noOutput.id}/submit`)).status).toBe(400);
  });

  it('cannot be submitted for more raw CFT than the load has left', async () => {
    const load = await approvedLoad(1); // 2.5 CFT
    const run = await newRun(load.id, 3);
    await accA('POST', `/production/${run.id}/outputs`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 1 });
    const res = await accA('POST', `/production/${run.id}/submit`);
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('2.500');
  });
});

describe('approval moves stock', () => {
  it('stock does not change until approval; approval moves raw → finished in one step', async () => {
    const load = await approvedLoad(); // 10 CFT
    const run = await newRun(load.id, 9);
    await accA('POST', `/production/${run.id}/outputs`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 10 });
    await accA('POST', `/production/${run.id}/outputs`, { thicknessIn: 3, widthIn: 2, lengthFt: 8, pieces: 10 });
    const before = await stock();

    expect((await accA('POST', `/production/${run.id}/submit`)).status).toBe(200);
    // submitted: locked for the accountant, stock untouched
    expect((await accA('PATCH', `/production/${run.id}`, { inputCft: 8 })).status).toBe(409);
    expect((await accA('POST', `/production/${run.id}/outputs`, { thicknessIn: 1, widthIn: 1, lengthFt: 1, pieces: 1 })).status).toBe(409);
    expect(await rawOf(load.id)).toBe(10);
    expect((await stock()).totals.finishedCft).toBe(before.totals.finishedCft);

    expect((await accA('POST', `/production/${run.id}/approve`)).status).toBe(403);
    const ok = await owner('POST', `/production/${run.id}/approve`);
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('APPROVED');
    expect(ok.body.rawAvailableCft).toBe(1);

    const after = await stock();
    expect(await rawOf(load.id)).toBe(1);
    expect(after.totals.finishedCft).toBeCloseTo(before.totals.finishedCft + 7.777, 3);
    expect(after.totals.finishedPieces).toBe(before.totals.finishedPieces + 20);

    // approving twice posts nothing more
    expect((await owner('POST', `/production/${run.id}/approve`)).status).toBe(409);
    expect(await rawOf(load.id)).toBe(1);

    // every movement is traceable to the run and the load
    const { body: moves } = await owner('GET', `/stock/movements?importLoadId=${load.id}`);
    const sources = moves.items.map((m: { source: string; sourceCode: string; cftDelta: number }) => [m.source, m.sourceCode, m.cftDelta]);
    expect(sources).toEqual(
      expect.arrayContaining([
        ['IMPORT', load.code, 10],
        ['PRODUCTION_INPUT', run.code, -9],
        ['PRODUCTION_OUTPUT', run.code, 4.444],
        ['PRODUCTION_OUTPUT', run.code, 3.333],
      ]),
    );

    // the owner dashboard reads the same ledger
    const dash = await owner('GET', '/dashboard/owner');
    expect(dash.body.kpis.rawStockCft).toBe(after.totals.rawCft);
    expect(dash.body.kpis.finishedStockCft).toBe(after.totals.finishedCft);
  });

  it('two runs cannot both spend the same raw stock', async () => {
    const load = await approvedLoad(1); // 2.5 CFT
    const runs = [await newRun(load.id, 2), await newRun(load.id, 2)];
    for (const r of runs) {
      await accA('POST', `/production/${r.id}/outputs`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 1 });
      expect((await accA('POST', `/production/${r.id}/submit`)).status).toBe(200); // each fits on its own
    }
    const results = await Promise.all(runs.map((r) => owner('POST', `/production/${r.id}/approve`)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await rawOf(load.id)).toBe(0.5);
    // the refused one stays submitted, nothing half-posted
    const refused = runs[results.findIndex((r) => r.status === 409)];
    expect((await owner('GET', `/production/${refused.id}`)).body.status).toBe('SUBMITTED');
  });

  it('rejection posts nothing and hands the run back to the accountant', async () => {
    const load = await approvedLoad(1);
    const run = await newRun(load.id, 2);
    await accA('POST', `/production/${run.id}/outputs`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 1 });
    await accA('POST', `/production/${run.id}/submit`);
    const rej = await owner('POST', `/production/${run.id}/reject`, { reason: 'Input looks too high' });
    expect(rej.body.status).toBe('REJECTED');
    expect(await rawOf(load.id)).toBe(2.5);
    expect((await accA('PATCH', `/production/${run.id}`, { inputCft: 1.5 })).status).toBe(200);
    expect((await accA('POST', `/production/${run.id}/submit`)).body.status).toBe('SUBMITTED');
  });

  it('owner corrections to an approved run post only the difference', async () => {
    const load = await approvedLoad(); // 10
    const run = await newRun(load.id, 5);
    const { body } = await accA('POST', `/production/${run.id}/outputs`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 10 });
    await accA('POST', `/production/${run.id}/submit`);
    await owner('POST', `/production/${run.id}/approve`);
    expect(await rawOf(load.id)).toBe(5);

    const before = await stock();
    const fix = await owner('PATCH', `/production/${run.id}/outputs/${body.outputs[0].id}`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 7 });
    expect(fix.status).toBe(200);
    expect((await stock()).totals.finishedPieces).toBe(before.totals.finishedPieces - 3);

    await owner('PATCH', `/production/${run.id}`, { inputCft: 6 });
    expect(await rawOf(load.id)).toBe(4);

    // and the owner can't overdraw the load either
    expect((await owner('PATCH', `/production/${run.id}`, { inputCft: 11 })).status).toBe(409);
    expect(await rawOf(load.id)).toBe(4);

    const audit = await owner('GET', `/audit-logs?entityType=ProductionRun&take=200`);
    const actions = audit.body.items.filter((a: { entityId: string }) => a.entityId === run.id).map((a: { action: string }) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['CREATE', 'SUBMIT', 'APPROVE', 'OWNER_EDIT']));
  });

  it('an import load cannot be corrected below what production already used', async () => {
    const load = await approvedLoad(2); // 5
    const run = await newRun(load.id, 4);
    await accA('POST', `/production/${run.id}/outputs`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 1 });
    await accA('POST', `/production/${run.id}/submit`);
    await owner('POST', `/production/${run.id}/approve`);

    const { body: detail } = await owner('GET', `/imports/${load.id}`);
    const res = await owner('DELETE', `/imports/${load.id}/logs/${detail.logs[0].id}`); // would leave 2.5 < 4 used
    expect(res.status).toBe(409);
    expect((await owner('GET', `/imports/${load.id}`)).body.totalLogs).toBe(2);
  });
});

describe('stock adjustments', () => {
  it('finished adjustment: CFT is calculated from the size; stock moves only on approval', async () => {
    const load = await approvedLoad();
    const run = await newRun(load.id, 5);
    await accA('POST', `/production/${run.id}/outputs`, { thicknessIn: 3, widthIn: 2, lengthFt: 8, pieces: 10 });
    await accA('POST', `/production/${run.id}/submit`);
    await owner('POST', `/production/${run.id}/approve`);
    const before = await stock();

    const res = await accA('POST', '/stock-adjustments', {
      kind: 'FINISHED',
      importLoadId: load.id,
      thicknessIn: 3,
      widthIn: 2,
      lengthFt: 8,
      piecesDelta: -2,
      reason: 'Broken while stacking',
    });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe(`ADJ-${year}-0001`);
    expect(res.body.cftDelta).toBe(-0.667);
    expect(res.body.woodType).toBe('Savukku');

    await accA('POST', `/stock-adjustments/${res.body.id}/submit`);
    expect((await stock()).totals.finishedPieces).toBe(before.totals.finishedPieces);
    expect((await owner('POST', `/stock-adjustments/${res.body.id}/approve`)).status).toBe(200);
    expect((await stock()).totals.finishedPieces).toBe(before.totals.finishedPieces - 2);
  });

  it('an adjustment that would take stock below zero cannot be approved', async () => {
    const load = await approvedLoad(1); // 2.5
    const { body } = await accA('POST', '/stock-adjustments', { kind: 'RAW', importLoadId: load.id, cftDelta: -3, reason: 'Recount' });
    await accA('POST', `/stock-adjustments/${body.id}/submit`);
    expect((await owner('POST', `/stock-adjustments/${body.id}/approve`)).status).toBe(409);
    expect(await rawOf(load.id)).toBe(2.5);
  });

  it('validates the shape: raw needs CFT, finished needs a size', async () => {
    const load = await approvedLoad(1);
    expect((await accA('POST', '/stock-adjustments', { kind: 'RAW', importLoadId: load.id, reason: 'Recount' })).status).toBe(400);
    expect((await accA('POST', '/stock-adjustments', { kind: 'FINISHED', importLoadId: load.id, piecesDelta: 2, reason: 'Recount' })).status).toBe(400);
  });
});

describe('access control', () => {
  it('accountants see only their own runs; other mills see nothing', async () => {
    const load = await approvedLoad(1);
    const run = await newRun(load.id, 1);
    expect((await accB('GET', `/production/${run.id}`)).status).toBe(404);
    expect((await accB('GET', '/production')).body.items.find((r: Run) => r.id === run.id)).toBeUndefined();
    expect((await owner('GET', `/production/${run.id}`)).status).toBe(200);

    expect((await otherMill('GET', `/production/${run.id}`)).status).toBe(404);
    expect((await otherMill('GET', '/stock')).body.raw).toEqual([]);
    expect((await otherMill('POST', '/production', { importLoadId: load.id, productionDate: today })).status).toBe(400);
  });

  it('rejects unknown fields (no setting status or totals directly)', async () => {
    const load = await approvedLoad(1);
    const res = await accA('POST', '/production', { importLoadId: load.id, productionDate: today, status: 'APPROVED' });
    expect(res.status).toBe(400);
    const run = await newRun(load.id, 1);
    expect((await accA('PATCH', `/production/${run.id}`, { outputCft: 99 })).status).toBe(400);
  });
});
