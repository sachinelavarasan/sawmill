import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ProductionCard } from '../../../../components/cards';
import { ScreenHeader } from '../../../../components/header';
import { RecordList } from '../../../../components/RecordList';
import { Button } from '../../../../components/ui';
import { useT } from '../../../../lib/i18n';
import type { ProductionSummary } from '../../../../lib/types';

export default function ProductionScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('production')} back right={<Button size="md" icon="plus" title={t('newProduction')} onPress={() => router.push('/production/new')} className="mr-2" />} />
      <RecordList<ProductionSummary>
        path="/production"
        search={t('searchProduction')}
        statusFilter
        renderItem={(i) => <ProductionCard item={i} />}
        empty={{ icon: 'settings', title: t('noProduction'), action: { label: t('newProduction'), onPress: () => router.push('/production/new') } }}
      />
    </View>
  );
}
