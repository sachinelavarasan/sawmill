import { ChevronLeftIcon, FileSpreadsheetIcon, FileTextIcon, LandmarkIcon, PrinterIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { api, download } from '../api';
import { dateTime, money2, num3, useLoad } from '../components/common';
import { LoadState, Notice, OwnerOnly, Page, PageHeader, TableCard, useClientPaging } from '../components/page';
import { PeriodPicker, periodQuery, PeriodValue, presets } from '../components/period';
import { useI18n } from '../i18n';
import { dateOnly } from './Production';

type ColType = 'text' | 'date' | 'datetime' | 'int' | 'cft' | 'money' | 'percent';
interface ReportInfo {
  key: string;
  title: string;
  group: 'operational' | 'financial';
  periodic: boolean;
  statusFilter: boolean;
}
interface ReportData extends ReportInfo {
  millName: string;
  period: PeriodValue | null;
  approvedOnly: boolean | null;
  generatedAt: string;
  columns: { key: string; label: string; type: ColType; total: boolean }[];
  rows: Record<string, string | number | null>[];
  totals: Record<string, number>;
  totalLabel: string;
}

const NUMERIC: ColType[] = ['int', 'cft', 'money', 'percent'];
function format(type: ColType, v: string | number | null | undefined) {
  if (v == null || v === '') return '—';
  switch (type) {
    case 'date':
      return dateOnly(String(v));
    case 'datetime':
      return dateTime(String(v));
    case 'int':
      return Number(v).toLocaleString('en-IN');
    case 'cft':
      return num3(Number(v));
    case 'money':
      return money2(Number(v));
    case 'percent':
      return `${v}%`;
    default:
      return String(v);
  }
}

/**
 * Reports: pick one, set the period, view it, then download Excel or print / save as PDF
 * (the browser's PDF keeps Tamil text correct). Selection lives in the URL so a report can be bookmarked.
 */
export function ReportsPage() {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const key = params.get('r');
  const def = presets().thisMonth;
  const period: PeriodValue = { from: params.get('from') ?? def.from, to: params.get('to') ?? def.to };
  const status = params.get('status') === 'ALL' ? 'ALL' : 'APPROVED';

  const list = useLoad(() => api<ReportInfo[]>(`/reports?lang=${lang}`), [lang]);
  const query = `${periodQuery(period)}&status=${status}&lang=${lang}`;
  const report = useLoad(() => (key ? api<ReportData>(`/reports/${key}?${query}`) : Promise.resolve(null)), [key, query]);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The screen shows one page of rows; printing / Save as PDF always includes all of them.
  const printing = usePrinting();
  const paged = useClientPaging(report.data?.rows ?? [], 50);
  const { reset } = paged;
  useEffect(reset, [key, query, reset]);

  const update = (next: Partial<{ r: string | null; from: string; to: string; status: string }>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v == null) p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: !('r' in next) });
  };

  async function excel() {
    if (!key) return;
    setDownloading(true);
    setError(null);
    try {
      await download(`/reports/${key}/xlsx?${query}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  // ── the list of reports ──
  if (!key) {
    const groups: ['operational' | 'financial', string][] = [
      ['operational', t('operationalReports')],
      ['financial', t('financialReports')],
    ];
    return (
      <Page>
        <PageHeader title={t('reports')} />
        <LoadState loading={list.loading && !list.data} error={list.error} onRetry={list.reload} />
        {list.data &&
          groups
            .filter(([g]) => list.data!.some((r) => r.group === g))
            .map(([g, label]) => (
              <section key={g} className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  {label}
                  {g === 'financial' && <OwnerOnly />}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {list.data!
                    .filter((r) => r.group === g)
                    .map((r) => (
                      <button key={r.key} type="button" onClick={() => update({ r: r.key })} className="text-left">
                        <Card className="h-full gap-2 py-4 transition-colors hover:border-primary hover:bg-primary-soft/40">
                          <CardHeader className="flex flex-row items-center gap-2.5 px-4">
                            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                              {g === 'financial' ? <LandmarkIcon className="size-4" /> : <FileTextIcon className="size-4" />}
                            </span>
                            <CardTitle className="text-sm leading-snug">{r.title}</CardTitle>
                          </CardHeader>
                        </Card>
                      </button>
                    ))}
                </div>
              </section>
            ))}
      </Page>
    );
  }

  // ── one report ──
  const r = report.data;
  return (
    <Page>
      <div className="flex flex-col gap-3 print:hidden">
        <Button variant="ghost" size="sm" className="w-fit px-1 text-muted-foreground" onClick={() => update({ r: null })}>
          <ChevronLeftIcon /> {t('reports')}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {r?.periodic !== false && <PeriodPicker value={period} onChange={(p) => update(p)} />}
          {r?.statusFilter && (
            <ToggleGroup type="single" variant="outline" value={status} onValueChange={(v) => v && update({ status: v })} className="bg-card">
              <ToggleGroupItem value="APPROVED" className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {t('approvedOnly')}
              </ToggleGroupItem>
              <ToggleGroupItem value="ALL" className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {t('allEntries')}
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={excel} disabled={!r || downloading}>
              <FileSpreadsheetIcon /> {t('downloadExcel')}
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!r}>
              <PrinterIcon /> {t('printPdf')}
            </Button>
          </div>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </div>

      <LoadState loading={report.loading && !r} error={report.error} onRetry={report.reload} />

      {r && (
        <article className={cn('flex flex-col gap-4 transition-opacity', report.loading && 'opacity-60')}>
          <header className="flex flex-wrap items-end justify-between gap-2 border-b pb-3">
            <div>
              <div className="text-sm font-semibold text-muted-foreground">{r.millName}</div>
              <h1 className="text-2xl font-bold tracking-tight">{r.title}</h1>
            </div>
            <CardDescription className="text-right">
              {r.period && (
                <div>
                  {t('period')}: {dateOnly(r.period.from)} – {dateOnly(r.period.to)}
                </div>
              )}
              {r.approvedOnly != null && <div>{t(r.approvedOnly ? 'approvedOnly' : 'allEntries')}</div>}
              <div className="text-xs">
                {t('generatedOn')}: {dateTime(r.generatedAt)}
              </div>
            </CardDescription>
          </header>

          <TableCard empty={r.rows.length === 0} emptyText={t('noRows')} pager={paged.pager} className="print:rounded-none print:border-0 print:shadow-none">
            <Table className="print:text-[11px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {r.columns.map((c, i) => (
                    <TableHead key={c.key} className={cn(NUMERIC.includes(c.type) && 'text-right', i === 0 && 'pl-4', i === r.columns.length - 1 && 'pr-4')}>
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(printing ? r.rows : paged.rows).map((row, i) => {
                  const ri = printing ? i : paged.skip + i;
                  // P&L: the last row is the result line
                  const resultLine = r.key === 'pnl' && ri === r.rows.length - 1;
                  return (
                    <TableRow key={ri} className={cn(resultLine && 'bg-muted/60 font-bold')}>
                      {r.columns.map((c, i) => (
                        <TableCell
                          key={c.key}
                          className={cn(
                            NUMERIC.includes(c.type) && 'text-right tabular-nums',
                            i === 0 && 'pl-4 font-medium',
                            i === r.columns.length - 1 && 'pr-4',
                            c.type === 'money' && typeof row[c.key] === 'number' && (row[c.key] as number) < 0 && 'text-destructive',
                          )}
                        >
                          {format(c.type, row[c.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
              {Object.keys(r.totals).length > 0 && (
                <TableFooter>
                  <TableRow>
                    {r.columns.map((c, i) => (
                      <TableCell key={c.key} className={cn(NUMERIC.includes(c.type) && 'text-right tabular-nums', i === 0 && 'pl-4', i === r.columns.length - 1 && 'pr-4')}>
                        {i === 0 ? r.totalLabel : c.key in r.totals ? format(c.type, r.totals[c.key]) : ''}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </TableCard>
          <CardContent className="hidden px-0 text-xs text-muted-foreground print:block">SAWMILL PRO</CardContent>
        </article>
      )}
    </Page>
  );
}

/**
 * True while the browser prints. Set synchronously in "beforeprint" (flushSync), so the
 * print layout already contains every row — this covers the Print button and Ctrl+P alike.
 */
function usePrinting() {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  return printing;
}
