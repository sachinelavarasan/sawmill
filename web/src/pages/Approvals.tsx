import { sizeLabel } from '@sawmill/shared';
import { CheckCheckIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { dateTime, num3, useApi } from '../components/common';
import { type Column, DataTable } from '../components/data-table';
import { FilterChips, LoadState, Notice, Page, PageHeader } from '../components/page';
import { ReviewActions } from '../components/review';
import { TKey, useI18n } from '../i18n';

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

/** The owner's queue: everything submitted, oldest first, approved or rejected from one place. */
export function ApprovalsPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'ALL' | Kind>('ALL');
  const [error, setError] = useState<string | null>(null);
  const { data, loading, error: loadError, reload } = useApi<Queue>('/approvals');
  const items = useMemo(() => data?.items.filter((i) => filter === 'ALL' || i.type === filter) ?? [], [data, filter]);

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

  const columns: Column<Item>[] = [
    {
      id: 'record',
      header: t('record'),
      sort: (i) => Date.parse(i.submittedAt),
      className: 'align-top',
      cell: (i) => {
        const d = describe(i);
        return (
          <>
            <Link className="font-semibold text-primary hover:underline" to={PAGE_PATH[i.type](i.id)}>
              {i.code}
            </Link>
            <div className="text-xs text-muted-foreground">
              {i.createdByName} · {dateTime(i.submittedAt)}
            </div>
            {/* on phones the other columns fold in here */}
            <div className="mt-1 max-w-[16rem] text-xs whitespace-normal md:hidden">
              <span className="font-medium">{kindLabel(i.type)}</span> · {d.what}
              <div className="font-semibold tabular-nums">{d.figures}</div>
            </div>
          </>
        );
      },
    },
    { id: 'type', header: t('type'), from: 'md', sort: (i) => i.type, className: 'align-top', cell: (i) => <Badge variant="secondary">{kindLabel(i.type)}</Badge> },
    { id: 'what', from: 'md', headClassName: 'w-full', className: 'max-w-md align-top whitespace-normal', cell: (i) => describe(i).what },
    { id: 'cft', header: 'CFT', from: 'md', numeric: true, className: 'align-top font-semibold', cell: (i) => describe(i).figures },
    {
      id: 'review',
      className: 'align-top',
      cell: (i) => (
        <div className="flex justify-end gap-1.5">
          <ReviewActions base={API_PATH[i.type](i.id)} code={i.code} confirmApprove={describe(i).confirm} onDone={reload} onError={setError} size="sm" compact />
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader title={t('approvals')} subtitle={t('approvalsSubtitle')} />

      {error && <Notice tone="error">{error}</Notice>}
      <LoadState loading={loading && !data} error={loadError} onRetry={reload} />

      {data && (
        <>
          <FilterChips
            label={t('type')}
            value={filter}
            onChange={setFilter}
            options={[{ value: 'ALL' as const, label: t('all'), count: data.counts.total }, ...KINDS.map(([k, label]) => ({ value: k, label: t(label), count: data.counts[k] }))]}
          />
          {/* keyed by the filter: a new filter starts at page 1 */}
          <DataTable
            key={filter}
            data={items}
            columns={columns}
            rowKey={(i) => `${i.type}-${i.id}`}
            empty={t('noPendingApprovals')}
            emptyIcon={<CheckCheckIcon className="text-success" />}
            busy={loading}
          />
        </>
      )}
    </Page>
  );
}
