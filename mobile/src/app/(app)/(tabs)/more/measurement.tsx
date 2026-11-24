import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ImportCard } from '../../../../components/cards';
import { ScreenHeader } from '../../../../components/header';
import { RecordList } from '../../../../components/RecordList';
import { Text } from '../../../../components/text';
import { Button, Muted, Reason } from '../../../../components/ui';
import { int, num3 } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import type { ImportSummary } from '../../../../lib/imports-api';
import { useSimple } from '../../../../lib/session';

const OPEN = { open: '1' };

/**
 * Loads still open for measuring (Draft or Rejected). Tap one to measure its logs; back returns
 * here, so measuring started from this list stays in Measure Logs.
 * Simple view: one big card per lorry (lorry number, wood, logs and CFT so far, "Measure now").
 */
export default function MeasurementScreen() {
  const t = useT();
  const router = useRouter();
  const simple = useSimple();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader compact title={simple ? t('simpleMeasure') : t('measurement')} back />
      <RecordList<ImportSummary> compact
        path="/imports"
        params={OPEN}
        search={t('searchImports')}
        header={<Muted>{t('measurementSub')}</Muted>}
        renderItem={(i) => (simple ? <MeasureCard item={i} /> : <ImportCard item={i} measure />)}
        empty={{ mod: 'logs', icon: 'ruler', title: t('noOpenLoads'), action: { label: t('newImport'), onPress: () => router.push('/imports/new') } }}
      />
    </View>
  );
}

/** One open lorry, big and plain: what it is, how far measuring has got, and the one thing to do. */
function MeasureCard({ item }: { item: ImportSummary }) {
  const t = useT();
  const router = useRouter();
  const open = () => router.push(`/imports/${item.id}/measure`);
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${item.lorryNumber}, ${item.woodType}, ${int(item.totalLogs)} ${t('logs')}, ${num3(item.totalCft)} CFT. ${t('measureNow')}`}
      className="gap-3.5 rounded-3xl border border-border bg-card p-4 active:opacity-90"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="text-[24px] font-bold tracking-tight text-foreground font-display" numberOfLines={1}>
            {item.lorryNumber}
          </Text>
          <Text className="text-[15px] font-medium text-muted-foreground" numberOfLines={1}>
            {item.woodType} · {item.code}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2.5">
        <Figure label={t('logs')} value={int(item.totalLogs)} />
        <Figure label="CFT" value={num3(item.totalCft)} />
      </View>
      {!!item.rejectionReason && <Reason>{item.rejectionReason}</Reason>}
      <Button icon="ruler" title={t('measureNow')} onPress={open} />
    </Pressable>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-0.5 rounded-2xl bg-background px-3.5 py-2.5">
      <Text className="text-[13px] font-medium text-muted-foreground">{label}</Text>
      <Text className="text-[24px] font-bold tabular-nums text-foreground font-display">{value}</Text>
    </View>
  );
}
