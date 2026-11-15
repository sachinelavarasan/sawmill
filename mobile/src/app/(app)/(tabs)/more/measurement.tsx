import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ImportCard } from '../../../../components/cards';
import { ScreenHeader } from '../../../../components/header';
import { RecordList } from '../../../../components/RecordList';
import { Muted } from '../../../../components/ui';
import { useT } from '../../../../lib/i18n';
import type { ImportSummary } from '../../../../lib/imports-api';

const OPEN = { open: '1' };

/** Loads still open for measuring (Draft or Rejected). Tap one to measure its logs. */
export default function MeasurementScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('measurement')} back />
      <RecordList<ImportSummary>
        path="/imports"
        params={OPEN}
        search={t('searchImports')}
        header={<Muted>{t('measurementSub')}</Muted>}
        renderItem={(i) => <ImportCard item={i} measure />}
        empty={{ icon: 'edit-3', title: t('noOpenLoads'), action: { label: t('newImport'), onPress: () => router.push('/imports/new') } }}
      />
    </View>
  );
}
