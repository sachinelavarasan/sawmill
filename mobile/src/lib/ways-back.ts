/**
 * Moving between screens with a way back (web: loadOutLink() in pages/Production.tsx, sawingLink()
 * in pages/Imports.tsx). People find something missing halfway through a job — a size not sawn
 * yet, logs not loaded in — fix it on another screen, and come back to where they were:
 *
 *   Load Out record → New Sawing   carries wood, t, w, l, pcs, back=/exports/<id>, backCode
 *   New Sawing      → New Load In  carries wood, back=/production/new?… (its own link, back and all)
 *
 * A `back` is only ever accepted in these shapes, so a link can't send anyone elsewhere. Return with
 * router.dismissTo(), which goes back to the screen already open instead of pushing a new copy.
 */

/** Expo Router params may arrive as string | string[]; the first value, or ''. */
export const param = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''));

/** The load out to go back to, when `back` is one: `/exports/<uuid>`. */
export function loadOutLink(back: string, code: string): { to: `/exports/${string}`; code: string } | null {
  return /^\/exports\/[0-9a-f-]{36}$/i.test(back) ? { to: back as `/exports/${string}`, code } : null;
}

/** The New Sawing to go back to, when `back` is one: `/production/new…`. */
export function sawingLink(back: string): string | null {
  return /^\/production\/new(\?.*)?$/.test(back) ? back : null;
}

/** `/production/new?…` → its path and params, for router.dismissTo / replace. */
export function splitLink(link: string): { pathname: string; params: Record<string, string> } {
  const [pathname, query = ''] = link.split('?');
  const params: Record<string, string> = {};
  for (const part of query.split('&')) {
    if (!part) continue;
    const [k, v = ''] = part.split('=');
    params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return { pathname, params };
}

/** Params → a query string (no leading "?"), skipping empty values. */
export function toQuery(params: Record<string, string | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`)
    .join('&');
}
