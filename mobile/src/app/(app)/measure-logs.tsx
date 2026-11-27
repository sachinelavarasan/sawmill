/**
 * Measure Logs in lorry-only mode (lib/lorry-mode.ts): the lorries still being unloaded or measured,
 * one big card each — the plate, the wood, logs and CFT so far — with the two jobs left to do:
 * Unloading (the load's page, with the unloading timer) and Measure now (the calculator).
 *
 * A screen of its own (not the one under More), so Back always returns to Home.
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ScreenHeader } from '../../components/header';
import { RecordList } from '../../components/RecordList';
import { Text } from '../../components/text';
import { Button, Muted, Plate, Reason } from '../../components/ui';
import { int, num3 } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { ImportSummary } from '../../lib/imports-api';

const OPEN = { open: '1' };

export default function MeasureLogsScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader compact title={t('simpleMeasure')} back />
      <RecordList<ImportSummary>
        compact
        path="/imports"
        params={OPEN}
        search={t('searchImports')}
        header={<Muted>{t('measurementSub')}</Muted>}
        // headings by the day the lorry arrived: Today, Yesterday, then the date
        groupByDay={(i) => i.arrivalAt}
        daySummary={(day) => `${day.length === 1 ? t('lorryOne') : t('lorriesCount', { n: day.length })} · ${num3(day.reduce((a, x) => a + x.totalCft, 0))} CFT`}
        renderItem={(i) => <LorryCard item={i} />}
        empty={{ mod: 'logs', icon: 'ruler', title: t('noOpenLoads'), action: { label: t('lorryIn'), onPress: () => router.push('/lorry-in') } }}
      />
    </View>
  );
}

function LorryCard({ item }: { item: ImportSummary }) {
  const t = useT();
  const router = useRouter();
  return (
    <View className="mb-3 gap-3 rounded-3xl bg-card p-4 shadow-sm shadow-black/5">
      <View className="gap-1.5">
        <Plate number={item.lorryNumber} size="md" />
        <Text className="text-[14px] font-medium text-muted-foreground" numberOfLines={1}>
          {item.woodType} · {item.code}
        </Text>
      </View>
      <View className="flex-row gap-2.5">
        <Figure label={t('logs')} value={int(item.totalLogs)} />
        <Figure label="CFT" value={num3(item.totalCft)} />
      </View>
      {!!item.rejectionReason && <Reason>{item.rejectionReason}</Reason>}
      <View className="flex-row gap-2.5">
        <Button className="flex-1" size="md" kind="secondary" icon="truck" title={t('unloading')} onPress={() => router.push(`/imports/${item.id}`)} />
        <Button className="flex-[1.3]" size="md" icon="ruler" title={t('measureNow')} onPress={() => router.push(`/imports/${item.id}/measure`)} />
      </View>
    </View>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-0.5 rounded-2xl bg-background px-3.5 py-2.5">
      <Text className="text-[12px] font-medium text-muted-foreground">{label}</Text>
      <Text className="text-[20px] font-bold tabular-nums text-foreground font-display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
    </View>
  );
}
