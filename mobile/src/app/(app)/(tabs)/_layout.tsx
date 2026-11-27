import { Tabs } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { TabBar } from '../../../components/TabBar';
import { LORRY_FLOW_ONLY } from '../../../lib/lorry-mode';
import { useSession } from '../../../lib/session';
import { TabChromeProvider, TabScreenLayout } from '../../../lib/tab-chrome';
import { availableLandingScreens, usePreferences } from '../../../services/preferences';

/**
 * The bar (components/TabBar) shows the mockup's tabs: owner Home · Approvals · Stock · Reports,
 * accountant Home · My work · Stock. The other screens here (loads in, production, loads out, More)
 * are tabs too, so they keep the bar; they open from Home's tiles and from More (profile sheet).
 * The bar floats over the screens as frosted glass (lib/tab-chrome); each screen is its blur target.
 * Records and forms open full screen on top.
 *
 * The app opens on the person's preferred landing screen (Preferences → Navigation), checked
 * against what they may open; preferences are loaded before this renders (app/_layout.tsx).
 */
export default function TabsLayout() {
  const { prefs } = usePreferences();
  const { can } = useSession();
  const [sceneBg] = useCSSVariable(['--color-background']).map(String);
  // read once: changing the preference applies on the next start, not by jumping away now
  const [landing] = useState(() => {
    const allowed = availableLandingScreens(can).map((l) => l.id);
    if (LORRY_FLOW_ONLY) return 'index'; // lorry-only mode: Home is the only way in
    return allowed.includes(prefs.defaultLandingScreen) ? prefs.defaultLandingScreen : 'index';
  });
  return (
    <View className="flex-1 bg-background">
      <TabChromeProvider>
        <Tabs
          initialRouteName={landing}
          screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: sceneBg } }}
          screenLayout={({ route, children }) => <TabScreenLayout routeKey={route.key}>{children}</TabScreenLayout>}
          // lorry-only mode: no bottom bar — Home's three cards are the whole app
          tabBar={(props) => (LORRY_FLOW_ONLY ? null : <TabBar {...props} />)}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="approvals" />
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
