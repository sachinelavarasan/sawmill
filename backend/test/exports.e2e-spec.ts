/**
 * Exports, export measurement, owner-only sale details and clients — end to end.
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

interface Line {
  id: string;
  lineNumber: number;
  importCode: string;
  pieces: number;
  cft: number;
  availablePieces: number;
}
interface Exp {
  id: string;
  code: string;
  status: string;
  totalPieces: number;
  totalCft: number;
  lines: Line[];
}

/**
 * An approved import load (10 CFT) sawn by an approved run into 4×2×8 ×20 and 3×2×8 ×10
 * pieces of `woodType`, so there is finished stock to export.
 */
async function finishedStock(woodType = 'Savukku') {
  const { body: load } = await accA('POST', '/imports', { lorryNumber: 'TN 01 AA 1111', woodType });
  for (let i = 0; i < 4; i++) await accA('POST', `/imports/${load.id}/logs`, { girthIn: 24, lengthFt: 10 });
  await accA('POST', `/imports/${load.id}/submit`);
  await owner('POST', `/imports/${load.id}/approve`);
  const { body: run } = await accA('POST', '/production', { importLoadId: load.id, productionDate: today, inputCft: 10 });
  await accA('POST', `/production/${run.id}/outputs`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 20 });
  await accA('POST', `/production/${run.id}/outputs`, { thicknessIn: 3, widthIn: 2, lengthFt: 8, pieces: 10 });
  await accA('POST', `/production/${run.id}/submit`);
  expect((await owner('POST', `/production/${run.id}/approve`)).status).toBe(200);
  return load as { id: string; code: string };
}

async function newExport(over: Record<string, unknown> = {}, as = accA) {
  const res = await as('POST', '/exports', { exportDate: today, lorryNumber: 'tn 45 bb 2222', woodType: 'Savukku', ...over });
  expect(res.status).toBe(201);
  return res.body as Exp;
}

const finishedPieces = async (loadId: string, t: number, w: number, l: number) => {
  const { body } = await owner('GET', '/stock');
  return (
    body.finished.find(
      (f: { importLoadId: string; thicknessIn: number; widthIn: number; lengthFt: number }) =>
        f.importLoadId === loadId && f.thicknessIn === t && f.widthIn === w && f.lengthFt === l,
    )?.pieces ?? 0
  );
};

beforeAll(async () => {
  ctx = await startApp();
  owner = client(ctx, ctx.tokens.owner);
  accA = client(ctx, ctx.tokens.accA);
  accB = client(ctx, ctx.tokens.accB);
  otherMill = client(ctx, ctx.tokens.otherMillOwner);
});
afterAll(() => stopApp(ctx));

describe('export entry & measurement', () => {
  it('creates a draft with a sequential code; lines use the piece formula and number themselves', async () => {
    const load = await finishedStock();
    const exp = await newExport({ importLoadId: load.id });
    expect(exp.code).toBe(`EXP-${year}-0001`);
    expect(exp.status).toBe('DRAFT');

    // the document's Method B table: 4×2×8×10, 3×2×8×10 → 4.444 + 3.333
    await accA('POST', `/exports/${exp.id}/measurements`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 10 });
    const res = await accA('POST', `/exports/${exp.id}/measurements`, { thicknessIn: 3, widthIn: 2, lengthFt: 8, pieces: 10 });
    expect(res.status).toBe(201);
    const after = res.body as Exp & { lorryNumber: string };
    expect(after.lorryNumber).toBe('TN 45 BB 2222');
    expect(after.lines.map((l) => [l.lineNumber, l.cft, l.importCode])).toEqual([
      [1, 4.444, load.code],
      [2, 3.333, load.code],
    ]);
    expect(after.totalPieces).toBe(20);
    expect(after.totalCft).toBe(7.777);
    expect(after.lines[0].availablePieces).toBe(20);
  });

  it('a line needs an import load: its own or the export’s', async () => {
    const exp = await newExport();
    const res = await accA('POST', `/exports/${exp.id}/measurements`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 1 });
    expect(res.status).toBe(400);
  });

  it('cannot be submitted with no lines, or for more pieces than are in stock', async () => {
    const load = await finishedStock();
    const empty = await newExport({ importLoadId: load.id });
    expect((await accA('POST', `/exports/${empty.id}/submit`)).status).toBe(400);

    const tooMany = await newExport({ importLoadId: load.id });
    await accA('POST', `/exports/${tooMany.id}/measurements`, { thicknessIn: 3, widthIn: 2, lengthFt: 8, pieces: 6 });
    await accA('POST', `/exports/${tooMany.id}/measurements`, { thicknessIn: 3, widthIn: 2, lengthFt: 8, pieces: 6 }); // 12 > 10
    const res = await accA('POST', `/exports/${tooMany.id}/submit`);
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Only 10 pieces');
  });

  it('wrong wood type: the stock is not there', async () => {
    const load = await finishedStock();
    const exp = await newExport({ importLoadId: load.id, woodType: 'Thekku' });
    await accA('POST', `/exports/${exp.id}/measurements`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 1 });
    expect((await accA('POST', `/exports/${exp.id}/submit`)).status).toBe(409);
  });
});

