import { View } from 'react-native';
import { useT } from '../../lib/i18n';
import type { IconName } from '../icon';
import { Text } from '../text';
import { Avatar, Card, Divider, Icon, Pill } from '../ui';
import { PARTNER_META, type PartnerKind } from './types';

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="mt-0.5 h-7 w-7 items-center justify-center rounded-lg bg-card">
        <Icon name={icon} size={14} colorClassName="accent-muted-foreground" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[11px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">{label}</Text>
        <Text className="text-sm font-medium leading-5 text-foreground">{value}</Text>
      </View>
    </View>
  );
}

export function BusinessPartnerProfile({
  kind,
  name,
  phone,
  gstNumber,
  address,
  notes,
}: {
  kind: PartnerKind;
  name: string;
  phone: string | null;
  gstNumber: string | null;
  address: string | null;
  notes?: string | null;
}) {
  const t = useT();
  const meta = PARTNER_META[kind];
  const hasDetails = Boolean(phone || gstNumber || address || notes);

  return (
    <Card className="gap-3.5">
      <View className="flex-row items-center gap-3.5">
        <Avatar name={name} size="lg" tone="saffron" />
        <View className="flex-1 gap-1.5">
          <Text className="text-lg font-bold tracking-tight text-foreground font-display">{name}</Text>
          <Pill icon={meta.icon} text={t(meta.singular)} />
        </View>
      </View>

      {hasDetails && (
        <>
          <Divider />
          <View className="gap-3">
            {!!phone && <InfoRow icon="smartphone" label={t('mobile')} value={phone} />}
            {!!gstNumber && <InfoRow icon="receipt" label={t('gstNumber')} value={gstNumber} />}
            {!!address && <InfoRow icon="map-pin" label={t('secAddress')} value={address} />}
            {!!notes && <InfoRow icon="file-text" label={t('notes')} value={notes} />}
          </View>
        </>
      )}
    </Card>
  );
}
