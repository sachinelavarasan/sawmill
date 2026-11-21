/**
 * The web app's per-page guided tours. Each key is remembered on the user once seen
 * (users.tours_seen), so a page's tour starts by itself only the first time.
 */
export const PAGE_TOURS = [
  'imports',
  'production',
  'exports',
  'stock',
  'accounts',
  'reports',
  'approvals',
  'suppliers',
  'clients',
  'users',
  'myEntries',
  'audit',
  'settings',
] as const;
export type PageTourKey = (typeof PAGE_TOURS)[number];
