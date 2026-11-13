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

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: Profile;
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
const REFRESH_KEY = 'sawmill.refresh';

// Access token lives only in memory; the refresh token survives a page reload.
let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let onSessionLost: () => void = () => {};

const store = {
  get: () => {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set: (v: string | null) => {
    try {
      if (v) localStorage.setItem(REFRESH_KEY, v);
      else localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

export function setSessionLostHandler(fn: () => void) {
  onSessionLost = fn;
}

function applyAuth(res: AuthResponse): Profile {
  accessToken = res.accessToken;
  store.set(res.refreshToken);
  return res.user;
}

async function raw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
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

/** Exchange the stored refresh token for a new pair. Concurrent callers share one request. */
async function tryRefresh(): Promise<boolean> {
  const token = store.get();
  if (!token) return false;
  refreshInFlight ??= raw<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: token }),
  })
    .then((r) => {
      applyAuth(r);
      return true;
    })
    .catch(() => {
      accessToken = null;
      store.set(null);
      return false;
    })
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
  const get = () => fetch(`${BASE}${path}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
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
    return applyAuth(
      await raw<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    );
  },
  /** Restore a session after page reload. */
  async restore(): Promise<Profile | null> {
    if (!(await tryRefresh())) return null;
    return raw<Profile>('/auth/me');
  },
  async logout() {
    const refreshToken = store.get() ?? undefined;
    try {
      if (accessToken) await raw('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
    } finally {
      accessToken = null;
      store.set(null);
    }
  },
};
