/**
 * Notifications (expo-notifications), set up the same way as the Expensify app:
 *
 *  Push (remote)  — after sign-in the phone asks for permission, gets its Expo push token
 *                   (needs a real device and the EAS project id) and sends it to the API
 *                   (POST /notifications/tokens). Signing out removes it first. The API pushes
 *                   "IMP-0012 needs your approval" to owners and "approved / needs correction"
 *                   to whoever made the entry.
 *  Local          — a daily reminder scheduled on the phone itself (only needs permission,
 *                   works on emulators too), re-written when the language changes.
 *
 * Tapping a notification opens the record it is about — also when the tap starts the app.
 */
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { api } from './api';
import { rememberPushToken } from './push-token';
import { useLang, useT } from './i18n';
import { invalidate } from './query';
import { useSession } from './session';
import { getStored, KEYS, setStored } from './storage';

/**
 * expo-notifications and expo-device are native modules: they exist only in a binary built
 * after they were installed. Load them defensively so an older dev build (or Expo Go) starts
 * with notifications off and one clear warning, instead of crashing at import.
 */
function loadNative<T>(name: string, load: () => T): T | null {
  try {
    return load();
  } catch {
    if (__DEV__) console.warn(`[TimberTrail] ${name} is not in this build — notifications are off. Rebuild the app: npx expo run:android`);
    return null;
  }
}
const Notifications = loadNative('expo-notifications', () => require('expo-notifications') as typeof import('expo-notifications'));
const Device = loadNative('expo-device', () => require('expo-device') as typeof import('expo-device'));
/** false on a build without the native modules */
export const notificationsAvailable = !!Notifications && !!Device;

/** Show notifications that arrive while the app is open, too. Call once, at start-up. */
export function configureNotifications() {
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

const CHANNEL = 'default';
const REMINDER_ID = 'daily-reminder';

async function ensureChannel() {
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'TimberTrail',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F59E0B',
  });
}

/** Ask once; true when notifications may be shown. Enough for local reminders. */
export async function ensurePermission(): Promise<boolean> {
  if (!Notifications) return false;
  await ensureChannel();
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted';
}

/** The Expo push token for this phone. Throws with a readable reason when there can't be one. */
export async function registerForPushNotificationsAsync(): Promise<string> {
  if (!Notifications || !Device) throw new Error('Notifications are not in this build — rebuild the app');
  if (!Device.isDevice) throw new Error('Push notifications need a physical device');
  if (!(await ensurePermission())) throw new Error('Notification permission was not granted');
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('EAS project id missing — set EAS_PROJECT_ID (see app.config.js)');
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

// ───────── daily reminder (local) ─────────

export interface ReminderSetting {
  on: boolean;
  /** 0–23, local time */
  hour: number;
}
export const DEFAULT_REMINDER: ReminderSetting = { on: false, hour: 18 };

export async function loadReminder(): Promise<ReminderSetting> {
  try {
    const raw = await getStored(KEYS.reminder);
    return raw ? { ...DEFAULT_REMINDER, ...(JSON.parse(raw) as Partial<ReminderSetting>) } : DEFAULT_REMINDER;
  } catch {
    return DEFAULT_REMINDER;
  }
}

/** Save the setting and (re)schedule — or cancel — the repeating daily notification. */
export async function applyReminder(r: ReminderSetting, text: { title: string; body: string }): Promise<ReminderSetting> {
  if (!Notifications) {
    const off = { ...r, on: false };
    await setStored(KEYS.reminder, JSON.stringify(off));
    return off;
  }
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => undefined);
  let next = r;
  if (r.on) {
    if (await ensurePermission()) {
      await Notifications.scheduleNotificationAsync({
        identifier: REMINDER_ID,
        content: { title: text.title, body: text.body, data: { type: 'reminder' }, sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: 0, channelId: CHANNEL },
      });
    } else {
      next = { ...r, on: false };
    }
  }
  await setStored(KEYS.reminder, JSON.stringify(next));
  return next;
}

// ───────── provider ─────────

type PushStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

interface NotificationState {
  /** permission on this phone ('unavailable' on emulators) */
  status: PushStatus;
  expoPushToken: string | null;
  error: string | null;
  /** ask again (or after the user changed it in phone settings) */
  refresh: () => void;
}

const Ctx = createContext<NotificationState>({ status: 'undetermined', expoPushToken: null, error: null, refresh: () => {} });
export const useNotifications = () => useContext(Ctx);

type Payload = { type?: string; kind?: string; id?: string };

/** The last tapped notification; a no-op hook when the native module is missing (fixed for the app's lifetime, so hook order never changes). */
const useLastResponse: () => import('expo-notifications').NotificationResponse | null | undefined = Notifications?.useLastNotificationResponse ?? (() => null);

const RECORD_HREF: Record<string, (id: string) => string> = {
  IMPORT: (id) => `/imports/${id}`,
  PRODUCTION: (id) => `/production/${id}`,
  EXPORT: (id) => `/exports/${id}`,
  ADJUSTMENT: (id) => `/stock/adjustments/${id}`,
};

/** Where a tapped notification should take you. */
function hrefFor(data: Payload): string | null {
  if (data.type === 'workflow' && data.kind && data.id) return RECORD_HREF[data.kind]?.(data.id) ?? null;
  if (data.type === 'reminder') return '/more/measurement';
  return null;
}

/** Inside SessionProvider: registers this phone while someone is signed in, and routes taps. */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const router = useRouter();
  const t = useT();
  const { lang } = useLang();
  const [status, setStatus] = useState<PushStatus>('undetermined');
  const [expoPushToken, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((a) => a + 1), []);

  // register the push token for the signed-in account
  useEffect(() => {
    if (!user) {
      setToken(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        await api('/notifications/tokens', { method: 'POST', body: { token, platform: Platform.OS } });
        rememberPushToken(token);
        if (!cancelled) {
          setToken(token);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!Notifications || !Device) {
          if (!cancelled) setStatus('unavailable');
        } else {
          const { status: s } = await Notifications.getPermissionsAsync();
          if (!cancelled) setStatus(Device.isDevice ? (s as PushStatus) : 'unavailable');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, attempt]);

  // coming back from phone settings may have changed the permission
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && user && refresh());
    return () => sub.remove();
  }, [user, refresh]);

  // keep the daily reminder's text in the current language
  useEffect(() => {
    void loadReminder().then(async (r) => {
      if (r.on) await applyReminder(r, { title: t('reminderTitle'), body: t('reminderBody') });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // a notification arrived while the app is open: refresh what it is about
  useEffect(() => {
    if (!Notifications) return;
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const data = n.request.content.data as Payload;
      if (data?.type === 'workflow') void invalidate('/approvals', '/dashboard', '/imports', '/production', '/exports', '/stock');
    });
    return () => sub.remove();
  }, []);

  // a notification was tapped (app open, in background, or started by the tap)
  const lastResponse = useLastResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !lastResponse) return;
    const key = lastResponse.notification.request.identifier + lastResponse.notification.date;
    if (handled.current === key) return;
    handled.current = key;
    const href = hrefFor(lastResponse.notification.request.content.data as Payload);
    if (href) router.push(href as never);
  }, [lastResponse, user, router]);

  return <Ctx.Provider value={{ status, expoPushToken, error, refresh }}>{children}</Ctx.Provider>;
}
