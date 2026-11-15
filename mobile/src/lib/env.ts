/**
 * Build-time settings. Expo inlines EXPO_PUBLIC_* variables when it bundles the app:
 *   - locally from mobile/.env (copy .env.example),
 *   - in EAS builds from the profile's "env" in eas.json.
 * Read them with the full literal name (process.env.EXPO_PUBLIC_…) or Expo can't inline them.
 */

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!rawApiUrl) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set. Copy mobile/.env.example to mobile/.env, set it to the API address ' +
      '(e.g. http://192.168.1.20:3000/api), then restart Metro with `npx expo start -c`.',
  );
}

/** The API root, e.g. "https://mill.example.in/api" — no trailing slash. */
export const API_URL = rawApiUrl.replace(/\/+$/, '');

// Dev builds say where they are sending requests — the first thing to check when sign-in fails.
if (__DEV__) console.log(`[TimberTrail] API_URL = ${API_URL}`);
