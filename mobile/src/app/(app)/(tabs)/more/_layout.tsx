import { Stack } from 'expo-router';

/** Screens inside this tab keep the bottom bar visible. */
export default function TabStack() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
