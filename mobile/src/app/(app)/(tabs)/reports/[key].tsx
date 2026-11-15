/**
 * One report, readable on a phone: totals on top, then each row as a card (first text
 * column as its title, the rest as label–value lines) instead of a squeezed table.
 * "Share Excel file" downloads the same report the web exports and opens Android's share sheet.
 */
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { View } from 'react-native';
import { HeaderButton, ScreenHeader, SheetList, StickyFooter } from '../../../../components/header';
import { PeriodPicker } from '../../../../components/sheet';
import { Text } from '../../../../components/text';
import { toast } from '../../../../components/toast';
import { Button, EmptyState, ErrorBox, KV, Muted, refresher, Segmented, SkeletonList } from '../../../../components/ui';
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
      <SheetList
        data={r?.rows ?? []}
        keyExtractor={(_, i) => String(i)}
        refreshControl={refresher(q.isRefetching, () => void q.refetch())}
        initialNumToRender={12}
        hero={
          r && totals.length > 0 ? (
            <View className="gap-3">
              <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-hero-muted">{r.totalLabel || t('total')}</Text>
              <Text className="text-[34px] font-bold tracking-tight tabular-nums text-hero-foreground" numberOfLines={1} adjustsFontSizeToFit>
                {fmt(r.totals[totals[0].key], totals[0].type)}
              </Text>
              <Text className="-mt-2 text-[13px] text-hero-muted">{totals[0].label}</Text>
              {totals.length > 1 && (
                <View className="flex-row flex-wrap gap-x-6 gap-y-3 border-t border-hero-border pt-4">
                  {totals.slice(1).map((c) => (
                    <View key={c.key} className="gap-0.5">
                      <Text className="text-[11px] text-hero-muted">{c.label}</Text>
                      <Text className="text-[15px] font-semibold tabular-nums text-hero-foreground">{fmt(r.totals[c.key], c.type)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : undefined
        }
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
            {r && (
              <Muted>
                {t('rowsCount', { n: int(r.rows.length) })} · {t('generatedOn')} {dateTime(r.generatedAt)}
              </Muted>
            )}
          </View>
        }
        ListEmptyComponent={r ? <EmptyState icon="file-text" title={t('noRows')} /> : null}
        renderItem={({ item }) => (
          <View className="-mx-4 gap-1.5 border-b border-border px-4 py-4">
            {titleCol && <Text className="pb-0.5 text-[15px] font-semibold text-foreground">{fmt(item[titleCol.key], titleCol.type)}</Text>}
            {rest.map((c) => (
              <KV key={c.key} label={c.label} value={fmt(item[c.key], c.type)} />
            ))}
          </View>
        )}
      />
      {!!r && (
        <StickyFooter tabBar>
          <Button kind="navy" icon="file-spreadsheet" title={t('shareExcel')} busy={sharing} onPress={() => void share()} />
        </StickyFooter>
      )}
    </View>
  );
}
