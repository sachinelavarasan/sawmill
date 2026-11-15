import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { toast } from '../../components/toast';
import { useT } from '../../lib/i18n';
import { flushPending, usePendingLogs } from '../../lib/offline-logs';
import { invalidateOperations } from '../../lib/query';
import { useSession } from '../../lib/session';

/** Everything after login: the tabs, plus records and forms opened full screen on top of them. */
export default function AppLayout() {
  return (
    <>
      <PendingLogsSync />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </>
  );
}

const RETRY_MS = 20_000;

/**
 * Sends logs measured offline (lib/offline-logs.ts) whatever screen is open: at once, when the
 * app returns to the foreground, and every 20 s while any are waiting.
 */
function PendingLogsSync() {
  const t = useT();
  const userId = useSession().user?.id;
  // a yes/no, not the count: sending one log must not restart the timer (or toast the same batch twice)
  const hasWaiting = usePendingLogs(userId).some((p) => !p.error);

  useEffect(() => {
    if (!userId || !hasWaiting) return;
    let running = false;
    const send = async () => {
      if (running) return; // a slow send (20 s timeout) can outlast the timer
      running = true;
      try {
        const sent = await flushPending(userId);
        if (sent.length) {
          toast(t('pendingSent', { n: sent.length }));
          void invalidateOperations();
        }
      } finally {
        running = false;
      }
    };
    void send();
    const timer = setInterval(() => void send(), RETRY_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void send());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [userId, hasWaiting, t]);

  return null;
}
