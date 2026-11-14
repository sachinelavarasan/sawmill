import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ExportCard } from '../../../../components/cards';
import { ScreenHeader } from '../../../../components/header';
import { RecordList } from '../../../../components/RecordList';
import { Button } from '../../../../components/ui';
import { useT } from '../../../../lib/i18n';
import type { ExportSummary } from '../../../../lib/types';

export default function ExportsScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('exports')} back right={<Button size="md" icon="plus" title={t('newExport')} onPress={() => router.push('/exports/new')} className="mr-2" />} />
      <RecordList<ExportSummary>
        path="/exports"
        search={t('searchRecords')}
        statusFilter
        renderItem={(i) => <ExportCard item={i} />}
        empty={{ icon: 'upload', title: t('noExports'), action: { label: t('newExport'), onPress: () => router.push('/exports/new') } }}
      />
    </View>
  );
}
