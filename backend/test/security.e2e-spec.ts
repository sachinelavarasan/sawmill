/**
 * Phase 8 security behaviour, end to end: account lockout, sessions ending at
 * once on password reset / disable, the last-owner guard, and report hardening.
 * Run: cd backend && npx jest --config test/jest-e2e.json --runInBand test/security
 *
 * Login is rate-limited to 10 per minute per IP and the harness already signs in
 * four users, so this file makes at most six more login calls.
 */
import { client, Ctx, PASSWORD, startApp, stopApp } from './harness';

let ctx: Ctx;
let owner: ReturnType<typeof client>;

const login = (username: string, password: string) =>
  fetch(`${ctx.base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

beforeAll(async () => {
  ctx = await startApp();
  owner = client(ctx, ctx.tokens.owner);
});
afterAll(() => stopApp(ctx));

describe('account lockout', () => {
  it('locks an account after 5 wrong passwords — even the right password is refused', async () => {
    for (let i = 0; i < 5; i++) expect((await login('t_acc_b', 'wrong-password-1')).status).toBe(401);
    const res = await login('t_acc_b', PASSWORD);
    expect(res.status).toBe(429);
    expect(((await res.json()) as { message: string }).message).toMatch(/wrong passwords/);

    const { body } = await owner<{ items: { action: string }[] }>('GET', '/audit-logs?entityType=User&take=20');
    expect(body.items.filter((i) => i.action === 'LOGIN_FAILED')).toHaveLength(5);
    expect(body.items.some((i) => i.action === 'LOGIN_LOCKED')).toBe(true);
  });
});

describe('sessions end at once', () => {
  it('a password reset stops the old access token immediately', async () => {
    const accA = client(ctx, ctx.tokens.accA);
    expect((await accA('GET', '/auth/me')).status).toBe(200);
    const { body: users } = await owner<{ id: string; username: string }[]>('GET', '/users');
    const id = users.find((u) => u.username === 't_acc_a')!.id;

    expect((await owner('POST', `/users/${id}/reset-password`, { password: 'NewPassw0rd!' })).status).toBeLessThan(300);
    expect((await accA('GET', '/auth/me')).status).toBe(401);
  });
});

describe('owners', () => {
  it('the last active owner cannot be disabled or demoted by another owner', async () => {
    // a second owner, who then tries to remove the first
    const created = await owner<{ id: string }>('POST', '/users', { name: 'Second Owner', username: 't_owner2', password: 'Passw0rd!x', role: 'OWNER' });
    expect(created.status).toBe(201);
    const { body: users } = await owner<{ id: string; username: string }[]>('GET', '/users');
    const firstId = users.find((u) => u.username === 't_owner')!.id;

    // first owner disables the second → allowed (one owner left)
    expect((await owner('PATCH', `/users/${created.body.id}`, { isActive: false })).status).toBe(200);
    // nobody can now remove the remaining owner (self-change is blocked separately)
    const res = await owner('PATCH', `/users/${firstId}`, { role: 'ACCOUNTANT' });
    expect(res.status).toBe(400);
  });
});

describe('reports', () => {
  it('object built-ins are unknown reports (404), not server errors', async () => {
    for (const key of ['constructor', '__proto__', 'toString']) {
      expect((await owner('GET', `/reports/${key}`)).status).toBe(404);
    }
  });

  it('a financial Excel download is written to the audit log', async () => {
    const res = await fetch(`${ctx.base}/reports/pnl/xlsx`, { headers: { Authorization: `Bearer ${ctx.tokens.owner}` } });
    expect(res.status).toBe(200);
    const { body } = await owner<{ items: { action: string; entityId: string }[] }>('GET', '/audit-logs?entityType=Report');
    expect(body.items[0]).toMatchObject({ action: 'DOWNLOAD_REPORT', entityId: 'pnl' });
  });
});

describe('dashboard charts', () => {
  it('run on a real database (local-day grouping with a time-zone parameter)', async () => {
    expect((await owner('GET', '/dashboard/owner/charts')).status).toBe(200);
    expect((await client(ctx, ctx.tokens.accB)('GET', '/dashboard/accountant/charts')).status).toBe(200);
  });
});
