/**
 * One report, readable on a phone: totals on top, then each row as a card (first text
 * column as its title, the rest as label–value lines) instead of a squeezed table.
 * "Share Excel file" downloads the same report the web exports and opens Android's share sheet.
 */
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { ScreenHeader, HeaderButton } from '../../../../components/header';
import { PeriodPicker } from '../../../../components/sheet';
import { toast } from '../../../../components/toast';
import { Card, EmptyState, ErrorBox, KV, Muted, refresher, Segmented, SkeletonList } from '../../../../components/ui';
import { downloadToCache } from '../../../../lib/api';
import { dateOnly, dateTime, inr, int, num3, periodQuery, presets } from '../../../../lib/format';
import { useLang, useT } from '../../../../lib/i18n';
import { useApi } from '../../../../lib/query';
import type { ColType, ReportData } from '../../../../lib/types';

function fmt(v: string | number | null | undefined, type: ColType): string {
  if (v == null || v === '') return '—';
  switch (type) {
    case 'date':
      return dateOnly(String(v));
    case 'datetime':
      return dateTime(String(v));
    case 'int':
      return int(Number(v));
    case 'cft':
      return num3(Number(v));
    case 'money':
      return inr(Number(v));
    case 'percent':
      return `${Number(v)}%`;
    default:
      return String(v);
  }
}

export default function ReportScreen() {
  const { key, title } = useLocalSearchParams<{ key: string; title?: string }>();
  const t = useT();
  const { lang } = useLang();
  const [period, setPeriod] = useState(presets().thisMonth);
  const [status, setStatus] = useState<'APPROVED' | 'ALL'>('APPROVED');
  const [sharing, setSharing] = useState(false);
  const query = `${periodQuery(period)}&status=${status}&lang=${lang}`;
  const q = useApi<ReportData>(`/reports/${key}?${query}`);
  const r = q.data;

  async function share() {
    if (sharing) return;
    setSharing(true);
    try {
      const file = await downloadToCache(`/reports/${key}/xlsx?${query}`, `${key}-${r?.period ? `${r.period.from}_${r.period.to}` : 'current'}.xlsx`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: r?.title ?? title });
      }
    } catch (e) {
      toast((e as Error).message || t('somethingWrong'), 'error');
    } finally {
      setSharing(false);
    }
  }

  const cols = r?.columns ?? [];
  const titleCol = cols.find((c) => c.type === 'text') ?? cols[0];
  const rest = cols.filter((c) => c !== titleCol);
  const totals = cols.filter((c) => c.total && r?.totals[c.key] != null);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        back
        title={r?.title ?? title ?? t('reports')}
        subtitle={r ? `${r.millName}${r.period ? ` · ${dateOnly(r.period.from)} – ${dateOnly(r.period.to)}` : ''}` : undefined}
        right={<HeaderButton icon={sharing ? 'loader' : 'share-2'} label={t('shareExcel')} onPress={() => void share()} />}
      />
      <FlatList
        data={r?.rows ?? []}
        keyExtractor={(_, i) => String(i)}
        contentContainerClassName="gap-2.5 p-4 pb-6"
        refreshControl={refresher(q.isRefetching, () => void q.refetch())}
        initialNumToRender={12}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            {(r?.periodic ?? true) && <PeriodPicker value={period} onChange={setPeriod} />}
            {r?.statusFilter && (
              <Segmented
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'APPROVED', label: t('approvedOnly') },
                  { value: 'ALL', label: t('allEntries') },
                ]}
              />
            )}
            {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
            {q.isPending && <SkeletonList />}
            {r && totals.length > 0 && (
              <Card className="border-primary bg-primary">
                <Text className="text-xs font-bold uppercase tracking-wider text-primary-foreground opacity-85">{r.totalLabel || t('total')}</Text>
                {totals.map((c) => (
                  <View key={c.key} className="flex-row justify-between gap-3">
                    <Text className="text-sm text-primary-foreground opacity-85">{c.label}</Text>
                    <Text className="text-sm font-bold tabular-nums text-primary-foreground">{fmt(r.totals[c.key], c.type)}</Text>
                  </View>
                ))}
              </Card>
            )}
            {r && (
              <Muted>
                {t('rowsCount', { n: int(r.rows.length) })} · {t('generatedOn')} {dateTime(r.generatedAt)}
              </Muted>
            )}
          </View>
        }
        ListEmptyComponent={r ? <EmptyState icon="file-text" title={t('noRows')} /> : null}
        renderItem={({ item }) => (
          <Card>
            {titleCol && <Text className="text-[15px] font-bold text-foreground">{fmt(item[titleCol.key], titleCol.type)}</Text>}
            {rest.map((c) => (
              <KV key={c.key} label={c.label} value={fmt(item[c.key], c.type)} />
            ))}
          </Card>
        )}
      />
    </View>
  );
}
