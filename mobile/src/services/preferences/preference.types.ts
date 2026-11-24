/**
 * The shape of what this phone remembers about how each person likes to use the app.
 *
 * Nothing here is sensitive: no tokens, passwords, money or records. Login secrets stay in the
 * secure store (lib/api.ts); these live in AsyncStorage, one record per user, plus one small
 * record for the phone itself (the look of the login screen).
 *
 * Bump PREFERENCES_VERSION whenever this shape changes, and add a step in preference.migrations.ts.
 */
import { Permission, type TKey } from '@timbertrail/shared';
import type { IconName } from '../../components/icon';

export const PREFERENCES_VERSION = 1;

export type Language = 'en' | 'ta';
export type ThemePreference = 'light' | 'dark' | 'system';
export type ListDensity = 'comfortable' | 'compact';
/** medium: 19 Nov 2026 · numeric: 19/11/2026 · iso: 2026-11-19 */
export type DateFormat = 'medium' | 'numeric' | 'iso';

/** Tab roots the app may open on. */
export type LandingScreen = 'index' | 'loads-in' | 'runs' | 'loads-out' | 'inventory' | 'reports';

/** Sections of the Home dashboard a person can show, hide and reorder. */
export type DashboardWidget = 'keyMetrics' | 'quickActions' | 'approvals' | 'measuring' | 'finance' | 'operations' | 'entryStatus' | 'activity';

export interface UserPreferences {
  version: number;
  /** null: follow the language set on the account (Profile.preferredLanguage) */
  language: Language | null;
  theme: ThemePreference;
  defaultLandingScreen: LandingScreen;
  dashboard: {
    /** shown widgets; a widget missing from `widgetOrder` is newer than this record and shows */
    visibleWidgets: DashboardWidget[];
    /** every widget this person has arranged, top to bottom */
    widgetOrder: DashboardWidget[];
  };
  display: {
    listDensity: ListDensity;
    dateFormat: DateFormat;
  };
  /** how notifications look while the app is open — on this phone only */
  notifications: {
    inAppBanner: boolean;
    inAppSound: boolean;
  };
}

/** The phone's own record: what the login screen looks like (the last signed-in look). */
export interface DevicePreferences {
  version: number;
  language: Language;
  theme: ThemePreference;
}

// ───────── catalogues (what may be offered, by role and permission) ─────────

export type DashboardRole = 'owner' | 'accountant';

export interface WidgetInfo {
  id: DashboardWidget;
  labelKey: TKey;
  icon: IconName;
  /** dashboards that have this section */
  roles: DashboardRole[];
  /** also needs this permission (never shown without it, whatever the preference says) */
  permission?: Permission;
}

/** In default order. */
export const WIDGETS: WidgetInfo[] = [
  { id: 'keyMetrics', labelKey: 'keyMetrics', icon: 'bar-chart-2', roles: ['owner', 'accountant'] },
  { id: 'quickActions', labelKey: 'quickActions', icon: 'plus', roles: ['owner', 'accountant'] },
  { id: 'approvals', labelKey: 'pendingApprovals', icon: 'check-circle', roles: ['owner'], permission: Permission.OPERATIONS_APPROVE },
  { id: 'measuring', labelKey: 'measurementProgress', icon: 'ruler', roles: ['accountant'] },
  { id: 'finance', labelKey: 'financialOverview', icon: 'wallet', roles: ['owner'], permission: Permission.FINANCE_VIEW },
  { id: 'operations', labelKey: 'operationalOverview', icon: 'factory', roles: ['owner'] },
  { id: 'entryStatus', labelKey: 'entryStatus', icon: 'pie-chart', roles: ['accountant'] },
  { id: 'activity', labelKey: 'recentActivity', icon: 'activity', roles: ['owner', 'accountant'] },
];

export const WIDGET_IDS = WIDGETS.map((w) => w.id);

export interface LandingInfo {
  id: LandingScreen;
  labelKey: TKey;
  icon: IconName;
  permission?: Permission;
}

export const LANDING_SCREENS: LandingInfo[] = [
  { id: 'index', labelKey: 'home', icon: 'home' },
  { id: 'loads-in', labelKey: 'imports', icon: 'truck' },
  { id: 'runs', labelKey: 'production', icon: 'factory' },
  { id: 'loads-out', labelKey: 'exports', icon: 'truck-out' },
  { id: 'inventory', labelKey: 'inventory', icon: 'boxes' },
  { id: 'reports', labelKey: 'reports', icon: 'bar-chart-2' },
];
