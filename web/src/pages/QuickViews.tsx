/**
 * Quick views: an import load, production run or export opened beside its list, with the
 * next step (submit, or approve / reject) right there. Each takes the list row, shows it at
 * once, and fetches the full record. The API decides what the viewer may do.
 */
import { sizeLabel } from '@sawmill/shared';
import { FactoryIcon, RulerIcon, TruckIcon } from 'lucide-react';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '../api';
import { dateTime, money, num3, useLoad } from '../components/common';
import { Notice } from '../components/page';
import { Box, Boxes, LinesCard, QuickPanel, Tag } from '../components/quick-panel';
import { StatusBadge } from '../components/status-badge';
import { WorkflowBar } from '../components/workflow';
import { useI18n } from '../i18n';
import type { ExportDetail } from './ExportDetail';
import type { ExportSummary } from './Exports';
import type { ImportDetail } from './ImportDetail';
import type { ImportSummary } from './Imports';
import { dateOnly, type ProductionSummary } from './Production';
import type { ProductionDetail } from './ProductionDetail';

/** How many of a record's lines the panel lists; the rest are on the full record. */
const LINES_SHOWN = 5;

interface Props<S> {
  /** the list row to show, or null when the panel is closed */
  row: S | null;
  onClose: () => void;
  /** the record changed (submitted / approved / rejected): refresh the list */
  onChanged: () => void;
}

/** The full record behind a list row; null until it arrives (or while another row's is still showing). */
function useDetail<D extends { id: string }>(path: string, id: string | null) {
  const detail = useLoad(() => (id ? api<D>(`${path}/${id}`) : Promise.resolve(null)), [id]);
  return { ...detail, d: detail.data?.id === id ? detail.data : null };
}

