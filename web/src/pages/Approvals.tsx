import { sizeLabel } from '@sawmill/shared';
import { ArrowDownToLineIcon, ArrowUpFromLineIcon, CheckCheckIcon, ClockIcon, EyeIcon, FactoryIcon, LayersIcon, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { dateTime, num3, useApi } from '../components/common';
import { type Column, DataTable } from '../components/data-table';
import { LoadState, Notice, Page, PageHeader, Section } from '../components/page';
import { Box, Boxes, QuickPanel, Tag } from '../components/quick-panel';
import { ReviewActions } from '../components/review';
import { StatusBadge } from '../components/status-badge';
import { useToast } from '../components/toast';
import { Lang, TKey, useI18n } from '../i18n';

export type Kind = 'IMPORT' | 'PRODUCTION' | 'EXPORT' | 'ADJUSTMENT';
interface Base {
  id: string;
  code: string;
  submittedAt: string;
  createdByName: string;
  woodType: string;
}
export type ApprovalItem =
  | (Base & { type: 'IMPORT'; lorryNumber: string; totalLogs: number; totalCft: number })
  | (Base & { type: 'PRODUCTION'; importCode: string; inputCft: number | null; outputCft: number; wasteCft: number | null })
  | (Base & { type: 'EXPORT'; lorryNumber: string; totalPieces: number; totalCft: number })
  | (Base & {
      type: 'ADJUSTMENT';
      kind: 'RAW' | 'FINISHED';
      importCode: string;
      thicknessIn: number | null;
      widthIn: number | null;
      lengthFt: number | null;
      piecesDelta: number;
      cftDelta: number;
      reason: string;
    });
export interface ApprovalQueue {
  counts: Record<Kind, number> & { total: number };
  items: ApprovalItem[];
}

type Item = ApprovalItem;
type Queue = ApprovalQueue;

export const KINDS: [Kind, TKey][] = [
  ['IMPORT', 'imports'],
  ['PRODUCTION', 'production'],
  ['EXPORT', 'exports'],
  ['ADJUSTMENT', 'adjustments'],
];
/** where the record opens, and its API path for approve/reject */
export const PAGE_PATH: Record<Kind, (id: string) => string> = {
  IMPORT: (id) => `/imports/${id}`,
  PRODUCTION: (id) => `/production/${id}`,
  EXPORT: (id) => `/exports/${id}`,
  ADJUSTMENT: () => '/stock?tab=adjustments',
};
const API_PATH: Record<Kind, (id: string) => string> = {
  IMPORT: (id) => `/imports/${id}`,
  PRODUCTION: (id) => `/production/${id}`,
  EXPORT: (id) => `/exports/${id}`,
  ADJUSTMENT: (id) => `/stock-adjustments/${id}`,
};
const signed = (n: number, fmt: (n: number) => string = String) => (n > 0 ? `+${fmt(n)}` : fmt(n));

const KIND_ICON: Record<Kind, LucideIcon> = { IMPORT: ArrowDownToLineIcon, PRODUCTION: FactoryIcon, EXPORT: ArrowUpFromLineIcon, ADJUSTMENT: LayersIcon };
const itemKey = (i: ApprovalItem) => `${i.type}-${i.id}`;

/** "2 days ago", in the chosen language: how long a record has been waiting. */
function ago(iso: string, lang: Lang) {
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  if (Math.abs(minutes) < 60 * 24) return rtf.format(Math.round(minutes / 60), 'hour');
  return rtf.format(Math.round(minutes / (60 * 24)), 'day');
}

/** The owner's queue: everything submitted, oldest first, approved or rejected from one place. */
export function ApprovalsPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [filter, setFilter] = useState<'ALL' | Kind>('ALL');
  const [error, setError] = useState<string | null>(null);
  /** the record open in the side panel */
  const [peekKey, setPeekKey] = useState<string | null>(null);
  /** what was approved or rejected since the page opened, newest first */
  const [reviewed, setReviewed] = useState<{ item: Item; outcome: 'approved' | 'rejected' }[]>([]);
  const { data, loading, error: loadError, reload } = useApi<Queue>('/approvals');
  const items = useMemo(() => data?.items.filter((i) => filter === 'ALL' || i.type === filter) ?? [], [data, filter]);
  // found in the live queue, so the panel closes by itself once its record is decided
  const peek = data?.items.find((i) => itemKey(i) === peekKey) ?? null;
  const PeekIcon = peek && KIND_ICON[peek.type];

  /** What the row is, in a few words — and what approving it will do. */
  const describe = (i: Item): { what: string; figures: string; confirm: string } => {
    switch (i.type) {
      case 'IMPORT':
        return {
          what: `${t('lorry')} ${i.lorryNumber} · ${i.woodType}`,
          figures: `${i.totalLogs} ${t('logs').toLowerCase()} · ${num3(i.totalCft)} CFT`,
          confirm: t('confirmApprove', { code: i.code, cft: num3(i.totalCft) }),
        };
      case 'PRODUCTION':
        return {
          what: `${i.importCode} · ${i.woodType}`,
          figures: `${num3(i.inputCft ?? 0)} → ${num3(i.outputCft)} CFT`,
          confirm: t('confirmApproveProduction', { code: i.code, input: num3(i.inputCft ?? 0), output: num3(i.outputCft) }),
        };
      case 'EXPORT':
        return {
          what: `${t('lorry')} ${i.lorryNumber} · ${i.woodType}`,
          figures: `${t('piecesCount', { n: i.totalPieces })} · ${num3(i.totalCft)} CFT`,
          confirm: t('confirmApproveExport', { code: i.code, pieces: i.totalPieces, cft: num3(i.totalCft) }),
        };
      case 'ADJUSTMENT': {
        const size = i.thicknessIn != null && i.widthIn != null && i.lengthFt != null ? ` · ${sizeLabel(i.thicknessIn, i.widthIn, i.lengthFt)}` : '';
        const change = i.kind === 'FINISHED' ? `${signed(i.piecesDelta)} ${t('pieces')} (${signed(i.cftDelta, num3)} CFT)` : `${signed(i.cftDelta, num3)} CFT`;
        return {
          what: `${t(i.kind === 'RAW' ? 'raw' : 'finished')} · ${i.woodType} · ${i.importCode}${size} — ${i.reason}`,
          figures: change,
          confirm: t('confirmApproveAdjustment', { code: i.code, change }),
        };
      }
    }
  };

  const kindLabel = (k: Kind) => t(KINDS.find(([key]) => key === k)![1]);

  /** Approve / Reject for one record: the same buttons in the row and in the panel. */
  const review = (i: Item, size: 'sm' | 'default', inRow?: boolean) => (
    <ReviewActions
      base={API_PATH[i.type](i.id)}
      code={i.code}
      confirmApprove={describe(i).confirm}
      onDone={(outcome) => {
        setReviewed((list) => [{ item: i, outcome }, ...list]);
        toast(t(outcome === 'approved' ? 'approvedToast' : 'rejectedToast', { code: i.code }), outcome === 'approved' ? 'ok' : 'info');
        reload();
      }}
      onError={setError}
      size={size}
      compact={inRow}
      iconReject={inRow}
    />
  );

  const columns: Column<Item>[] = [
    {
      id: 'record',
      header: t('record'),
      sort: (i) => Date.parse(i.submittedAt),
      cell: (i) => {
        const d = describe(i);
        const Icon = KIND_ICON[i.type];
        return (
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary max-sm:hidden" aria-hidden>
              <Icon className="size-[1.125rem]" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <Link className="font-semibold text-primary hover:underline" to={PAGE_PATH[i.type](i.id)}>
                {i.code}
              </Link>
              <div className="max-w-48 truncate text-xs text-muted-foreground max-md:hidden xl:max-w-56" title={d.what}>
                <span className="font-medium text-foreground">{kindLabel(i.type)}</span> · {d.what}
              </div>
              {/* on phones the other columns fold in here */}
              <div className="mt-0.5 max-w-[16rem] text-xs whitespace-normal text-muted-foreground md:hidden">
                <span className="font-medium text-foreground">{kindLabel(i.type)}</span> · {d.what}
                <div className="font-semibold text-foreground tabular-nums">{d.figures}</div>
                <div>
                  {i.createdByName} · {ago(i.submittedAt, lang)}
                </div>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      // who sent it and when, in one column: the name, then the date and how long it has waited
      id: 'by',
      header: t('submittedBy'),
      from: 'md',
      sort: (i) => i.createdByName.toLowerCase(),
      cell: (i) => (
        <div className="flex items-center gap-2.5">
          <Avatar size="sm">
            <AvatarFallback className="bg-muted text-xs font-semibold">{i.createdByName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="max-w-40 truncate font-medium">{i.createdByName}</div>
            <div className="text-xs text-muted-foreground">
              {dateTime(i.submittedAt)} · {ago(i.submittedAt, lang)}
            </div>
          </div>
        </div>
      ),
    },
    { id: 'cft', header: 'CFT', from: 'lg', numeric: true, className: 'font-semibold', cell: (i) => describe(i).figures },
    // every row here is pending, so the status pill is the first thing to go when the table is short of room
    { id: 'status', header: t('status'), className: 'hidden 2xl:table-cell', headClassName: 'hidden 2xl:table-cell', cell: () => <StatusBadge status="SUBMITTED" /> },
    {
      id: 'review',
      header: <span className="sr-only">{t('actions')}</span>,
      className: 'w-px',
      cell: (i) => (
        // the reject dialog is a React child of this cell: without this, a click inside it would count as a click on the row
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`${t('viewDetails')} ${i.code}`} title={t('viewDetails')} onClick={() => setPeekKey(itemKey(i))}>
            <EyeIcon />
          </Button>
          {review(i, 'sm', true)}
        </div>
      ),
    },
  ];

  // summary and filter in one: how many wait in all, and of each kind
  const cards: { value: 'ALL' | Kind; label: string; icon: LucideIcon; count: number }[] = data
    ? [{ value: 'ALL', label: t('allPending'), icon: ClockIcon, count: data.counts.total }, ...KINDS.map(([k, label]) => ({ value: k, label: t(label), icon: KIND_ICON[k], count: data.counts[k] }))]
    : [];

  return (
    <Page>
      <PageHeader title={t('approvals')} subtitle={t('approvalsSubtitle')} />

      {error && <Notice tone="error">{error}</Notice>}
      <LoadState loading={loading && !data} error={loadError} onRetry={reload} />

      {data && (
        <>
          <div role="group" aria-label={t('type')} className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {cards.map((c) => {
              const on = filter === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(c.value)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl bg-card px-4 py-3.5 text-left shadow-card transition-shadow duration-200 outline-none hover:shadow-lift focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    c.value === 'ALL' && 'max-sm:col-span-2',
                    on && 'ring-2 ring-brand',
                  )}
                >
                  {/* amber only where something is waiting: the eye goes to what needs a decision */}
                  <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-[1.125rem]', c.count ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground')}>
                    <c.icon aria-hidden strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-2xl leading-tight font-bold tracking-[-0.02em] tabular-nums">{c.count}</span>
                    <span className="line-clamp-2 text-[0.8125rem] leading-snug font-medium text-muted-foreground">{c.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* keyed by the filter: a new filter starts at page 1 */}
          <DataTable
            key={filter}
            data={items}
            columns={columns}
            rowKey={itemKey}
            onRowClick={(i) => setPeekKey(itemKey(i))}
            selectedKey={peek ? itemKey(peek) : null}
            empty={t('noPendingApprovals')}
            emptyIcon={<CheckCheckIcon className="text-success" />}
            busy={loading}
          />

          {reviewed.length > 0 && (
            <Section title={t('reviewedNow')}>
              <div className="overflow-hidden rounded-xl bg-card shadow-card">
                <p className="border-b border-border/70 px-4 py-2.5 text-xs text-muted-foreground">{t('reviewedNowSub')}</p>
                <ul className="divide-y divide-border/70">
                  {reviewed.map(({ item: i, outcome }) => (
                    <li key={itemKey(i)} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                      <Link className="font-semibold text-primary hover:underline" to={PAGE_PATH[i.type](i.id)}>
                        {i.code}
                      </Link>
                      <span className="text-muted-foreground">
                        {kindLabel(i.type)} · {i.createdByName}
                      </span>
                      <StatusBadge status={outcome === 'approved' ? 'APPROVED' : 'REJECTED'} className="ml-auto" />
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
          )}
        </>
      )}

      <QuickPanel
        open={!!peek}
        onClose={() => setPeekKey(null)}
        title={t('approvalDetails')}
        icon={PeekIcon && <PeekIcon aria-hidden />}
        code={peek?.code}
        sub={peek && kindLabel(peek.type)}
        fullTo={peek ? PAGE_PATH[peek.type](peek.id) : undefined}
        tags={
          peek && (
            <>
              <StatusBadge status="SUBMITTED" />
              <Tag>{describe(peek).figures}</Tag>
            </>
          )
        }
        actions={peek && review(peek, 'default')}
      >
        {peek && (
          <Boxes>
            <Box label={t('submittedBy')}>{peek.createdByName}</Box>
            <Box label={t('submittedOn')}>
              {dateTime(peek.submittedAt)} · {ago(peek.submittedAt, lang)}
            </Box>
            <Box label={t('woodType')}>{peek.woodType}</Box>
            {(peek.type === 'IMPORT' || peek.type === 'EXPORT') && <Box label={t('lorry')}>{peek.lorryNumber}</Box>}
            {(peek.type === 'PRODUCTION' || peek.type === 'ADJUSTMENT') && <Box label={t('importId')}>{peek.importCode}</Box>}
            {peek.type === 'IMPORT' && <Box label={t('logs')}>{peek.totalLogs}</Box>}
            {peek.type === 'EXPORT' && <Box label={t('pieces')}>{peek.totalPieces}</Box>}
            {(peek.type === 'IMPORT' || peek.type === 'EXPORT') && <Box label={t('totalCft')}>{num3(peek.totalCft)} CFT</Box>}
            {peek.type === 'PRODUCTION' && (
              <>
                <Box label={t('inputCft')}>{peek.inputCft != null ? num3(peek.inputCft) : null}</Box>
                <Box label={t('outputCft')}>{num3(peek.outputCft)}</Box>
                <Box label={t('wasteCft')}>{peek.wasteCft != null ? num3(peek.wasteCft) : null}</Box>
              </>
            )}
            {peek.type === 'ADJUSTMENT' && (
              <>
                <Box label={t('stock')}>{t(peek.kind === 'RAW' ? 'raw' : 'finished')}</Box>
                {peek.thicknessIn != null && peek.widthIn != null && peek.lengthFt != null && <Box label={t('size')}>{sizeLabel(peek.thicknessIn, peek.widthIn, peek.lengthFt)}</Box>}
                <Box label={t('change')}>{describe(peek).figures}</Box>
                <Box label={t('reason')} wide>
                  {peek.reason}
                </Box>
              </>
            )}
            {/* what pressing Approve will do, in the words of the confirmation */}
            <div className="col-span-2 rounded-lg bg-warning-soft px-3.5 py-3 text-sm text-warning">{describe(peek).confirm}</div>
          </Boxes>
        )}
      </QuickPanel>
    </Page>
  );
}
