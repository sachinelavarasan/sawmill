/**
 * HTTP client for the TimberTrail API (axios), the web twin of mobile/src/lib/api.ts.
 *
 * Auth: the session lives in httpOnly cookies the server sets — page scripts (and so anything
 * injected into the page) can never read the tokens. A 401 triggers one shared refresh, then the
 * request is retried once; if the refresh fails the session is ended (onSessionLost → login).
 */
import { apiErrorText, type Permission, type Role } from '@timbertrail/shared';
import axios, { AxiosError, type AxiosResponse, type Method } from 'axios';

export interface Profile {
  id: string;
  name: string;
  username: string;
  role: Role;
  preferredLanguage: string;
  mill: { id: string; name: string; code: string };
  permissions: Permission[];
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
    /** login / refresh / session restore: a 401 there is an answer, not an expired token */
    skipAuthRefresh?: boolean;
    /** set on the one retry after a refresh */
    _retried?: boolean;
  }
}

export const http = axios.create({
  // Production always calls /api on its own domain (Vercel rewrite / nginx proxy): the CSP only
  // allows 'self' and the session cookies are SameSite=Strict. VITE_API_URL is a dev-only override.
  baseURL: (import.meta.env.DEV && import.meta.env.VITE_API_URL) || '/api',
  // send the session cookies (also when VITE_API_URL points at another origin in development)
  withCredentials: true,
  timeout: 30_000,
  headers: {
    Accept: 'application/json',
    // tells the API we are the web app: it answers login / refresh with cookies, and it is the
    // CSRF check on every cookie-authenticated request
    'X-TimberTrail-Client': 'web',
  },
});

/** where versions before httpOnly cookies kept the token — keep this old name, it is what they wrote */
const LEGACY_REFRESH_KEY = 'sawmill.refresh';

let refreshInFlight: Promise<boolean> | null = null;
let onSessionLost: () => void = () => {};

export function setSessionLostHandler(fn: () => void) {
  onSessionLost = fn;
}

http.interceptors.response.use(undefined, async (error: unknown) => {
  if (axios.isCancel(error) || !(error instanceof AxiosError)) throw error;
  const config = error.config;
  if (error.response?.status === 401 && config && !config.skipAuthRefresh && !config._retried) {
    if (await tryRefresh()) return http.request({ ...config, _retried: true });
    onSessionLost();
  }
  throw await toApiError(error);
});

/** Turn an axios failure into an ApiError; the text (and a 5xx's "(ref …)") comes from the shared apiErrorText. */
async function toApiError(e: AxiosError): Promise<ApiError> {
  if (!e.response) {
    const timedOut = e.code === AxiosError.ECONNABORTED || e.code === AxiosError.ETIMEDOUT;
    return new ApiError(0, timedOut ? 'The server took too long to answer' : 'Cannot reach the server');
  }
  const { status, statusText, headers } = e.response;
  let data: unknown = e.response.data;
  // a failed download arrives as a Blob: read the JSON error out of it
  if (data instanceof Blob) data = await data.text().then((t) => JSON.parse(t) as unknown).catch(() => null);
  const rid = headers['x-request-id'];
  const requestId = typeof rid === 'string' ? rid : undefined;
  return new ApiError(status, apiErrorText(status, data, statusText || `HTTP ${status}`, requestId), requestId);
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

/** Ask the server for a fresh session (it reads the refresh cookie and sets new ones). Concurrent callers share one request. */
function tryRefresh(): Promise<boolean> {
  const legacy = takeLegacyToken();
  refreshInFlight ??= http
    .post('/auth/refresh', legacy ? { refreshToken: legacy } : undefined, { skipAuthRefresh: true })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export interface ApiOptions {
  method?: Method | string;
  /** a JSON string or a plain object (sent as JSON) */
  body?: unknown;
  /** cancels the request when it is no longer needed */
  signal?: AbortSignal;
}

const dataOf = <T,>(res: AxiosResponse<T>): T => (res.status === 204 ? (undefined as T) : res.data);

/** Call the API: `api<T>('/imports?take=30')`, `api('/imports', { method: 'POST', body })`. */
export async function api<T>(path: string, { method = 'GET', body, signal }: ApiOptions = {}): Promise<T> {
  return dataOf(
    await http.request<T>({
      url: path,
      method,
      data: body,
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    }),
  );
}

/**
 * Download a file from the API (e.g. an Excel report) and save it with the
 * server's filename. Uses the same login/refresh as api().
 */
export async function download(path: string): Promise<void> {
  // reports can take a while to build: no client-side timeout
  const res = await http.get<Blob>(path, { responseType: 'blob', timeout: 0 });
  const disposition = res.headers['content-disposition'];
  const filename = /filename="([^"]+)"/.exec(typeof disposition === 'string' ? disposition : '')?.[1] ?? 'download';
  const url = URL.createObjectURL(res.data);
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
    return (await http.post<{ user: Profile }>('/auth/login', { username, password }, { skipAuthRefresh: true })).data.user;
  },
  /** Restore a session after page reload: the cookies are still there if the person was signed in. */
  async restore(): Promise<Profile | null> {
    const me = async () => (await http.get<Profile>('/auth/me', { skipAuthRefresh: true })).data;
    try {
      return await me();
    } catch (err) {
      // the access cookie has run out (or this browser still holds an old-style token): refresh once
      if (err instanceof ApiError && err.status === 401 && (await tryRefresh())) return me().catch(() => null);
      return null;
    }
  },
  async logout() {
    // the server revokes the refresh token and clears both cookies
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
  },
};
