import { View } from 'react-native';
import { inr } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { Party } from '../../lib/types';
import { Text } from '../text';
import { Avatar, Icon, Muted, Pill, PressableCard } from '../ui';
import { PARTNER_META, type PartnerKind } from './types';

export function BusinessPartnerListItem({
  kind,
  partner,
  balance,
  financialsAvailable,
  onPress,
}: {
  kind: PartnerKind;
  partner: Party;
  balance: number | undefined;
  financialsAvailable: boolean;
  onPress: () => void;
}) {
  const t = useT();
  const meta = PARTNER_META[kind];
  const hasBalance = financialsAvailable && balance != null && balance > 0;
  const isSettled = financialsAvailable && (balance ?? 0) <= 0;

  const secondaryParts = [partner.phone, partner.gstNumber && `GST ${partner.gstNumber}`].filter(Boolean);

  return (
    <PressableCard label={partner.name} onPress={onPress}>
      <View className="flex-row items-center gap-3">
        <Avatar name={partner.name} />
        <View className="flex-1 gap-0.5">
          <Text className="text-[15px] font-semibold leading-5 text-foreground" numberOfLines={2}>
            {partner.name}
          </Text>
          {secondaryParts.length > 0 ? (
            <Muted lines={2}>{secondaryParts.join(' · ')}</Muted>
          ) : partner.address ? (
            <Muted lines={1}>{partner.address}</Muted>
          ) : null}
        </View>

        <View className="flex-row items-center gap-2">
          {hasBalance ? (
            <View className="items-end">
              <Text className="text-[15px] font-bold tabular-nums text-warning">{inr(balance!)}</Text>
              <Text className="text-[11px] font-medium text-muted-foreground">{t(meta.balanceLabel)}</Text>
            </View>
          ) : isSettled ? (
            <Pill tone="good" text={t('settled')} />
          ) : null}
          <Icon name="chevron-right" size={18} colorClassName="accent-muted-foreground" />
        </View>
      </View>
    </PressableCard>
  );
}
