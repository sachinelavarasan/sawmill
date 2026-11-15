/**
 * The two daily lists, as bottom-bar tabs: loads coming in (with measuring one tap away in the
 * header) and loads going out. Each has one big "new" button at the foot of the screen.
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ExportCard, ImportCard } from './cards';
import { HeaderButton, ScreenHeader, StickyFooter } from './header';
import { RecordList } from './RecordList';
import { Button } from './ui';
import { useT } from '../lib/i18n';
import type { ImportSummary } from '../lib/imports-api';
import type { ExportSummary } from '../lib/types';

export function ImportsList() {
  const t = useT();
  const router = useRouter();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('imports')} large right={<HeaderButton icon="edit-3" label={t('measure')} onPress={() => router.push('/more/measurement')} />} />
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

export function ExportsList() {
  const t = useT();
  const router = useRouter();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('exports')} large />
      <RecordList<ExportSummary>
        path="/exports"
        search={t('searchRecords')}
        statusFilter
        renderItem={(i) => <ExportCard item={i} />}
        empty={{ icon: 'upload', title: t('noExports'), action: { label: t('newExport'), onPress: () => router.push('/exports/new') } }}
      />
      <StickyFooter tabBar>
        <Button icon="plus" title={t('newExport')} onPress={() => router.push('/exports/new')} />
      </StickyFooter>
    </View>
  );
}
