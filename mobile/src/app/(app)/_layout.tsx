import { Stack } from 'expo-router';

/** Everything after login: the tabs, plus records and forms opened full screen on top of them. */
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
