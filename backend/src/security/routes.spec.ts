/**
 * Security regression test: walks every controller the app registers and checks
 * the access policy of every route — without a database. It fails when a new
 * route forgets its policy, when something becomes public, or when an
 * accountant could reach money, client, supplier, user or settings endpoints.
 *
 * The full route → policy table is kept as a snapshot, so any change in who can
 * call what shows up in code review (`npx jest -u` to accept a deliberate one).
 */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { hasAllPermissions, Permission, Role } from '@sawmill/shared';
import { AUTHENTICATED_ONLY_KEY, IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../common/decorators';

process.env.JWT_ACCESS_SECRET ??= 'routes-spec-secret-0123456789';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AppModule } = require('../app.module') as typeof import('../app.module');

type Ctor = abstract new (...args: never[]) => unknown;
interface Route {
  route: string;
  policy: 'public' | 'login' | Permission[];
}

function collectControllers(mod: unknown, seen = new Set<unknown>(), out = new Set<Ctor>()): Set<Ctor> {
  if (!mod || seen.has(mod)) return out;
  seen.add(mod);
  // a dynamic module is { module, controllers, imports }
  const dyn = typeof mod === 'object' ? (mod as { module: unknown; controllers?: Ctor[]; imports?: unknown[] }) : null;
  const cls = dyn ? dyn.module : mod;
  // ConfigModule.forRoot() is a Promise of a module with no controllers — nothing to walk
  if (typeof cls !== 'function') return out;
  const controllers: Ctor[] = [...(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, cls as object) ?? []), ...(dyn?.controllers ?? [])];
  const imports: unknown[] = [...(Reflect.getMetadata(MODULE_METADATA.IMPORTS, cls as object) ?? []), ...(dyn?.imports ?? [])];
  controllers.forEach((c) => out.add(c));
  imports.forEach((m) => collectControllers(m, seen, out));
  return out;
}

const join = (...parts: string[]) => parts.map((p) => p.replace(/^\/|\/$/g, '')).filter(Boolean).join('/');
const asList = (v: unknown): string[] => (Array.isArray(v) ? v : [v ?? '']).map(String);

function collectRoutes(): Route[] {
  const routes: Route[] = [];
  for (const controller of collectControllers(AppModule)) {
    const proto = controller.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      const handler = proto[name];
      if (name === 'constructor' || typeof handler !== 'function') continue;
      const method: RequestMethod | undefined = Reflect.getMetadata(METHOD_METADATA, handler);
      if (method === undefined) continue;
      const meta = <T>(key: string): T | undefined => Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, controller);
      const policy: Route['policy'] = meta<boolean>(IS_PUBLIC_KEY)
        ? 'public'
        : meta<boolean>(AUTHENTICATED_ONLY_KEY)
          ? 'login'
          : (meta<Permission[]>(PERMISSIONS_KEY) ?? []);
      for (const base of asList(Reflect.getMetadata(PATH_METADATA, controller))) {
        for (const path of asList(Reflect.getMetadata(PATH_METADATA, handler))) {
          routes.push({ route: `${RequestMethod[method]} /${join(base, path)}`, policy });
        }
      }
    }
  }
  return routes.sort((a, b) => a.route.localeCompare(b.route));
}

const routes = collectRoutes();
const accountantCan = (r: Route) => r.policy === 'public' || r.policy === 'login' || hasAllPermissions(Role.ACCOUNTANT, r.policy);

describe('API route policies', () => {
  it('finds the app routes', () => {
    expect(routes.length).toBeGreaterThan(60);
    expect(new Set(routes.map((r) => r.route)).size).toBe(routes.length); // no two handlers on one route
  });

  it('every route declares a policy (deny by default would also block it, but loudly)', () => {
    expect(routes.filter((r) => Array.isArray(r.policy) && r.policy.length === 0).map((r) => r.route)).toEqual([]);
  });

  it('only login, refresh and health are public', () => {
    expect(routes.filter((r) => r.policy === 'public').map((r) => r.route)).toEqual(['GET /health', 'POST /auth/login', 'POST /auth/refresh']);
  });

  it('an accountant cannot reach money, clients, suppliers, users, settings or the audit log', () => {
    const forbidden = /financials|clients|suppliers|accounts|expenses|users|settings|audit|approvals(?!\/count)|dashboard\/owner|\/approve|\/reject/;
    expect(routes.filter((r) => accountantCan(r) && forbidden.test(r.route)).map((r) => r.route)).toEqual([]);
  });

  it('owner reaches every route', () => {
    expect(routes.filter((r) => Array.isArray(r.policy) && !hasAllPermissions(Role.OWNER, r.policy)).map((r) => r.route)).toEqual([]);
  });

  it('route → policy table is unchanged (review any diff)', () => {
    const table = routes.map((r) => `${r.route.padEnd(48)} ${Array.isArray(r.policy) ? r.policy.join(' + ') : r.policy}${accountantCan(r) ? '' : '   [owner only]'}`);
    expect(table.join('\n')).toMatchSnapshot();
  });
});
