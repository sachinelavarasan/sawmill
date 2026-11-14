import { Tabs } from 'expo-router';
import { TabBar } from '../../../components/TabBar';

/** Home · Transactions · (Quick Add) · Reports · More. Quick Add is a button in the bar, not a screen. */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
