import '../global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useUniwind } from 'uniwind';
import { DialogProvider } from '../components/confirm';
import { ToastHost } from '../components/toast';
import { LangProvider, useLang } from '../lib/i18n';
import { queryClient } from '../lib/query';
import { SessionProvider, useSession } from '../lib/session';
import { restoreTheme } from '../lib/theme';

// keep the splash up until the saved login has been checked
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 200, fade: true });

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
      <Routes />
      <ToastHost />
    </SessionProvider>
  );
}

/** Logged out: only the login screen exists. Logged in: the app. */
function Routes() {
  const { user, booting } = useSession();
  const { theme } = useUniwind();

  useEffect(() => {
    if (!booting) SplashScreen.hideAsync().catch(() => undefined);
  }, [booting]);

  if (booting) return null;
  return (
    <>
      {/* login has a slate hero; elsewhere the bars follow the theme */}
      <StatusBar style={!user || theme === 'dark' ? 'light' : 'dark'} />
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
