/**
 * The load outs in lorry-only mode (lib/lorry-mode.ts): every lorry loaded, newest first, under
 * Today / Yesterday / date headings (with that day's lorries and CFT), one card
 * each — the plate, where it stands (draft, waiting for the owner, approved, sent back), the wood,
 * pieces and CFT. Tap one to open it; "Lorry Out" at the bottom loads the next one.
 *
 * A screen of its own (not the Loads out tab), so Back always returns to Home.
 */
import { totalCft } from '@timbertrail/shared';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ScreenHeader, StickyFooter } from '../../components/header';
import { RecordList } from '../../components/RecordList';
import { Text } from '../../components/text';
import { Button, Icon, Plate, Reason, StatusPill } from '../../components/ui';
import { int, num3 } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { ExportSummary } from '../../lib/types';

export default function LoadOutsScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader compact title={t('exports')} back />
      <RecordList<ExportSummary>
        compact
        path="/exports"
        search={t('searchRecords')}
        statusFilter
        // headings: Today, Yesterday, then the date — with that day's lorries and CFT
        groupByDay={(i) => i.exportDate}
        daySummary={(day) => `${day.length === 1 ? t('lorryOne') : t('lorriesCount', { n: day.length })} · ${num3(totalCft(day.map((x) => x.totalCft)))} CFT`}
        renderItem={(i) => <LoadOutCard item={i} />}
        empty={{ mod: 'out', icon: 'truck-out', title: t('noExports'), action: { label: t('lorryOut'), onPress: () => router.push('/lorry-out') } }}
      />
      <StickyFooter>
        <Button icon="truck-out" title={t('lorryOut')} onPress={() => router.push('/lorry-out')} />
      </StickyFooter>
    </View>
  );
}

function LoadOutCard({ item }: { item: ExportSummary }) {
  const t = useT();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/load-out/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${item.lorryNumber}, ${item.woodType}, ${int(item.totalPieces)} ${t('pieces')}, ${num3(item.totalCft)} CFT`}
      className="mb-3 gap-3 rounded-3xl bg-card p-4 shadow-sm shadow-black/5 active:opacity-90"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1.5">
          <Plate number={item.lorryNumber} size="md" />
          <Text className="text-[14px] font-medium text-muted-foreground" numberOfLines={1}>
            {item.woodType} · {item.code}
          </Text>
        </View>
        <StatusPill status={item.status} />
      </View>
      <View className="flex-row items-center gap-2.5">
        <Figure label={t('pieces')} value={int(item.totalPieces)} />
        <Figure label="CFT" value={num3(item.totalCft)} />
        <Icon name="chevron-right" size={20} colorClassName="accent-muted-foreground" />
      </View>
      {!!item.rejectionReason && <Reason>{item.rejectionReason}</Reason>}
    </Pressable>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-0.5 rounded-2xl bg-background px-3.5 py-2.5">
      <Text className="text-[12px] font-medium text-muted-foreground">{label}</Text>
      <Text className="text-[20px] font-bold tabular-nums text-foreground font-display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
    </View>
  );
}