describe('approval takes finished stock', () => {
  it('stock is untouched until approval, then goes down by exactly the lines', async () => {
    const load = await finishedStock();
    const exp = await newExport({ importLoadId: load.id });
    await accA('POST', `/exports/${exp.id}/measurements`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 15 });
    expect((await accA('POST', `/exports/${exp.id}/submit`)).status).toBe(200);

    // locked for the accountant; owner-only approval
    expect((await accA('POST', `/exports/${exp.id}/measurements`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 1 })).status).toBe(409);
    expect((await accA('POST', `/exports/${exp.id}/approve`)).status).toBe(403);
    expect(await finishedPieces(load.id, 4, 2, 8)).toBe(20);

    const ok = await owner('POST', `/exports/${exp.id}/approve`);
    expect(ok.status).toBe(200);
    expect(await finishedPieces(load.id, 4, 2, 8)).toBe(5);
    expect((await owner('POST', `/exports/${exp.id}/approve`)).status).toBe(409);

    const { body: moves } = await owner('GET', `/stock/movements?importLoadId=${load.id}&kind=FINISHED`);
    expect(moves.items.find((m: { source: string }) => m.source === 'EXPORT')).toMatchObject({ sourceCode: exp.code, piecesDelta: -15, cftDelta: -6.667 });

    const dash = await owner('GET', '/dashboard/owner');
    expect(dash.body.kpis.totalExportLoads).toBe(1);
  });

  it('two exports cannot both take the last pieces', async () => {
    const load = await finishedStock();
    const exps = [await newExport({ importLoadId: load.id }), await newExport({ importLoadId: load.id })];
    for (const e of exps) {
      await accA('POST', `/exports/${e.id}/measurements`, { thicknessIn: 3, widthIn: 2, lengthFt: 8, pieces: 8 });
      expect((await accA('POST', `/exports/${e.id}/submit`)).status).toBe(200); // each fits alone (8 ≤ 10)
    }
    const results = await Promise.all(exps.map((e) => owner('POST', `/exports/${e.id}/approve`)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await finishedPieces(load.id, 3, 2, 8)).toBe(2);
  });

  it('lines can come from different import loads', async () => {
    const a = await finishedStock();
    const b = await finishedStock();
    const exp = await newExport();
    await accA('POST', `/exports/${exp.id}/measurements`, { importLoadId: a.id, thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 2 });
    await accA('POST', `/exports/${exp.id}/measurements`, { importLoadId: b.id, thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 3 });
    await accA('POST', `/exports/${exp.id}/submit`);
    await owner('POST', `/exports/${exp.id}/approve`);
    expect(await finishedPieces(a.id, 4, 2, 8)).toBe(18);
    expect(await finishedPieces(b.id, 4, 2, 8)).toBe(17);
  });

  it('owner corrections to an approved export post only the difference and cannot overdraw', async () => {
    const load = await finishedStock();
    const exp = await newExport({ importLoadId: load.id });
    const { body } = await accA('POST', `/exports/${exp.id}/measurements`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 10 });
    await accA('POST', `/exports/${exp.id}/submit`);
    await owner('POST', `/exports/${exp.id}/approve`);
    const lineId = (body as Exp).lines[0].id;

    expect((await owner('PATCH', `/exports/${exp.id}/measurements/${lineId}`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 12 })).status).toBe(200);
    expect(await finishedPieces(load.id, 4, 2, 8)).toBe(8);
    expect((await owner('PATCH', `/exports/${exp.id}/measurements/${lineId}`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 25 })).status).toBe(409);
    expect(await finishedPieces(load.id, 4, 2, 8)).toBe(8);
  });

  it('rejection posts nothing and hands the export back', async () => {
    const load = await finishedStock();
    const exp = await newExport({ importLoadId: load.id });
    await accA('POST', `/exports/${exp.id}/measurements`, { thicknessIn: 4, widthIn: 2, lengthFt: 8, pieces: 1 });
    await accA('POST', `/exports/${exp.id}/submit`);
    expect((await owner('POST', `/exports/${exp.id}/reject`, { reason: 'Wrong lorry number' })).body.status).toBe('REJECTED');
    expect(await finishedPieces(load.id, 4, 2, 8)).toBe(20);
    expect((await accA('PATCH', `/exports/${exp.id}`, { lorryNumber: 'TN 45 BB 3333' })).status).toBe(200);
  });
});

