/**
 * Expo config for TimberTrail.
 *
 * The API address comes from EXPO_PUBLIC_API_URL (.env locally, eas.json for builds).
 * Splash: the logo on light #F4F6F9 / navy #0F1B2E, held until fonts and the saved login
 * are ready (src/app/_layout.tsx), then faded out.
 */
const fs = require('fs');
const path = require('path');
const { withGradleProperties } = require('@expo/config-plugins');

/** Release builds of a React Native app run out of Gradle memory on the defaults. */
const withIncreasedMetaspace = (config) =>
  withGradleProperties(config, (config) => {
    const key = 'org.gradle.jvmargs';
    const value = '-Xmx6144m -XX:MaxMetaspaceSize=2048m';
    const existing = config.modResults.find((item) => item.type === 'property' && item.key === key);
    if (existing) existing.value = value;
    else config.modResults.push({ type: 'property', key, value });
    return config;
  });

/**
 * Android push needs Firebase Cloud Messaging: put the Firebase project's google-services.json
 * next to this file (git-ignored), or point GOOGLE_SERVICES_JSON at it (an EAS file secret).
 * Without it the app still builds; only remote push is off on Android.
 */
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(path.join(__dirname, 'google-services.json')) ? './google-services.json' : undefined);

module.exports = {
  expo: {
    name: 'TimberTrail',
    slug: 'timbertrail',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'timbertrail',
    userInterfaceStyle: 'automatic',
    backgroundColor: '#F4F6F9',
    ios: {
      supportsTablet: false,
    },
    android: {
      icon: './assets/icon.png',
      adaptiveIcon: {
        foregroundImage: './assets/images/android-icon.png',
        backgroundColor: '#0F1B2E',
      },
      package: 'com.timbertrail.app',
      softwareKeyboardLayoutMode: 'resize',
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    plugins: [
      withIncreasedMetaspace,
      'expo-router',
      'expo-secure-store',
      'expo-font',
      'expo-sharing',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-logo.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#F4F6F9',
          dark: {
            image: './assets/images/splash-logo-dark.png',
            backgroundColor: '#0F1B2E',
          },
        },
      ],
      [
        'expo-notifications',
        {
          defaultChannel: 'default',
          color: '#F59E0B',
          enableBackgroundRemoteNotifications: false,
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
          },
        },
      ],
    ],
    extra: {
      router: {},
      // `eas init` prints the project id; put it in EAS_PROJECT_ID (.env / eas.json) — a dynamic config can't be edited for you
      ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
  },
};
