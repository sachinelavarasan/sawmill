/**
 * Report detail screen: consistent header, period selector, summary metrics,
 * search + status filter, structured row cards, and Excel share export.
 */
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { SheetList, StickyFooter } from '../../../../components/header';
import { ReportDetailHeader } from '../../../../components/reports/ReportDetailHeader';
import { ReportPeriodSelector } from '../../../../components/reports/ReportPeriodSelector';
import { Text } from '../../../../components/text';
import { toast } from '../../../../components/toast';
import { Button, EmptyState, ErrorBox, HeroStats, KV, Muted, refresher, SearchBar, Segmented, SkeletonList } from '../../../../components/ui';
import { downloadToCache } from '../../../../lib/api';
import { dateOnly, dateTime, inr, int, num3, type Period, periodQuery, presets } from '../../../../lib/format';
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
  const { key, title, from, to } = useLocalSearchParams<{ key: string; title?: string; from?: string; to?: string }>();
  const t = useT();
  const { lang } = useLang();
  const [period, setPeriod] = useState<Period>(() =>
    from && to ? { from, to } : presets().thisMonth,
  );
  const [status, setStatus] = useState<'APPROVED' | 'ALL'>('APPROVED');
  const [search, setSearch] = useState('');
  const [sharing, setSharing] = useState(false);

  const query = `${periodQuery(period)}&status=${status}&lang=${lang}`;
  const q = useApi<ReportData>(`/reports/${key}?${query}`);
  const r = q.data;

  async function share() {
    if (sharing) return;
    setSharing(true);
    try {
      const file = await downloadToCache(
        `/reports/${key}/xlsx?${query}`,
        `${key}-${r?.period ? `${r.period.from}_${r.period.to}` : 'current'}.xlsx`,
      );
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: r?.title ?? title,
        });
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

  const rows = useMemo(() => {
    const all = r?.rows ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((row) =>
      Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(needle)),
    );
  }, [r?.rows, search]);

  return (
    <View className="flex-1 bg-background">
      <ReportDetailHeader
        title={r?.title ?? title ?? t('reports')}
        millName={r?.millName}
        period={r?.period}
        sharing={sharing}
        onShare={() => void share()}
      />
      <SheetList
        compact
        data={rows}
        keyExtractor={(_, i) => String(i)}
        refreshControl={refresher(q.isRefetching, () => void q.refetch())}
        initialNumToRender={12}
        hero={
          r && totals.length > 0 ? (
            <View className="gap-3">
              <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-hero-muted">
                {r.totalLabel || t('total')}
              </Text>
              <Text
                className="text-[34px] font-bold tracking-tight tabular-nums text-hero-foreground font-display"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {fmt(r.totals[totals[0].key], totals[0].type)}
              </Text>
              <Text className="-mt-2 text-[13px] text-hero-muted">{totals[0].label}</Text>
              {totals.length > 1 && (
                <HeroStats
                  wrap
                  items={totals.slice(1).map((c) => ({ label: c.label, value: fmt(r.totals[c.key], c.type) }))}
                />
              )}
            </View>
          ) : undefined
        }
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            {(r?.periodic ?? true) && <ReportPeriodSelector value={period} onChange={setPeriod} />}
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
            {(r?.rows.length ?? 0) > 0 && (
              <SearchBar value={search} onChange={setSearch} placeholder={t('search')} />
            )}
            {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
            {q.isPending && <SkeletonList />}
            {r && (
              <Muted>
                {t('rowsCount', { n: int(rows.length) })} · {t('generatedOn')} {dateTime(r.generatedAt)}
              </Muted>
            )}
          </View>
        }
        ListEmptyComponent={r ? <EmptyState icon="file-text" title={search ? t('noResults') : t('noRows')} /> : null}
        renderItem={({ item }) => (
          <View className="mb-2.5 gap-1.5 rounded-2xl bg-background p-4">
            {titleCol && (
              <Text className="pb-0.5 text-[15px] font-semibold text-foreground">
                {fmt(item[titleCol.key], titleCol.type)}
              </Text>
            )}
            {rest.map((c) => (
              <KV key={c.key} label={c.label} value={fmt(item[c.key], c.type)} />
            ))}
          </View>
        )}
      />
      {!!r && (
        <StickyFooter tabBar>
          <Button icon="file-spreadsheet" title={t('shareExcel')} busy={sharing} onPress={() => void share()} />
        </StickyFooter>
      )}
    </View>
  );
}
