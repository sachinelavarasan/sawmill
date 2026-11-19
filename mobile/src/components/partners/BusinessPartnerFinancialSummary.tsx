import { View } from 'react-native';
import { inr } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { Text } from '../text';
import { Card, cn, StatPair } from '../ui';
import { PARTNER_META, type PartnerKind } from './types';

export function BusinessPartnerFinancialSummary({
  kind,
  billed,
  paid,
  balance,
}: {
  kind: PartnerKind;
  billed: number;
  paid: number;
  balance: number;
}) {
  const t = useT();
  const meta = PARTNER_META[kind];
  const hasBalance = balance > 0;

  return (
    <View className="gap-3">
      <StatPair
        a={{ label: t('billed'), value: inr(billed) }}
        b={{ label: t(meta.paidLabel), value: inr(paid) }}
      />
      <Card className="flex-row items-center justify-between py-3.5">
        <Text className="text-sm font-semibold text-muted-foreground">{t(meta.outstandingLabel)}</Text>
        <Text className={cn('text-lg font-bold tabular-nums font-display', hasBalance ? 'text-warning' : 'text-success')}>
          {inr(balance)}
        </Text>
      </Card>
    </View>
  );
}
