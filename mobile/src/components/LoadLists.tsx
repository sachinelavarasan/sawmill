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
import { num3 } from '../lib/format';
import { useT } from '../lib/i18n';
import { useSimple } from '../lib/session';
import type { ImportSummary } from '../lib/imports-api';
import type { ExportSummary } from '../lib/types';

export function ImportsList() {
  const t = useT();
  const simple = useSimple();
  const router = useRouter();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={simple ? t('simpleLoadIn') : t('imports')} large right={<HeaderButton icon="edit-3" label={t('measure')} onPress={() => router.push('/more/measurement')} />} />
      <RecordList<ImportSummary>
        path="/imports"
        search={t('searchImports')}
        statusFilter
        // headings by arrival day: Today, Yesterday, then the date
        groupByDay={(i) => i.arrivalAt}
        daySummary={(day) => `${day.length === 1 ? t('lorryOne') : t('lorriesCount', { n: day.length })} · ${num3(day.reduce((a, x) => a + x.totalCft, 0))} CFT`}
        renderItem={(i) => <ImportCard item={i} />}
        empty={{ mod: 'in', icon: 'truck', title: t('noImports'), action: { label: t('newImport'), onPress: () => router.push('/imports/new') } }}
      />
      <StickyFooter tabBar>
        <Button icon="plus" title={t('newImport')} onPress={() => router.push('/imports/new')} />
      </StickyFooter>
    </View>
  );
}

export function ExportsList() {
  const t = useT();
  const simple = useSimple();
  const router = useRouter();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={simple ? t('simpleLoadOut') : t('exports')} large />
      <RecordList<ExportSummary>
        path="/exports"
        search={t('searchRecords')}
        statusFilter
        // headings by load-out day
        groupByDay={(i) => i.exportDate}
        daySummary={(day) => `${day.length === 1 ? t('lorryOne') : t('lorriesCount', { n: day.length })} · ${num3(day.reduce((a, x) => a + x.totalCft, 0))} CFT`}
        renderItem={(i) => <ExportCard item={i} />}
        empty={{ mod: 'out', icon: 'truck-out', title: t('noExports'), action: { label: t('newExport'), onPress: () => router.push('/exports/new') } }}
      />
      <StickyFooter tabBar>
        <Button icon="plus" title={t('newExport')} onPress={() => router.push('/exports/new')} />
      </StickyFooter>
    </View>
  );
}
