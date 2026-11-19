import type { TKey } from '@timbertrail/shared';
import { View } from 'react-native';
import { useT } from '../../lib/i18n';
import type { ReportInfo } from '../../lib/types';
import { type IconName, MenuGroup, MenuRow, SectionTitle } from '../ui';

const OP_META: Record<string, { sub: TKey; icon: IconName }> = {
  imports: { sub: 'reportImportsSub', icon: 'download' },
  production: { sub: 'reportProductionSub', icon: 'settings' },
  yieldWood: { sub: 'reportYieldWoodSub', icon: 'pie-chart' },
  exports: { sub: 'reportExportsSub', icon: 'upload' },
  stock: { sub: 'reportStockSub', icon: 'layers' },
};

/** Compact grouped rows for Operational Reports + drill-downs into stock movements & corrections. */
export function OperationalReportList({
  items,
  onOpen,
  onOpenInventory,
}: {
  items: ReportInfo[];
  onOpen: (r: ReportInfo) => void;
  onOpenInventory: () => void;
}) {
  const t = useT();
  if (!items.length) return null;

  return (
    <View className="gap-2.5">
      <SectionTitle>{t('operationalReports')}</SectionTitle>
      <MenuGroup inset>
        {items.map((r) => {
          const meta = OP_META[r.key] ?? { sub: 'reportStockSub' as TKey, icon: 'file-text' as IconName };
          return (
            <MenuRow
              key={r.key}
              icon={meta.icon}
              title={r.title}
              subtitle={t(meta.sub)}
              onPress={() => onOpen(r)}
            />
          );
        })}
        <MenuRow
          icon="repeat"
          title={t('reportStockMovement')}
          subtitle={t('reportStockMovementSub')}
          onPress={onOpenInventory}
        />
        <MenuRow
          icon="sliders"
          title={t('reportStockCorrection')}
          subtitle={t('reportStockCorrectionSub')}
          onPress={onOpenInventory}
          last
        />
      </MenuGroup>
    </View>
  );
}
