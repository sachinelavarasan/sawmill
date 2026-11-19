import '../lib/dev-trace'; // temporary: traces "state update before mount" warnings
import '../global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { DialogProvider, useConfirm } from '../components/confirm';
import { LockScreen } from '../components/LockScreen';
import { FONT_FILES } from '../components/text';
import { ToastHost } from '../components/toast';
import { AppLockProvider } from '../lib/app-lock';
import { restartIntoUpdate, useAppUpdates } from '../lib/app-updates';
import { useT } from '../lib/i18n';
import { configureNotifications, NotificationProvider } from '../lib/notifications';
import { queryClient } from '../lib/query';
import { SessionProvider, useSession } from '../lib/session';
import { PreferencesProvider, usePreferences } from '../services/preferences';

// keep the splash up until the saved login has been checked
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 200, fade: true });
// show notifications that arrive while the app is open
configureNotifications();

/**
 * Session first, then the preferences that belong to it (services/preferences: theme, language,
 * date format, landing screen …), then everything that reads them.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <PreferencesProvider>
              {/* sheets first: confirmations are sheets too (components/confirm.tsx) */}
              <BottomSheetModalProvider>
                <DialogProvider>
                  <AppLockProvider>
                    <NotificationProvider>
                      <Routes />
                    </NotificationProvider>
                    <LockScreen />
                    <UpdatePrompt />
                  </AppLockProvider>
                  <ToastHost />
                </DialogProvider>
              </BottomSheetModalProvider>
            </PreferencesProvider>
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Logged out: only the login screen exists. Logged in: the app — once that user's preferences are
 * loaded, so the first screen already has their theme, language and landing screen. Until then
 * the login screen stays up (a sign-in) or the splash does (a restored session).
 */
function Routes() {
  const { user, booting } = useSession();
  const { ready: prefsReady } = usePreferences();
  // Inter ships with the app; if a file ever fails to load, carry on with the system font
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const ready = !booting && (fontsLoaded || !!fontError) && prefsReady;
  /** once anything is on screen, later waits (a sign-in) keep it there instead of blanking */
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!ready || started) return;
    setStarted(true);
    SplashScreen.hideAsync().catch(() => undefined);
  }, [ready, started]);

  const [contentBg] = useCSSVariable(['--color-card']).map(String);
  if (!ready && !started) return null;
  const inApp = !!user && prefsReady;
  return (
    <>
      {/* the starting style; each screen then sets its own on focus (components/header.tsx useStatusBar) */}
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: contentBg } }}>
        <Stack.Protected guard={inApp}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!inApp}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

/** Once per downloaded over-the-air update: offer to restart into it now (lib/app-updates.ts). */
function UpdatePrompt() {
  const t = useT();
  const confirm = useConfirm();
  useAppUpdates(async () => {
    if (await confirm({ title: t('updateReady'), message: t('updateReadySub'), confirmText: t('restartNow'), cancelText: t('later') })) await restartIntoUpdate();
  });
  return null;
}
