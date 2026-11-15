import { Stack } from 'expo-router';

/**
 * A screen opened straight from elsewhere (e.g. Accounts from a Home figure) still has this
 * tab's first screen underneath, so its back arrow leads there.
 */
export const unstable_settings = { initialRouteName: 'index' };

/** Screens inside this tab keep the bottom bar visible. */
export default function TabStack() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
