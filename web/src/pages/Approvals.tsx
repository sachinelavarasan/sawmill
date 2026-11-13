import { sizeLabel } from '@sawmill/shared';
import { CheckCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { dateTime, num3, useLoad } from '../components/common';
import { LoadState, Notice, numCell, Page, PageHeader, TableCard, useClientPaging, wide } from '../components/page';
import { ReviewActions } from '../components/review';
import { TKey, useI18n } from '../i18n';

type Kind = 'IMPORT' | 'PRODUCTION' | 'EXPORT' | 'ADJUSTMENT';
interface Base {
  id: string;
  code: string;
  submittedAt: string;
  createdByName: string;
  woodType: string;
}
type Item =
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
interface Queue {
  counts: Record<Kind, number> & { total: number };
  items: Item[];
}

const KINDS: [Kind, TKey][] = [
  ['IMPORT', 'imports'],
  ['PRODUCTION', 'production'],
  ['EXPORT', 'exports'],
  ['ADJUSTMENT', 'adjustments'],
];
/** where the record opens, and its API path for approve/reject */
const PAGE_PATH: Record<Kind, (id: string) => string> = {
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
  const { data, loading, error: loadError, reload } = useLoad(() => api<Queue>('/approvals'), []);
  const items = data?.items.filter((i) => filter === 'ALL' || i.type === filter) ?? [];
  const paged = useClientPaging(items);

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

  return (
    <Page>
      <PageHeader title={t('approvals')} subtitle={t('approvalsSubtitle')} />

      {error && <Notice tone="error">{error}</Notice>}
      <LoadState loading={loading && !data} error={loadError} onRetry={reload} />

      {data && (
        <>
          <Tabs
            value={filter}
            onValueChange={(v) => {
              setFilter(v as typeof filter);
              paged.reset();
            }}
          >
            <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
              <TabsTrigger value="ALL" className="gap-1.5 px-3">
                {t('all')}
                <Count n={data.counts.total} />
              </TabsTrigger>
              {KINDS.map(([k, label]) => (
                <TabsTrigger key={k} value={k} className="gap-1.5 px-3">
                  {t(label)}
                  <Count n={data.counts[k]} />
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {items.length === 0 ? (
            <TableCard empty emptyText={t('noPendingApprovals')} emptyIcon={<CheckCheckIcon className="text-success" />}>
              {null}
            </TableCard>
          ) : (
            <TableCard pager={paged.pager}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="pl-4">{t('record')}</TableHead>
                    <TableHead className={wide}>{t('type')}</TableHead>
                    <TableHead className={cn(wide, 'w-full')} />
                    <TableHead className={cn(numCell, wide)}>CFT</TableHead>
                    <TableHead className="pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.rows.map((i) => {
                    const d = describe(i);
                    return (
                      <TableRow key={`${i.type}-${i.id}`}>
                        <TableCell className="pl-4 align-top">
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
                        </TableCell>
                        <TableCell className={cn(wide, 'align-top')}>
                          <Badge variant="secondary">{kindLabel(i.type)}</Badge>
                        </TableCell>
                        <TableCell className={cn(wide, 'max-w-md align-top whitespace-normal')}>{d.what}</TableCell>
                        <TableCell className={cn(numCell, wide, 'align-top font-semibold')}>{d.figures}</TableCell>
                        <TableCell className="pr-4 align-top">
                          <div className="flex justify-end gap-1.5">
                            <ReviewActions base={API_PATH[i.type](i.id)} code={i.code} confirmApprove={d.confirm} onDone={reload} onError={setError} size="sm" compact />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableCard>
          )}
        </>
      )}
    </Page>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className={cn('min-w-5 rounded-full px-1.5 text-xs font-bold tabular-nums', n ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground')}>{n}</span>
  );
}