/** Rejection reason, load error, and the approval strip (a placeholder until the record arrives). */
function Step({ reason, error, ready, children }: { reason: string | null | undefined; error: string | null; ready: boolean; children: ReactNode }) {
  return (
    <>
      {reason && <Notice tone="error">{reason}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {ready ? children : !error && <Skeleton className="h-14" />}
    </>
  );
}

export function ImportQuickView({ row, onClose, onChanged }: Props<ImportSummary>) {
  const { t } = useI18n();
  const { d, error, reload } = useDetail<ImportDetail>('/imports', row?.id ?? null);
  const s = d ?? row;
  const logs = d ? [...d.logs].sort((a, b) => b.logNumber - a.logNumber).slice(0, LINES_SHOWN) : [];
  const unloadingTotal = d?.unloadings.reduce((sum, u) => sum + (u.totalCharges ?? 0), 0) ?? 0;
  return (
    <QuickPanel
      open={!!row}
      onClose={onClose}
      title={t('importDetails')}
      icon={<TruckIcon aria-hidden />}
      code={s?.code}
      sub={s && `${s.woodType} · ${s.lorryNumber}`}
      fullTo={s ? `/imports/${s.id}` : undefined}
      tags={
        s && (
          <>
            <StatusBadge status={s.status} />
            <Tag>
              {s.totalLogs} {t('logs')}
            </Tag>
            <Tag>{num3(s.totalCft)} CFT</Tag>
          </>
        )
      }
    >
      {s && (
        <>
          <Step reason={s.rejectionReason} error={error} ready={!!d}>
            {d && (
              <WorkflowBar
                stacked
                base={`/imports/${d.id}`}
                status={d.status}
                canSubmit={d.canSubmit}
                canReview={d.canReview}
                submitBlocked={d.totalLogs === 0 ? t('needLogsToSubmit') : null}
                confirmApprove={t('confirmApprove', { code: d.code, cft: num3(d.totalCft) })}
                approvedNote={d.editable ? t('approvedStockNote') : undefined}
                onDone={() => {
                  reload();
                  onChanged();
                }}
              />
            )}
          </Step>
          <Boxes>
            <Box label={t('arrival')}>{dateTime(s.arrivalAt)}</Box>
            <Box label={t('originLocation')}>{s.originLocation}</Box>
            <Box label={t('driverName')}>{s.driverName}</Box>
            <Box label={t('driverMobile')}>{d?.driverMobile}</Box>
            <Box label={t('lorryOwnerName')}>{d?.lorryOwnerName}</Box>
            <Box label={t('woodCategory')}>{d?.woodCategory}</Box>
            {/* only sent to people who may see the purchase record */}
            {s.supplierName && <Box label={t('supplier')}>{s.supplierName}</Box>}
            <Box label={t('totalUnloadingCharges')}>{d ? money(unloadingTotal) : null}</Box>
            <Box label={t('createdBy')} wide={!!s.supplierName}>
              {s.createdByName}
            </Box>
            {d?.notes && (
              <Box label={t('notes')} wide>
                {d.notes}
              </Box>
            )}
          </Boxes>
          <LinesCard
            label={t('latestLogs')}
            summary={`${s.totalLogs} ${t('logs')} · ${num3(s.totalCft)} CFT`}
            action={
              d?.editable && (
                <Button asChild variant="outline" size="sm">
                  <Link to={`/imports/${s.id}#logs`}>
                    <RulerIcon /> {t('measure')}
                  </Link>
                </Button>
              )
            }
            head={[t('logNo'), t('girth'), t('lengthFt'), 'CFT']}
            rows={logs.map((l) => ({ key: l.id, cells: [l.logNumber, l.girthIn, l.lengthFt, num3(l.cft)] }))}
            empty={t('noLogsYet')}
            loading={!d && !error}
          />
        </>
      )}
    </QuickPanel>
  );
}

export function ProductionQuickView({ row, onClose, onChanged }: Props<ProductionSummary>) {
  const { t } = useI18n();
  const { d, error, reload } = useDetail<ProductionDetail>('/production', row?.id ?? null);
  const s = d ?? row;
  const cftOrDash = (n: number | null | undefined) => (n != null ? `${num3(n)} CFT` : null);
  return (
    <QuickPanel
      open={!!row}
      onClose={onClose}
      title={t('productionDetails')}
      icon={<FactoryIcon aria-hidden />}
      code={s?.code}
      sub={s && `${s.woodType} · ${s.importCode}`}
      fullTo={s ? `/production/${s.id}` : undefined}
      tags={
        s && (
          <>
            <StatusBadge status={s.status} />
            <Tag>{num3(s.outputCft)} CFT</Tag>
            {d?.recoveryPercent != null && (
              <Tag>
                {t('recovery')} {d.recoveryPercent}%
              </Tag>
            )}
          </>
        )
      }
    >
      {s && (
        <>
          <Step reason={s.rejectionReason} error={error} ready={!!d}>
            {d && (
              <WorkflowBar
                stacked
                base={`/production/${d.id}`}
                status={d.status}
                canSubmit={d.canSubmit}
                canReview={d.canReview}
                submitBlocked={d.inputCft == null || d.outputs.length === 0 ? t('needInputAndOutput') : null}
                confirmApprove={t('confirmApproveProduction', { code: d.code, input: num3(d.inputCft ?? 0), output: num3(d.outputCft) })}
                approvedNote={d.editable ? t('approvedProductionNote') : undefined}
                onDone={() => {
                  reload();
                  onChanged();
                }}
              />
            )}
          </Step>
          <Boxes>
            <Box label={t('date')}>{dateOnly(s.productionDate)}</Box>
            <Box label={t('importId')}>{d ? `${d.importCode} · ${d.importLorryNumber}` : s.importCode}</Box>
            <Box label={t('inputCft')}>{cftOrDash(s.inputCft)}</Box>
            <Box label={t('outputCft')}>{cftOrDash(s.outputCft)}</Box>
            <Box label={t('wasteCft')}>{cftOrDash(s.wasteCft)}</Box>
            <Box label={t('recovery')}>{d?.recoveryPercent != null ? `${d.recoveryPercent}%` : null}</Box>
            <Box label={t('cuttingMachine')}>{d?.cuttingMachine}</Box>
            <Box label={t('machineOperator')}>{d?.machineOperator}</Box>
            <Box label={t('workerDetails')}>{d?.workerDetails}</Box>
            <Box label={t('createdBy')}>{s.createdByName}</Box>
          </Boxes>
          <LinesCard
            label={t('sizesCut')}
            summary={`${num3(s.outputCft)} CFT`}
            head={[t('size'), t('pieces'), 'CFT']}
            rows={(d?.outputs ?? []).slice(0, LINES_SHOWN).map((o) => ({ key: o.id, cells: [sizeLabel(o.thicknessIn, o.widthIn, o.lengthFt), o.pieces, num3(o.cft)] }))}
            empty={t('nothingRecordedYet')}
            loading={!d && !error}
          />
        </>
      )}
    </QuickPanel>
  );
}

export function ExportQuickView({ row, onClose, onChanged }: Props<ExportSummary>) {
  const { t } = useI18n();
  const { d, error, reload } = useDetail<ExportDetail>('/exports', row?.id ?? null);
  const s = d ?? row;
  return (
    <QuickPanel
      open={!!row}
      onClose={onClose}
      title={t('exportDetails')}
      icon={<TruckIcon aria-hidden />}
      code={s?.code}
      sub={s && `${s.woodType} · ${s.lorryNumber}`}
      fullTo={s ? `/exports/${s.id}` : undefined}
      tags={
        s && (
          <>
            <StatusBadge status={s.status} />
            <Tag>{t('piecesCount', { n: s.totalPieces })}</Tag>
            <Tag>{num3(s.totalCft)} CFT</Tag>
          </>
        )
      }
    >
      {s && (
        <>
          <Step reason={d?.rejectionReason} error={error} ready={!!d}>
            {d && (
              <WorkflowBar
                stacked
                base={`/exports/${d.id}`}
                status={d.status}
                canSubmit={d.canSubmit}
                canReview={d.canReview}
                submitBlocked={d.lines.length === 0 ? t('needLinesToSubmit') : null}
                confirmApprove={t('confirmApproveExport', { code: d.code, pieces: d.totalPieces, cft: num3(d.totalCft) })}
                approvedNote={d.editable ? t('approvedExportNote') : undefined}
                onDone={() => {
                  reload();
                  onChanged();
                }}
              />
            )}
          </Step>
          <Boxes>
            <Box label={t('date')}>{dateOnly(s.exportDate)}</Box>
            <Box label={t('lorry')}>{s.lorryNumber}</Box>
            <Box label={t('driverName')}>{d?.driverName}</Box>
            <Box label={t('driverMobile')}>{d?.driverMobile}</Box>
            <Box label={t('lorryOwnerName')}>{d?.lorryOwnerName}</Box>
            <Box label={t('lorryOwnerMobile')}>{d?.lorryOwnerMobile}</Box>
            <Box label={t('importId')}>{d?.importCode}</Box>
            <Box label={t('createdBy')}>{s.createdByName}</Box>
            {d?.notes && (
              <Box label={t('notes')} wide>
                {d.notes}
              </Box>
            )}
          </Boxes>
          <LinesCard
            label={t('linesLoaded')}
            summary={`${t('piecesCount', { n: s.totalPieces })} · ${num3(s.totalCft)} CFT`}
            head={[t('size'), t('importId'), t('pieces'), 'CFT']}
            rows={(d?.lines ?? []).slice(0, LINES_SHOWN).map((l) => ({ key: l.id, cells: [sizeLabel(l.thicknessIn, l.widthIn, l.lengthFt), l.importCode, l.pieces, num3(l.cft)] }))}
            empty={t('nothingRecordedYet')}
            loading={!d && !error}
          />
        </>
      )}
    </QuickPanel>
  );
}
