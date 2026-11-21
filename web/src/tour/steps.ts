import type { DriveStep } from 'driver.js';
import type { TKey } from '../i18n';
import type { NavGroup } from '../nav';
import type { TourStep } from './pages';

type T = (key: TKey, vars?: Record<string, string | number>) => string;

/** The `[data-tour]` selector for a tour target. */
export const tourSel = (id: string) => `[data-tour="${id}"]`;

/** On screen right now: in the DOM and taking up room (hidden by a breakpoint, a mode or a permission = left out). */
export const tourTargetVisible = (id: string) => {
  const el = document.querySelector(tourSel(id));
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/** driver.js steps from tour steps: targets not on screen are dropped, target-less steps stay as centred cards. */
export function toDriveSteps(t: T, steps: TourStep[]): DriveStep[] {
  return steps
    .filter((s) => !s.id || tourTargetVisible(s.id))
    .map((s) => ({
      element: s.id ? tourSel(s.id) : undefined,
      popover: { title: t(s.title), description: t(s.body), side: s.side ?? 'bottom', align: 'start' },
    }));
}

const GROUP_TEXT: Record<NavGroup, { title: TKey; body: TKey }> = {
  main: { title: 'tourGroupMainTitle', body: 'tourGroupMainBody' },
  operations: { title: 'operations', body: 'tourGroupOperationsBody' },
  parties: { title: 'navParties', body: 'tourGroupPartiesBody' },
  accounts: { title: 'accounts', body: 'tourGroupAccountsBody' },
  admin: { title: 'navAdmin', body: 'tourGroupAdminBody' },
};

/**
 * The app-shell tour: what each part of the frame is for. Built when the tour starts, from what is
 * actually on screen, so it follows the role (menu groups hidden by permissions are not rendered),
 * the simple/full view and the screen size without any rules of its own. `extra` (the home page's
 * own steps) goes before the closing "press ? any time" step.
 */
export function buildShellSteps({ t, simple, name, extra = [] }: { t: T; simple: boolean; name: string; extra?: TourStep[] }): DriveStep[] {
  const steps: TourStep[] = [
    // phone: the menu lives behind the ☰ button
    { id: 'menu-button', title: 'tourMenuTitle', body: 'tourMenuBody' },
    ...(simple
      ? [{ id: 'nav-main', title: 'tourNavSimpleTitle', body: 'tourNavSimpleBody', side: 'right' } as TourStep]
      : (Object.keys(GROUP_TEXT) as NavGroup[]).map((g): TourStep => ({ id: `nav-${g}`, ...GROUP_TEXT[g], side: 'right' }))),
    { id: 'search', title: 'tourSearchTitle', body: 'tourSearchBody' },
    { id: 'create', title: 'tourCreateTitle', body: 'tourCreateBody' },
    { id: 'notifications', title: 'tourBellTitle', body: 'tourBellBody' },
    { id: 'theme', title: 'tourThemeTitle', body: 'tourThemeBody' },
    { id: 'lang', title: 'tourLangTitle', body: 'tourLangBody' },
    { id: 'account', title: 'tourAccountTitle', body: 'tourAccountBody', side: 'right' },
    ...extra,
    { id: 'help', title: 'tourHelpTitle', body: 'tourHelpBody' },
  ];
  return [{ popover: { title: t('tourWelcomeTitle', { name }), description: t('tourWelcomeBody') } }, ...toDriveSteps(t, steps)];
}
