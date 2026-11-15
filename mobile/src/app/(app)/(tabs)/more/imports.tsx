import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ImportCard } from '../../../../components/cards';
import { HeaderButton, ScreenHeader, StickyFooter } from '../../../../components/header';
import { RecordList } from '../../../../components/RecordList';
import { Button } from '../../../../components/ui';
import { useT } from '../../../../lib/i18n';
import type { ImportSummary } from '../../../../lib/imports-api';

export default function ImportsScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('imports')} back right={<HeaderButton icon="plus" label={t('newImport')} onPress={() => router.push('/imports/new')} />} />
      <RecordList<ImportSummary>
        path="/imports"
        search={t('searchImports')}
        statusFilter
        renderItem={(i) => <ImportCard item={i} />}
        empty={{ icon: 'download', title: t('noImports'), action: { label: t('newImport'), onPress: () => router.push('/imports/new') } }}
      />
      <StickyFooter tabBar>
        <Button icon="plus" title={t('newImport')} onPress={() => router.push('/imports/new')} />
      </StickyFooter>
    </View>
  );
}
