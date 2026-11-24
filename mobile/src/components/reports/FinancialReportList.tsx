import type { TKey } from '@timbertrail/shared';
import { View } from 'react-native';
import { useT } from '../../lib/i18n';
import type { ReportInfo } from '../../lib/types';
import { type IconName, MenuGroup, MenuRow, Pill, SectionTitle } from '../ui';

const FINANCIAL_META: Record<string, { sub: TKey; icon: IconName }> = {
  pnl: { sub: 'reportPnlSub', icon: 'trending-up' },
  expenses: { sub: 'reportExpensesSub', icon: 'receipt' },
  receivables: { sub: 'reportReceivablesSub', icon: 'arrow-down-circle' },
  payables: { sub: 'reportPayablesSub', icon: 'arrow-up-circle' },
  yieldSupplier: { sub: 'reportYieldSupplierSub', icon: 'truck' },
};

/** Compact grouped rows for Financial Reports (no excessive large cards). */
export function FinancialReportList({
  items,
  onOpen,
}: {
  items: ReportInfo[];
  onOpen: (r: ReportInfo) => void;
}) {
  const t = useT();
  if (!items.length) return null;

  return (
    <View className="gap-2.5">
      <SectionTitle right={<Pill icon="lock" text={t('ownerOnly')} />}>{t('financialReports')}</SectionTitle>
      <MenuGroup inset>
        {items.map((r, i) => {
          const meta = FINANCIAL_META[r.key] ?? { sub: 'reportPnlSub' as TKey, icon: 'file-text' as IconName };
          return (
            <MenuRow
              key={r.key}
              mod="approve"
              icon={meta.icon}
              title={r.title}
              subtitle={t(meta.sub)}
              onPress={() => onOpen(r)}
              last={i === items.length - 1}
            />
          );
        })}
      </MenuGroup>
    </View>
  );
}
