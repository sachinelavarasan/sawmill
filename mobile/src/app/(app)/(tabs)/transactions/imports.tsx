import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ImportCard } from '../../../../components/cards';
import { ScreenHeader } from '../../../../components/header';
import { RecordList } from '../../../../components/RecordList';
import { Button } from '../../../../components/ui';
import { useT } from '../../../../lib/i18n';
import type { ImportSummary } from '../../../../lib/imports-api';

export default function ImportsScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('imports')} back right={<Button size="md" icon="plus" title={t('newImport')} onPress={() => router.push('/imports/new')} className="mr-2" />} />
      <RecordList<ImportSummary>
        path="/imports"
        search={t('searchImports')}
        statusFilter
        renderItem={(i) => <ImportCard item={i} />}
        empty={{ icon: 'download', title: t('noImports'), action: { label: t('newImport'), onPress: () => router.push('/imports/new') } }}
      />
    </View>
  );
}
