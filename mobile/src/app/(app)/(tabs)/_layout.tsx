import { Tabs } from 'expo-router';
import { TabBar } from '../../../components/TabBar';

/** Home · Inventory · Production · Reports · More. Records and forms open full screen on top. */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, animation: 'shift' }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="inventory" />
      <Tabs.Screen name="runs" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
