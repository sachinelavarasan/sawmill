import { Tabs } from 'expo-router';
import { TabBar } from '../../../components/TabBar';
import { TabChromeProvider, TabScreenLayout } from '../../../lib/tab-chrome';

/**
 * The bar shows the daily work: Home · Loads in · Production · Loads out · More.
 * Inventory and Reports are tabs too (so their screens keep the bar), but they are opened
 * from More rather than shown in the bar — fewer buttons to choose from.
 * The bar floats over the screens as frosted glass (lib/tab-chrome); each screen is its blur target.
 * Records and forms open full screen on top.
 */
export default function TabsLayout() {
  return (
    <TabChromeProvider>
      <Tabs
        screenOptions={{ headerShown: false, animation: 'fade' }}
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
  );
}
