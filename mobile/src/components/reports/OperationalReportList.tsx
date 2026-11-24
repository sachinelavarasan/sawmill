import type { TKey } from '@timbertrail/shared';
import { View } from 'react-native';
import { useT } from '../../lib/i18n';
import type { ReportInfo } from '../../lib/types';
import { type IconName, MenuGroup, MenuRow, type Mod, SectionTitle } from '../ui';

const OP_META: Record<string, { sub: TKey; icon: IconName; mod: Mod }> = {
  imports: { sub: 'reportImportsSub', icon: 'truck', mod: 'in' },
  production: { sub: 'reportProductionSub', icon: 'factory', mod: 'cut' },
  yieldWood: { sub: 'reportYieldWoodSub', icon: 'pie-chart', mod: 'logs' },
  exports: { sub: 'reportExportsSub', icon: 'truck-out', mod: 'out' },
  stock: { sub: 'reportStockSub', icon: 'boxes', mod: 'stock' },
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
          const meta = OP_META[r.key] ?? { sub: 'reportStockSub' as TKey, icon: 'file-text' as IconName, mod: 'neutral' as Mod };
          return (
            <MenuRow
              key={r.key}
              mod={meta.mod}
              icon={meta.icon}
              title={r.title}
              subtitle={t(meta.sub)}
              onPress={() => onOpen(r)}
            />
          );
        })}
        <MenuRow
          mod="stock"
          icon="repeat"
          title={t('reportStockMovement')}
          subtitle={t('reportStockMovementSub')}
          onPress={onOpenInventory}
        />
        <MenuRow
          mod="stock"
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
