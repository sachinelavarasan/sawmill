import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { dateOnly, inr, num3 } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { PartyStatement } from '../../lib/types';
import { modeKey } from '../Payments';
import { Text } from '../text';
import { cn, EmptyState, IconTile, MenuGroup, Muted, SectionTitle } from '../ui';
import { PARTNER_META, type PartnerKind } from './types';

export function BusinessPartnerTransactionHistory({
  kind,
  entries,
}: {
  kind: PartnerKind;
  entries: PartyStatement['entries'];
}) {
  const t = useT();
  const router = useRouter();
  const meta = PARTNER_META[kind];

  return (
    <View className="gap-2">
      <SectionTitle>{t(meta.historyTitle)}</SectionTitle>
      <Muted>{t('statementSub')}</Muted>

      {entries.length === 0 ? (
        <EmptyState icon="file-text" title={t('noStatement')} />
      ) : (
        <MenuGroup>
          {entries.map((e, i) => {
            const bill = e.type === 'BILL';
            const detailLine = [
              dateOnly(e.date),
              bill && e.cft != null ? `${num3(e.cft)} CFT` : e.reference,
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <Pressable
                key={`${e.type}-${e.loadId}-${i}`}
                onPress={() => router.push(`/${meta.routePrefix}/${e.loadId}`)}
                accessibilityRole="button"
                className={cn(
                  'min-h-[68px] flex-row items-center gap-3 px-4 py-3 active:bg-secondary',
                  i < entries.length - 1 && 'border-b border-border',
                )}
              >
                <IconTile
                  icon={bill ? meta.icon : 'check-circle'}
                  tone={bill ? 'saffron' : 'good'}
                  size="sm"
                />
                <View className="flex-1 gap-0.5">
                  <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
                    {bill ? t(meta.billLabel) : `${t('paymentEntry')} · ${t(modeKey(e.mode!))}`} ·{' '}
                    <Text className="text-[15px] font-semibold text-primary">{e.loadCode}</Text>
                  </Text>
                  <Muted lines={1}>{detailLine}</Muted>
                </View>
                <View className="items-end gap-0.5">
                  <Text className={cn('text-[15px] font-bold tabular-nums', bill ? 'text-foreground' : 'text-success')}>
                    {bill ? '+' : '−'}
                    {inr(e.amount)}
                  </Text>
                  <Text className="text-[11px] tabular-nums text-muted-foreground">
                    {t('balance')} {inr(e.balance)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </MenuGroup>
      )}
    </View>
  );
}
