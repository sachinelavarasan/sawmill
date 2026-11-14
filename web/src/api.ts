import type { Permission, Role } from '@sawmill/shared';

export interface Profile {
  id: string;
  name: string;
  username: string;
  role: Role;
  preferredLanguage: string;
  mill: { id: string; name: string; code: string };
  permissions: Permission[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const BASE = import.meta.env.VITE_API_URL ?? '/api';
/**
 * The session lives in httpOnly cookies the server sets: page scripts (and so anything
 * injected into the page) can never read the tokens. This header tells the API we are the
 * web app — it answers login / refresh with cookies, and it is the CSRF check on every request.
 */
const CLIENT = { 'X-Sawmill-Client': 'web' };
/** Where older versions kept the refresh token; moved into a cookie the first time it is seen. */
const LEGACY_REFRESH_KEY = 'sawmill.refresh';

let refreshInFlight: Promise<boolean> | null = null;
let onSessionLost: () => void = () => {};

export function setSessionLostHandler(fn: () => void) {
  onSessionLost = fn;
}

/** The refresh token an older version left in localStorage, removed as it is read. */
function takeLegacyToken(): string | null {
  try {
    const v = localStorage.getItem(LEGACY_REFRESH_KEY);
    if (v) localStorage.removeItem(LEGACY_REFRESH_KEY);
    return v;
  } catch {
    return null;
  }
}

async function raw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  headers.set('X-Sawmill-Client', CLIENT['X-Sawmill-Client']);
  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? message);
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

/** Ask the server for a fresh session (it reads the refresh cookie and sets new ones). Concurrent callers share one request. */
async function tryRefresh(): Promise<boolean> {
  const legacy = takeLegacyToken();
  refreshInFlight ??= raw('/auth/refresh', { method: 'POST', body: legacy ? JSON.stringify({ refreshToken: legacy }) : undefined })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await raw<T>(path, init);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && (await tryRefresh())) {
      return raw<T>(path, init);
    }
    if (err instanceof ApiError && err.status === 401) onSessionLost();
    throw err;
  }
}

/**
 * Download a file from the API (e.g. an Excel report) and save it with the
 * server's filename. Uses the same login/refresh as api().
 */
export async function download(path: string): Promise<void> {
  const get = () => fetch(`${BASE}${path}`, { headers: CLIENT, credentials: 'include' });
  let res = await get();
  if (res.status === 401 && (await tryRefresh())) res = await get();
  if (!res.ok) {
    if (res.status === 401) onSessionLost();
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? message);
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message);
  }
  const filename = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'download';
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const auth = {
  async login(username: string, password: string): Promise<Profile> {
    return (await raw<{ user: Profile }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })).user;
  },
  /** Restore a session after page reload: the cookies are still there if the person was signed in. */
  async restore(): Promise<Profile | null> {
    try {
      return await raw<Profile>('/auth/me');
    } catch (err) {
      // the access cookie has run out (or this browser still holds an old-style token): refresh once
      if (err instanceof ApiError && err.status === 401 && (await tryRefresh())) return raw<Profile>('/auth/me');
      return null;
    }
  },
  async logout() {
    // the server revokes the refresh token and clears both cookies
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
  },
};
