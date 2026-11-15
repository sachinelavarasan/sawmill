import '../global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DialogProvider } from '../components/confirm';
import { FONT_FILES } from '../components/text';
import { ToastHost } from '../components/toast';
import { LangProvider, useLang } from '../lib/i18n';
import { configureNotifications, NotificationProvider } from '../lib/notifications';
import { queryClient } from '../lib/query';
import { SessionProvider, useSession } from '../lib/session';
import { restoreTheme } from '../lib/theme';

// keep the splash up until the saved login has been checked
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 200, fade: true });
// show notifications that arrive while the app is open
configureNotifications();

export default function RootLayout() {
  useEffect(restoreTheme, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <LangProvider>
            <DialogProvider>
              <BottomSheetModalProvider>
                <WithSession />
              </BottomSheetModalProvider>
            </DialogProvider>
          </LangProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function WithSession() {
  const { adopt } = useLang();
  return (
    <SessionProvider onLogin={(p) => adopt(p.preferredLanguage)}>
      <NotificationProvider>
        <Routes />
      </NotificationProvider>
      <ToastHost />
    </SessionProvider>
  );
}

/** Logged out: only the login screen exists. Logged in: the app. */
function Routes() {
  const { user, booting } = useSession();
  // Inter ships with the app; if a file ever fails to load, carry on with the system font
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const ready = !booting && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;
  return (
    <>
      {/* every screen starts with the navy app bar, in both themes */}
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
