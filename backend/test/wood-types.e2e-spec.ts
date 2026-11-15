/**
 * Wood types: one spelling per name, and the owner's list — end to end.
 * Run: cd backend && npx jest --config test/jest-e2e.json --runInBand wood-types
 */
import { client, Ctx, startApp, stopApp } from './harness';

let ctx: Ctx;
let owner: ReturnType<typeof client>;
let accA: ReturnType<typeof client>;

const newLoad = (woodType: string) => accA('POST', '/imports', { lorryNumber: 'TN 01 AB 1234', woodType });
const setList = (woodTypes: string[]) => owner('PATCH', '/settings', { woodTypes });

beforeAll(async () => {
  ctx = await startApp();
  owner = client(ctx, ctx.tokens.owner);
  accA = client(ctx, ctx.tokens.accA);
});
afterAll(() => stopApp(ctx));

describe('wood types', () => {
  it('with no list: any name is accepted, but a known one is saved with its first spelling', async () => {
    expect((await owner('GET', '/settings')).body.woodTypes).toEqual([]);
    expect((await newLoad('  Burma   Teak ')).body.woodType).toBe('Burma Teak');
    expect((await newLoad('burma teak')).body.woodType).toBe('Burma Teak');
    const choices = (await accA('GET', '/wood-types')).body;
    expect(choices).toEqual({ items: ['Burma Teak'], fixed: false });
  });

  it('the owner sets the list (tidied, repeats dropped, sorted); accountants read it', async () => {
    const res = await setList(['pine ', 'Savukku', 'PINE', 'Thekku']);
    expect(res.status).toBe(200);
    expect(res.body.woodTypes).toEqual(['pine', 'Savukku', 'Thekku']);
    expect((await accA('GET', '/wood-types')).body).toEqual({ items: ['pine', 'Savukku', 'Thekku'], fixed: true });
    expect((await accA('PATCH', '/settings', { woodTypes: ['X1'] })).status).toBe(403);
  });

  it('with a list: names match it ignoring case; a new name is refused; names in use still work', async () => {
    expect((await newLoad('SAVUKKU')).body.woodType).toBe('Savukku');
    const refused = await newLoad('Teek');
    expect(refused.status).toBe(400);
    expect(refused.body.message).toMatch(/not one of the mill's wood types/);
    // "Burma Teak" isn't on the list but is already on a load (stock may exist): still accepted
    expect((await newLoad('BURMA TEAK')).body.woodType).toBe('Burma Teak');
  });

  it('exports and edits go through the same rule', async () => {
    const { body: load } = await newLoad('Thekku');
    expect((await accA('PATCH', `/imports/${load.id}`, { woodType: 'thekku ' })).body.woodType).toBe('Thekku');
    expect((await accA('PATCH', `/imports/${load.id}`, { woodType: 'Rosewood' })).status).toBe(400);
    const exp = await accA('POST', '/exports', { exportDate: new Date().toISOString().slice(0, 10), lorryNumber: 'TN 45 ZZ 1', woodType: 'savukku' });
    expect(exp.body.woodType).toBe('Savukku');
    expect((await accA('POST', '/exports', { exportDate: new Date().toISOString().slice(0, 10), lorryNumber: 'TN 45 ZZ 2', woodType: 'Rosewood' })).status).toBe(400);
  });

  it('an empty list switches the rule off again', async () => {
    expect((await setList([])).body.woodTypes).toEqual([]);
    expect((await newLoad('Rosewood')).status).toBe(201);
    expect((await accA('GET', '/wood-types')).body.fixed).toBe(false);
  });
});
