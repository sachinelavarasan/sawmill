import { View } from 'react-native';
import { inr, int } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { HeroPanel } from '../header';
import { Text } from '../text';
import { HeroStats, Icon, Skeleton } from '../ui';
import { PARTNER_META, type PartnerKind } from './types';

export function BusinessPartnerSummary({
  kind,
  totalCount,
  outstandingCount,
  totalOutstanding,
  loading,
  financialsAvailable,
  financialsError,
}: {
  kind: PartnerKind;
  totalCount: number | undefined;
  outstandingCount: number | undefined;
  totalOutstanding: number | undefined;
  loading: boolean;
  financialsAvailable: boolean;
  financialsError?: boolean;
}) {
  const t = useT();
  const meta = PARTNER_META[kind];

  if (loading) {
    return (
      <HeroPanel>
        <Skeleton className="h-4 w-28 opacity-25" />
        <Skeleton className="h-9 w-40 opacity-25" />
        <View className="flex-row gap-4 border-t border-hero-border pt-4">
          <Skeleton className="h-8 flex-1 opacity-25" />
          <Skeleton className="h-8 flex-1 opacity-25" />
        </View>
      </HeroPanel>
    );
  }

  return (
    <HeroPanel>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-[13px] font-medium text-hero-muted">{t(meta.totalBalanceLabel)}</Text>
          <Text className="text-[30px] font-bold tracking-tight tabular-nums text-hero-foreground font-display" numberOfLines={1} adjustsFontSizeToFit>
            {financialsAvailable && totalOutstanding != null ? inr(totalOutstanding) : '—'}
          </Text>
          {financialsError && (
            <Text className="text-xs text-hero-muted">{t('financialUnavailable')}</Text>
          )}
        </View>
        <View className="h-11 w-11 items-center justify-center rounded-full bg-hero-chip">
          <Icon name={meta.icon} size={20} colorClassName="accent-hero-foreground" />
        </View>
      </View>

      <HeroStats
        items={[
          { label: t(meta.title), value: totalCount != null ? int(totalCount) : '—' },
          {
            label: t('withBalance'),
            value: financialsAvailable && outstandingCount != null ? int(outstandingCount) : '—',
            accent: financialsAvailable && (outstandingCount ?? 0) > 0,
          },
        ]}
      />
    </HeroPanel>
  );
}
