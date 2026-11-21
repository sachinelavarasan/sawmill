import type { PageTourKey } from '@timbertrail/shared';
import type { TKey } from '../i18n';

/**
 * One stop of a tour. `id` names a `[data-tour]` target; without one the step is a centred card.
 * A step whose target is not on screen (another role, the simple view, a phone, no data yet) is skipped.
 */
export interface TourStep {
  id?: string;
  title: TKey;
  body: TKey;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export interface PageTour {
  key: PageTourKey;
  /** the list page it runs on (exact path: never over a record or a form) */
  path: string;
  steps: TourStep[];
}

/** The shared parts of a record list: new-record button, status cards, search & filters, the table. */
const listSteps = (actions: TKey, table: TKey = 'tourTableBody'): TourStep[] => [
  { id: 'page-actions', title: 'tourActionsTitle', body: actions, side: 'left' },
  { id: 'status-cards', title: 'tourStatusCardsTitle', body: 'tourStatusCardsBody' },
  { id: 'list-toolbar', title: 'tourToolbarTitle', body: 'tourToolbarBody' },
  { id: 'filter-chips', title: 'tourChipsTitle', body: 'tourChipsBody' },
  { id: 'table', title: 'tourTableTitle', body: table, side: 'top' },
];

/** Added to the app tour when it runs on the home page (owner, accountant or simple home: missing parts are skipped). */
export const HOME_STEPS: TourStep[] = [
  { id: 'home-hero', title: 'tourHomeHeroTitle', body: 'tourHomeHeroBody' },
  { id: 'sec-attention', title: 'secAttention', body: 'tourAttentionBody', side: 'top' },
  { id: 'quick-actions', title: 'tourQuickActionsTitle', body: 'tourQuickActionsBody', side: 'top' },
  { id: 'sec-analytics', title: 'secAnalytics', body: 'tourAnalyticsBody', side: 'top' },
];

export const PAGE_TOUR_DEFS: PageTour[] = [
  { key: 'imports', path: '/imports', steps: [{ title: 'imports', body: 'tourImportsIntro' }, ...listSteps('tourImportsActions')] },
  { key: 'production', path: '/production', steps: [{ title: 'production', body: 'tourProductionIntro' }, ...listSteps('tourProductionActions')] },
  { key: 'exports', path: '/exports', steps: [{ title: 'exports', body: 'tourExportsIntro' }, ...listSteps('tourExportsActions')] },
  {
    key: 'stock',
    path: '/stock',
    steps: [
      { title: 'stock', body: 'tourStockIntro' },
      { id: 'stock-summary', title: 'tourStockSummaryTitle', body: 'tourStockSummaryBody' },
      { id: 'tabs', title: 'tourTabsTitle', body: 'tourStockTabsBody' },
      { id: 'filter-chips', title: 'tourChipsTitle', body: 'tourChipsBody' },
      { id: 'table', title: 'tourTableTitle', body: 'tourStockTableBody', side: 'top' },
      { id: 'page-actions', title: 'tourActionsTitle', body: 'tourStockActions', side: 'left' },
    ],
  },
  {
    key: 'accounts',
    path: '/accounts',
    steps: [
      { title: 'accounts', body: 'tourAccountsIntro' },
      { id: 'period', title: 'tourPeriodTitle', body: 'tourPeriodBody' },
      { id: 'stats', title: 'tourAccountsStatsTitle', body: 'tourAccountsStatsBody' },
      { id: 'sec-pnl', title: 'reportPnl', body: 'tourPnlBody', side: 'top' },
      { id: 'sec-balances', title: 'outstandingBalances', body: 'tourBalancesBody', side: 'top' },
    ],
  },
  {
    key: 'reports',
    path: '/reports',
    steps: [
      { title: 'reports', body: 'tourReportsIntro' },
      // the catalogue
      { id: 'reports-operational', title: 'operationalReports', body: 'tourReportsOperationalBody' },
      { id: 'reports-financial', title: 'financialReports', body: 'tourReportsFinancialBody', side: 'top' },
      // an open report
      { id: 'report-controls', title: 'tourReportControlsTitle', body: 'tourReportControlsBody' },
      { id: 'page-actions', title: 'tourReportsActionsTitle', body: 'tourReportsActions', side: 'left' },
    ],
  },
  {
    key: 'approvals',
    path: '/approvals',
    steps: [
      { title: 'approvals', body: 'tourApprovalsIntro' },
      { id: 'approval-types', title: 'tourApprovalTypesTitle', body: 'tourApprovalTypesBody' },
      { id: 'table', title: 'tourTableTitle', body: 'tourApprovalsTable', side: 'top' },
    ],
  },
  {
    key: 'suppliers',
    path: '/suppliers',
    steps: [
      { title: 'suppliers', body: 'tourSuppliersIntro' },
      { id: 'page-actions', title: 'tourActionsTitle', body: 'tourSuppliersActions', side: 'left' },
      { id: 'list-toolbar', title: 'tourToolbarTitle', body: 'tourToolbarBody' },
      { id: 'table', title: 'tourTableTitle', body: 'tourPartiesTable', side: 'top' },
    ],
  },
  {
    key: 'clients',
    path: '/clients',
    steps: [
      { title: 'clients', body: 'tourClientsIntro' },
      { id: 'page-actions', title: 'tourActionsTitle', body: 'tourClientsActions', side: 'left' },
      { id: 'list-toolbar', title: 'tourToolbarTitle', body: 'tourToolbarBody' },
      { id: 'table', title: 'tourTableTitle', body: 'tourPartiesTable', side: 'top' },
    ],
  },
  {
    key: 'users',
    path: '/users',
    steps: [
      { title: 'users', body: 'tourUsersIntro' },
      { id: 'page-actions', title: 'tourActionsTitle', body: 'tourUsersActions', side: 'left' },
      { id: 'filter-chips', title: 'tourChipsTitle', body: 'tourUsersChips' },
      { id: 'table', title: 'tourTableTitle', body: 'tourUsersTable', side: 'top' },
    ],
  },
  {
    key: 'myEntries',
    path: '/my-entries',
    steps: [
      { title: 'myEntries', body: 'tourMyEntriesIntro' },
      { id: 'page-actions', title: 'tourActionsTitle', body: 'tourMyEntriesActions', side: 'left' },
      { id: 'tabs', title: 'tourTabsTitle', body: 'tourMyEntriesTabs' },
      { id: 'filter-chips', title: 'tourChipsTitle', body: 'tourChipsBody' },
      { id: 'table', title: 'tourTableTitle', body: 'tourTableBody', side: 'top' },
    ],
  },
  {
    key: 'audit',
    path: '/audit',
    steps: [
      { title: 'auditLog', body: 'tourAuditIntro' },
      { id: 'table', title: 'tourTableTitle', body: 'tourAuditTable', side: 'top' },
    ],
  },
  {
    key: 'settings',
    path: '/settings',
    steps: [
      { title: 'settings', body: 'tourSettingsIntro' },
      { id: 'view-mode', title: 'viewMode', body: 'tourViewModeBody' },
    ],
  },
];

export const pageTourFor = (pathname: string) => PAGE_TOUR_DEFS.find((p) => p.path === pathname);