describe('sale details & clients (owner only)', () => {
  it('owner records the client and price; payment status is derived', async () => {
    const { body: c } = await owner('POST', '/clients', { name: 'Kumar Timbers', phone: '9876543210' });
    expect(c.name).toBe('Kumar Timbers');
    const exp = await newExport();
    const res = await owner('PUT', `/exports/${exp.id}/financials`, { clientId: c.id, sellingRatePerCft: 1200, saleAmount: 9332.4, amountReceived: 5000 });
    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe('PARTIAL');
  });

  it('accountants cannot see clients or sale details', async () => {
    const exp = await newExport();
    expect((await accA('GET', '/clients')).status).toBe(403);
    expect((await accA('POST', '/clients', { name: 'X' })).status).toBe(403);
    expect((await accA('GET', `/exports/${exp.id}/financials`)).status).toBe(403);
    expect((await accA('PUT', `/exports/${exp.id}/financials`, { saleAmount: 1 })).status).toBe(403);
    // and no sale data leaks through the operational detail
    const { body } = await accA('GET', `/exports/${exp.id}`);
    expect(JSON.stringify(body)).not.toMatch(/saleAmount|clientId|sellingRate/);
  });

  it("another mill's client cannot be attached", async () => {
    const { body: theirs } = await otherMill('POST', '/clients', { name: 'Elsewhere Ltd' });
    const exp = await newExport();
    expect((await owner('PUT', `/exports/${exp.id}/financials`, { clientId: theirs.id })).status).toBe(400);
  });
});

describe('access control', () => {
  it('accountants see only their own exports; other mills see nothing', async () => {
    const exp = await newExport();
    expect((await accB('GET', `/exports/${exp.id}`)).status).toBe(404);
    expect((await accB('GET', '/exports')).body.items.find((e: Exp) => e.id === exp.id)).toBeUndefined();
    expect((await otherMill('GET', `/exports/${exp.id}`)).status).toBe(404);
  });

  it('rejects unknown fields', async () => {
    expect((await accA('POST', '/exports', { exportDate: today, lorryNumber: 'TN 45 BB 2222', woodType: 'Savukku', status: 'APPROVED' })).status).toBe(400);
    const exp = await newExport();
    expect((await accA('PATCH', `/exports/${exp.id}`, { totalCft: 99 })).status).toBe(400);
  });
});
