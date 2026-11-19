import { Tabs } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { TabBar } from '../../../components/TabBar';
import { useSession } from '../../../lib/session';
import { TabChromeProvider, TabScreenLayout } from '../../../lib/tab-chrome';
import { availableLandingScreens, usePreferences } from '../../../services/preferences';

/**
 * The bar shows the daily work: Home · Loads in · Production · Loads out · More.
 * Inventory and Reports are tabs too (so their screens keep the bar), but they are opened
 * from More rather than shown in the bar — fewer buttons to choose from.
 * The bar floats over the screens as frosted glass (lib/tab-chrome); each screen is its blur target.
 * Records and forms open full screen on top.
 *
 * The app opens on the person's preferred landing screen (Preferences → Navigation), checked
 * against what they may open; preferences are loaded before this renders (app/_layout.tsx).
 */
export default function TabsLayout() {
  const { prefs } = usePreferences();
  const { can } = useSession();
  const [sceneBg] = useCSSVariable(['--color-card']).map(String);
  // read once: changing the preference applies on the next start, not by jumping away now
  const [landing] = useState(() => {
    const allowed = availableLandingScreens(can).map((l) => l.id);
    return allowed.includes(prefs.defaultLandingScreen) ? prefs.defaultLandingScreen : 'index';
  });
  return (
    <View className="flex-1 bg-card">
      <TabChromeProvider>
        <Tabs
          initialRouteName={landing}
          screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: sceneBg } }}
          screenLayout={({ route, children }) => <TabScreenLayout routeKey={route.key}>{children}</TabScreenLayout>}
          tabBar={(props) => <TabBar {...props} />}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="loads-in" />
          <Tabs.Screen name="runs" />
          <Tabs.Screen name="loads-out" />
          <Tabs.Screen name="more" />
          <Tabs.Screen name="inventory" />
          <Tabs.Screen name="reports" />
        </Tabs>
      </TabChromeProvider>
    </View>
  );
}
