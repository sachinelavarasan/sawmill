import {
  ArrowDownToLineIcon,
  ArrowRightIcon,
  ArrowUpFromLineIcon,
  CalendarRangeIcon,
  ClockIcon,
  FactoryIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  HandshakeIcon,
  LayersIcon,
  type LucideIcon,
  PrinterIcon,
  ReceiptIndianRupeeIcon,
  TrendingUpIcon,
  TruckIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { api, download } from '../api';
import { dateTime, money2, num3, useLoad } from '../components/common';
import { FigureStrip, LoadState, Notice, OwnerOnly, Page, PageHeader, TableCard, useClientPaging } from '../components/page';
import { PeriodPicker, periodQuery, PeriodValue, presets } from '../components/period';
import { TKey, useI18n } from '../i18n';
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

/** How each report is shown in the catalogue: its icon and one line on what it holds. */
const REPORT_META: Record<string, { icon: LucideIcon; sub: TKey }> = {
  imports: { icon: ArrowDownToLineIcon, sub: 'reportImportsSub' },
  production: { icon: FactoryIcon, sub: 'reportProductionSub' },
  exports: { icon: ArrowUpFromLineIcon, sub: 'reportExportsSub' },
  stock: { icon: LayersIcon, sub: 'reportStockSub' },
  pnl: { icon: TrendingUpIcon, sub: 'reportPnlSub' },
  payables: { icon: TruckIcon, sub: 'reportPayablesSub' },
  receivables: { icon: HandshakeIcon, sub: 'reportReceivablesSub' },
  expenses: { icon: ReceiptIndianRupeeIcon, sub: 'reportExpensesSub' },
};

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

  const groups: ['operational' | 'financial', string][] = [
    ['operational', t('operationalReports')],
    ['financial', t('financialReports')],
  ];
  const shownGroups = groups.filter(([g]) => list.data?.some((r) => r.group === g));

  // ── the catalogue of reports ──
  if (!key) {
    return (
      <Page>
        <PageHeader title={t('reports')} subtitle={t('reportsSub')} />
        <LoadState loading={list.loading && !list.data} error={list.error} onRetry={list.reload} />
        {list.data &&
          shownGroups.map(([g, label]) => (
            <section key={g} className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-[1.0625rem] font-semibold tracking-tight">
                {label}
                {g === 'financial' && <OwnerOnly />}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {list
                  .data!.filter((r) => r.group === g)
                  .map((r) => {
                    const meta = REPORT_META[r.key];
                    const Icon = meta?.icon ?? FileTextIcon;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => update({ r: r.key })}
                        className="group flex h-full flex-col gap-3 rounded-xl bg-card p-4 text-left shadow-card transition-shadow duration-200 outline-none hover:shadow-lift focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <span className="flex items-center justify-between">
                          <span className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary">
                            <Icon className="size-[1.125rem]" strokeWidth={1.75} aria-hidden />
                          </span>
                          <ArrowRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
                        </span>
                        <span>
                          <span className="block leading-snug font-semibold">{r.title}</span>
                          {meta && <span className="mt-1 block text-sm text-pretty text-muted-foreground">{t(meta.sub)}</span>}
                        </span>
                        {/* what the report can be narrowed by */}
                        <span className="mt-auto flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
                            {r.periodic ? <CalendarRangeIcon className="size-3" aria-hidden /> : <ClockIcon className="size-3" aria-hidden />}
                            {r.periodic ? t('period') : t('currentStock')}
                          </span>
                          {r.statusFilter && <span className="rounded-md bg-muted px-1.5 py-0.5">{t('status')}</span>}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </section>
          ))}
      </Page>
    );
  }

  // ── one report ──
  const r = report.data;
  const info = r ?? list.data?.find((x) => x.key === key);
  // back to the catalogue, keeping the chosen period and status for the next report
  const rest = new URLSearchParams(params);
  rest.delete('r');
  const backTo = rest.size ? `/reports?${rest}` : '/reports';
  // the figures the report adds up, shown before the table
  const totalFigures = r ? r.columns.filter((c) => c.key in r.totals).map((c) => ({ label: c.label, value: format(c.type, r.totals[c.key]) })) : [];
  return (
    <Page>
      <div className="flex flex-col gap-4 print:hidden">
        <PageHeader
          title={info?.title ?? t('reports')}
          back={{ to: backTo, label: t('reports') }}
          badge={info?.group === 'financial' && <OwnerOnly />}
          subtitle={REPORT_META[key] && t(REPORT_META[key].sub)}
          actions={
            <>
              <Button variant="outline" onClick={() => window.print()} disabled={!r} title={t('pdfHint')}>
                <PrinterIcon /> {t('printSavePdf')}
              </Button>
              <Button onClick={excel} disabled={!r || downloading}>
                <FileSpreadsheetIcon /> {t('downloadExcelLong')}
              </Button>
            </>
          }
        />

        {/* which report, for what period, and which entries */}
        <Card className="gap-0 py-4">
          <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-3 px-4">
            {list.data && (
              <Select value={key} onValueChange={(v) => update({ r: v })}>
                <SelectTrigger className="w-full sm:w-60" aria-label={t('chooseReport')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shownGroups.map(([g, label]) => (
                    <SelectGroup key={g}>
                      <SelectLabel>{label}</SelectLabel>
                      {list
                        .data!.filter((x) => x.group === g)
                        .map((x) => (
                          <SelectItem key={x.key} value={x.key}>
                            {x.title}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
            {info?.statusFilter && (
              <ToggleGroup type="single" variant="outline" value={status} onValueChange={(v) => v && update({ status: v })} className="bg-card max-sm:w-full max-sm:[&>button]:h-auto max-sm:[&>button]:min-h-10 max-sm:[&>button]:flex-1 max-sm:[&>button]:py-1.5 max-sm:[&>button]:whitespace-normal">
                <ToggleGroupItem value="APPROVED" className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  {t('approvedOnly')}
                </ToggleGroupItem>
                <ToggleGroupItem value="ALL" className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  {t('allEntries')}
                </ToggleGroupItem>
              </ToggleGroup>
            )}
            {info?.periodic !== false && <PeriodPicker className="basis-full" value={period} onChange={(p) => update(p)} />}
          </CardContent>
        </Card>
        <p className="-mt-1 text-xs text-muted-foreground">{t('pdfHint')}</p>
        {error && <Notice tone="error">{error}</Notice>}
      </div>

      <LoadState loading={report.loading && !r} error={report.error} onRetry={report.reload} />

      {r && (
        <>
          {totalFigures.length > 0 && (
            <FigureStrip
              className={cn('print:hidden', totalFigures.length < 3 && 'lg:grid-cols-3')}
              items={[{ label: t('entries'), value: r.rows.length.toLocaleString('en-IN') }, ...totalFigures.slice(0, 3)]}
            />
          )}

          {/* the report as it prints: a letterhead, then the table */}
          <article className={cn('overflow-hidden rounded-xl bg-card shadow-card transition-opacity print:overflow-visible print:rounded-none print:shadow-none', report.loading && 'opacity-60')}>
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-border/70 px-5 py-5 print:border-b-2 print:border-foreground print:px-0 print:pt-0 print:pb-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{r.millName}</div>
                <h2 className="mt-1 text-xl leading-tight font-bold tracking-tight">{r.title}</h2>
              </div>
              <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-sm">
                {r.period && (
                  <>
                    <dt className="text-muted-foreground">{t('period')}</dt>
                    <dd className="text-right font-medium tabular-nums">
                      {dateOnly(r.period.from)} – {dateOnly(r.period.to)}
                    </dd>
                  </>
                )}
                {r.approvedOnly != null && (
                  <>
                    <dt className="text-muted-foreground">{t('status')}</dt>
                    <dd className="text-right font-medium">{t(r.approvedOnly ? 'approvedOnly' : 'allEntries')}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">{t('generatedOn')}</dt>
                <dd className="text-right font-medium tabular-nums">{dateTime(r.generatedAt)}</dd>
              </dl>
            </header>

            <TableCard empty={r.rows.length === 0} emptyText={t('noRows')} pager={paged.pager} className="rounded-none shadow-none print:border-0">
              <Table className="print:text-[10px]">
                <TableHeader>
                  <TableRow>
                    {r.columns.map((c, i) => (
                      <TableHead key={c.key} className={cn(NUMERIC.includes(c.type) && 'text-right', i === 0 && 'pl-5 print:pl-0', i === r.columns.length - 1 && 'pr-5 print:pr-0')}>
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
                      <TableRow key={ri} className={cn('print:break-inside-avoid', resultLine && 'bg-muted/60 text-base font-bold hover:bg-muted/60')}>
                        {r.columns.map((c, i) => (
                          <TableCell
                            key={c.key}
                            className={cn(
                              'py-2.5 print:py-1.5',
                              // on paper only long text (notes, names) may wrap; see the print rules in index.css
                              c.type === 'text' && String(row[c.key] ?? '').length > 18 && 'print-wrap',
                              NUMERIC.includes(c.type) && 'text-right tabular-nums',
                              (c.type === 'date' || c.type === 'datetime') && 'text-muted-foreground tabular-nums',
                              i === 0 && 'pl-5 font-medium print:pl-0',
                              i === r.columns.length - 1 && 'pr-5 print:pr-0',
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
                    <TableRow className="hover:bg-transparent">
                      {r.columns.map((c, i) => (
                        <TableCell key={c.key} className={cn('font-bold', NUMERIC.includes(c.type) && 'text-right tabular-nums', i === 0 && 'pl-5 print:pl-0', i === r.columns.length - 1 && 'pr-5 print:pr-0')}>
                          {i === 0 ? r.totalLabel : c.key in r.totals ? format(c.type, r.totals[c.key]) : ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </TableCard>
            <footer className="hidden justify-between pt-3 text-[10px] text-muted-foreground print:flex">
              <span>SAWMILL PRO · {r.millName}</span>
              <span className="tabular-nums">{dateTime(r.generatedAt)}</span>
            </footer>
          </article>
        </>
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
