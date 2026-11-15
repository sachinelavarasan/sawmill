/**
 * HTTP client for the TimberTrail API (axios). Screens don't call this directly for reads —
 * they go through TanStack Query (src/lib/query.ts), which caches by path and passes an
 * AbortSignal so leaving a screen cancels its requests.
 *
 * Auth: a short-lived access token in memory (sent as `Authorization: Bearer`), and the
 * refresh token in the secure store. A 401 triggers one shared refresh, then the request is
 * retried once; if the refresh fails the session is ended (onSessionLost → login screen).
 */
import { apiErrorText, type Permission, type Role } from '@timbertrail/shared';
import axios, { AxiosError, type AxiosRequestConfig, type Method } from 'axios';
import { Directory, File, Paths } from 'expo-file-system';
import { API_URL } from './env';
import { deleteStored, getStored, KEYS, setStored } from './storage';

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

/** Every failed request becomes one of these. status 0 = the server could not be reached. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** the server's X-Request-Id for this request, when it sent one */
    public requestId?: string,
  ) {
    super(message);
  }
}

declare module 'axios' {
  interface AxiosRequestConfig {
    /** login / refresh / logout: a 401 there is an answer, not an expired token */
    skipAuthRefresh?: boolean;
    /** set on the one retry after a refresh */
    _retried?: boolean;
  }
}

export const http = axios.create({
  baseURL: API_URL,
  timeout: 20_000,
  headers: { Accept: 'application/json' },
});

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let onSessionLost: () => void = () => {};

export function setSessionLostHandler(fn: () => void) {
  onSessionLost = fn;
}

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`);
  return config;
});

http.interceptors.response.use(undefined, async (error: unknown) => {
  if (axios.isCancel(error) || !(error instanceof AxiosError)) throw error;
  const config = error.config;
  if (error.response?.status === 401 && config && !config.skipAuthRefresh && !config._retried) {
    if (await tryRefresh()) return http.request({ ...config, _retried: true });
    onSessionLost();
  }
  throw toApiError(error);
});

/** Turn an axios failure into an ApiError; the text (and a 5xx's "(ref …)") comes from the shared apiErrorText. */
function toApiError(e: AxiosError): ApiError {
  if (!e.response) {
    const timedOut = e.code === AxiosError.ECONNABORTED || e.code === AxiosError.ETIMEDOUT;
    return new ApiError(0, timedOut ? `The server took too long to answer (${API_URL})` : `Cannot reach server (${API_URL})`);
  }
  const { status, data, headers } = e.response;
  const rid = headers['x-request-id'];
  const requestId = typeof rid === 'string' ? rid : undefined;
  return new ApiError(status, apiErrorText(status, data, `HTTP ${status}`, requestId), requestId);
}

async function applyAuth(res: AuthResponse) {
  accessToken = res.accessToken;
  await setStored(KEYS.refresh, res.refreshToken);
  return res.user;
}

/** One refresh at a time, however many requests hit a 401 together. */
function tryRefresh(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    const token = await getStored(KEYS.refresh);
    if (!token) return false;
    try {
      const { data } = await http.post<AuthResponse>('/auth/refresh', { refreshToken: token }, { skipAuthRefresh: true });
      await applyAuth(data);
      return true;
    } catch (e) {
      // keep the token if the server was merely unreachable
      if (e instanceof ApiError && e.status !== 0) {
        accessToken = null;
        await deleteStored(KEYS.refresh);
      }
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export interface ApiOptions {
  method?: Method;
  /** sent as JSON */
  body?: unknown;
  /** from TanStack Query: cancels the request when it is no longer needed */
  signal?: AbortSignal;
  params?: AxiosRequestConfig['params'];
}

/** Call the API: `api<T>('/imports?take=30')`, `api('/imports', { method: 'POST', body })`. */
export async function api<T>(path: string, { method = 'GET', body, signal, params }: ApiOptions = {}): Promise<T> {
  const res = await http.request<T>({ url: path, method, data: body, signal, params });
  return res.data;
}

/**
 * Download a file from the API (an Excel report) into the app's cache folder, using
 * the same login and refresh as api(). Returns the saved file; nothing is kept elsewhere.
 * (expo-file-system streams straight to disk, which axios can't do in React Native.)
 */
export async function downloadToCache(path: string, filename: string): Promise<File> {
  const dir = new Directory(Paths.cache, 'reports');
  dir.create({ idempotent: true });
  const target = new File(dir, filename);
  const get = () =>
    File.downloadFileAsync(`${API_URL}${path}`, target, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      idempotent: true,
    });
  try {
    return await get();
  } catch (err) {
    // the access token may have expired: refresh once and try again
    if (await tryRefresh()) return get();
    onSessionLost();
    throw err;
  }
}

export const auth = {
  login: async (username: string, password: string) =>
    applyAuth((await http.post<AuthResponse>('/auth/login', { username, password }, { skipAuthRefresh: true })).data),
  restore: async (): Promise<Profile | null> => ((await tryRefresh()) ? api<Profile>('/auth/me') : null),
  logout: async () => {
    const refreshToken = (await getStored(KEYS.refresh)) ?? undefined;
    try {
      if (accessToken) await http.post('/auth/logout', { refreshToken }, { skipAuthRefresh: true });
    } catch {
      /* offline logout still clears the device */
    } finally {
      accessToken = null;
      await deleteStored(KEYS.refresh);
    }
  },
};
