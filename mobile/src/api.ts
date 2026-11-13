import type { Permission, Role } from '@sawmill/shared';
import * as SecureStore from 'expo-secure-store';

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

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000/api';
const REFRESH_KEY = 'sawmill_refresh';

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let onSessionLost: () => void = () => {};

export function setSessionLostHandler(fn: () => void) {
  onSessionLost = fn;
}

async function applyAuth(res: AuthResponse) {
  accessToken = res.accessToken;
  await SecureStore.setItemAsync(REFRESH_KEY, res.refreshToken);
  return res.user;
}

async function raw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, `Cannot reach server (${BASE})`);
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
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

async function tryRefresh(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!token) return false;
  refreshInFlight ??= raw<AuthResponse>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: token }) })
    .then(async (r) => {
      await applyAuth(r);
      return true;
    })
    .catch(async (e) => {
      // keep the token if the server was merely unreachable
      if (e instanceof ApiError && e.status !== 0) {
        accessToken = null;
        await SecureStore.deleteItemAsync(REFRESH_KEY);
      }
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
    if (err instanceof ApiError && err.status === 401) {
      if (await tryRefresh()) return raw<T>(path, init);
      onSessionLost();
    }
    throw err;
  }
}

export const auth = {
  login: async (username: string, password: string) =>
    applyAuth(await raw<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })),
  restore: async (): Promise<Profile | null> => ((await tryRefresh()) ? raw<Profile>('/auth/me') : null),
  logout: async () => {
    const refreshToken = (await SecureStore.getItemAsync(REFRESH_KEY)) ?? undefined;
    try {
      if (accessToken) await raw('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
    } catch {
      /* offline logout still clears the device */
    } finally {
      accessToken = null;
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    }
  },
};
