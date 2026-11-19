/** What a person gets before they change anything, and after "Reset to defaults". */
import { type DevicePreferences, PREFERENCES_VERSION, type UserPreferences, WIDGET_IDS } from './preference.types';

export function defaultPreferences(): UserPreferences {
  return {
    version: PREFERENCES_VERSION,
    language: null,
    theme: 'light',
    defaultLandingScreen: 'index',
    dashboard: { visibleWidgets: [...WIDGET_IDS], widgetOrder: [...WIDGET_IDS] },
    display: { listDensity: 'comfortable', dateFormat: 'medium' },
    notifications: { inAppBanner: true, inAppSound: true },
  };
}

export function defaultDevicePreferences(): DevicePreferences {
  return { version: PREFERENCES_VERSION, language: 'en', theme: 'light' };
}
