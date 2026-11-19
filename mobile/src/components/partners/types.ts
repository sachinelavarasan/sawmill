import type { TKey } from '@timbertrail/shared';
import type { IconName } from '../icon';

export type PartnerKind = 'suppliers' | 'clients';
export type PartnerFilter = 'all' | 'outstanding' | 'settled';

export interface PartnerMeta {
  title: TKey;
  subtitle: TKey;
  singular: TKey;
  addLabel: TKey;
  editLabel: TKey;
  emptyLabel: TKey;
  icon: IconName;
  totalBalanceLabel: TKey;
  balanceLabel: TKey;
  outstandingLabel: TKey;
  paidLabel: TKey;
  historyTitle: TKey;
  billLabel: TKey;
  routePrefix: 'imports' | 'exports';
}

export const PARTNER_META: Record<PartnerKind, PartnerMeta> = {
  suppliers: {
    title: 'suppliers',
    subtitle: 'suppliersSub',
    singular: 'supplier',
    addLabel: 'addSupplier',
    editLabel: 'editSupplier',
    emptyLabel: 'noSuppliers',
    icon: 'truck',
    totalBalanceLabel: 'totalPayable',
    balanceLabel: 'payableLabel',
    outstandingLabel: 'pendingPayables',
    paidLabel: 'totalPaid',
    historyTitle: 'purchaseHistory',
    billLabel: 'purchaseEntry',
    routePrefix: 'imports',
  },
  clients: {
    title: 'clients',
    subtitle: 'clientsSub',
    singular: 'client',
    addLabel: 'addClient',
    editLabel: 'editClient',
    emptyLabel: 'noClients',
    icon: 'users',
    totalBalanceLabel: 'totalReceivable',
    balanceLabel: 'receivableLabel',
    outstandingLabel: 'pendingReceivables',
    paidLabel: 'totalReceived',
    historyTitle: 'salesHistory',
    billLabel: 'saleEntry',
    routePrefix: 'exports',
  },
};
