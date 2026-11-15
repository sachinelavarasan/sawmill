/** The push token this phone registered with the API, so sign-out can remove it first. */
import { api } from './api';

let registered: string | null = null;

export function rememberPushToken(token: string) {
  registered = token;
}

/** Before signing out: stop pushes to this phone for the old account. Never throws. */
export async function releasePushToken() {
  if (!registered) return;
  const token = registered;
  registered = null;
  try {
    await api('/notifications/tokens', { method: 'DELETE', body: { token } });
  } catch {
    /* offline: the API drops dead tokens by itself */
  }
}
