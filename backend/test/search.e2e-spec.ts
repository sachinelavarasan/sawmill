/**
 * The `q` search on list pages: record ID, lorry number, wood type; spaces ignored;
 * an accountant's search still only covers their own entries.
 */
import { client, Ctx, startApp, stopApp } from './harness';

let ctx: Ctx;
let owner: ReturnType<typeof client>;
let accA: ReturnType<typeof client>;
let accB: ReturnType<typeof client>;

beforeAll(async () => {
  ctx = await startApp();
  owner = client(ctx, ctx.tokens.owner);
  accA = client(ctx, ctx.tokens.accA);
  accB = client(ctx, ctx.tokens.accB);
  await accA('POST', '/imports', { lorryNumber: 'TN 31 AB 1214', woodType: 'Thekku' });
  await accA('POST', '/imports', { lorryNumber: 'KL 08 C 4411', woodType: 'Savukku' });
  await accB('POST', '/imports', { lorryNumber: 'TN 31 ZZ 9999', woodType: 'Neem' });
});
afterAll(() => stopApp(ctx));

const codes = async (c: ReturnType<typeof client>, q: string) =>
  (await c<{ items: { lorryNumber: string }[]; total: number }>('GET', `/imports?q=${encodeURIComponent(q)}`)).body;

describe('import search', () => {
  it('matches lorry numbers ignoring spaces and case', async () => {
    const r = await codes(owner, 'tn31');
    expect(r.total).toBe(2);
    expect(r.items.map((i) => i.lorryNumber).sort()).toEqual(['TN 31 AB 1214', 'TN 31 ZZ 9999']);
  });

  it('matches wood type and record ID', async () => {
    expect((await codes(owner, 'savuk')).total).toBe(1);
    expect((await codes(owner, '0001')).total).toBe(1);
  });

  it("an accountant's search covers only their own entries", async () => {
    expect((await codes(accA, 'tn 31')).total).toBe(1);
  });

  it('treats % and _ literally, and rejects very long searches', async () => {
    expect((await codes(owner, '%')).total).toBe(0);
    expect((await owner('GET', `/imports?q=${'x'.repeat(61)}`)).status).toBe(400);
  });

  it('works on production and exports too', async () => {
    expect((await owner('GET', '/production?q=PRD')).status).toBe(200);
    expect((await owner('GET', '/exports?q=KL08')).status).toBe(200);
  });
});
