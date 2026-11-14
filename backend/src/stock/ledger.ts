/**
 * The stock ledger: helpers every approval path uses to post stock.
 *
 * Stock balances are SUM(stock_movements). Rows are never edited or deleted:
 * when an approved record changes, `syncMovements` posts only the difference
 * between what the record says now and what it has already posted.
 */
import { ConflictException } from '@nestjs/common';
import { formatCft, roundTo, sizeLabel } from '@sawmill/shared';
import { and, asc, eq, inArray, sql, sum } from 'drizzle-orm';
import type { DbOrTx } from '../db/db.module';
import { importLoads, stockMovements } from '../db/schema';

type StockKind = 'RAW' | 'FINISHED';
type StockSource = (typeof stockMovements.$inferInsert)['source'];

/** One stock position a record should hold: signed pieces and CFT. Dimensions are null for raw logs. */
export interface LedgerLine {
  kind: StockKind;
  woodType: string;
  importLoadId: string;
  thicknessIn: number | null;
  widthIn: number | null;
  lengthFt: number | null;
  pieces: number;
  cft: number;
}

/** numeric(8,2) columns come back as "4.00" — normalise so "4.00" and 4 are the same size. */
const dim = (v: string | number | null | undefined) => (v == null ? null : Number(v));
const keyOf = (l: Pick<LedgerLine, 'kind' | 'woodType' | 'importLoadId' | 'thicknessIn' | 'widthIn' | 'lengthFt'>) =>
  [l.kind, l.woodType, l.importLoadId, dim(l.thicknessIn) ?? '', dim(l.widthIn) ?? '', dim(l.lengthFt) ?? ''].join('|');

/** CFT is stored with 3 decimals; anything smaller is rounding noise. */
const EPSILON = 0.0005;

/**
 * Lock import loads (in a fixed order, so two transactions can't deadlock) before
 * checking or changing the stock they hold. Every stock-changing path locks the
 * loads it touches, so two approvals can never both spend the same raw CFT.
 */
export async function lockImportLoads(tx: DbOrTx, ids: string[]) {
  const unique = [...new Set(ids)].sort();
  if (!unique.length) return;
  await tx.select({ id: importLoads.id }).from(importLoads).where(inArray(importLoads.id, unique)).orderBy(asc(importLoads.id)).for('update');
}

/**
 * Make the movements posted by one source record equal `target`, by appending
 * the difference per stock position. Passing an empty target reverses everything
 * the source has posted.
 */
export async function syncMovements(
  tx: DbOrTx,
  opts: { millId: string; source: StockSource; sourceId: string; postedById: string; target: LedgerLine[] },
) {
  const posted = await tx
    .select({
      kind: stockMovements.kind,
      woodType: stockMovements.woodType,
      importLoadId: stockMovements.importLoadId,
      thicknessIn: stockMovements.thicknessIn,
      widthIn: stockMovements.widthIn,
      lengthFt: stockMovements.lengthFt,
      pieces: sum(stockMovements.piecesDelta),
      cft: sum(stockMovements.cftDelta),
    })
    .from(stockMovements)
    .where(and(eq(stockMovements.source, opts.source), eq(stockMovements.sourceId, opts.sourceId)))
    .groupBy(
      stockMovements.kind,
      stockMovements.woodType,
      stockMovements.importLoadId,
      stockMovements.thicknessIn,
      stockMovements.widthIn,
      stockMovements.lengthFt,
    );

  // Start from the negation of everything posted, then add what should be there.
  const diff = new Map<string, LedgerLine>();
  for (const p of posted) {
    const line: LedgerLine = {
      kind: p.kind,
      woodType: p.woodType,
      importLoadId: p.importLoadId,
      thicknessIn: dim(p.thicknessIn),
      widthIn: dim(p.widthIn),
      lengthFt: dim(p.lengthFt),
      pieces: -Number(p.pieces ?? 0),
      cft: -Number(p.cft ?? 0),
    };
    diff.set(keyOf(line), line);
  }
  for (const t of opts.target) {
    const k = keyOf(t);
    const cur = diff.get(k);
    if (cur) {
      cur.pieces += t.pieces;
      cur.cft += t.cft;
    } else diff.set(k, { ...t });
  }

  const rows = [...diff.values()]
    .map((l) => ({ ...l, cft: roundTo(l.cft) }))
    .filter((l) => l.pieces !== 0 || l.cft !== 0);
  if (!rows.length) return;

  await tx.insert(stockMovements).values(
    rows.map((l) => ({
      millId: opts.millId,
      kind: l.kind,
      woodType: l.woodType,
      importLoadId: l.importLoadId,
      thicknessIn: l.thicknessIn == null ? null : String(l.thicknessIn),
      widthIn: l.widthIn == null ? null : String(l.widthIn),
      lengthFt: l.lengthFt == null ? null : String(l.lengthFt),
      piecesDelta: l.pieces,
      cftDelta: String(l.cft),
      source: opts.source,
      sourceId: opts.sourceId,
      postedById: opts.postedById,
    })),
  );
}

/**
 * Refuse (roll back) any change that leaves stock below zero for these import loads.
 * Raw stock is checked per load (all wood types together, so an owner correcting a
 * load's wood type doesn't trip it); finished stock per load, wood type and size.
 */
export async function assertStockNotNegative(tx: DbOrTx, importLoadIds: string[]) {
  const ids = [...new Set(importLoadIds)];
  if (!ids.length) return;

  const raw = await tx
    .select({ importLoadId: stockMovements.importLoadId, code: importLoads.code, cft: sum(stockMovements.cftDelta), pieces: sum(stockMovements.piecesDelta) })
    .from(stockMovements)
    .innerJoin(importLoads, eq(importLoads.id, stockMovements.importLoadId))
    .where(and(inArray(stockMovements.importLoadId, ids), eq(stockMovements.kind, 'RAW')))
    .groupBy(stockMovements.importLoadId, importLoads.code)
    .having(sql`sum(${stockMovements.cftDelta}) < ${-EPSILON} or sum(${stockMovements.piecesDelta}) < 0`);
  if (raw.length) {
    const r = raw[0];
    const shortCft = -Number(r.cft ?? 0);
    throw new ConflictException(
      shortCft > EPSILON
        ? `Not enough raw stock in ${r.code} (short by ${formatCft(shortCft)} CFT)`
        : `Not enough raw stock in ${r.code} (short by ${-Number(r.pieces ?? 0)} logs)`,
    );
  }

  const finished = await tx
    .select({
      code: importLoads.code,
      woodType: stockMovements.woodType,
      thicknessIn: stockMovements.thicknessIn,
      widthIn: stockMovements.widthIn,
      lengthFt: stockMovements.lengthFt,
      cft: sum(stockMovements.cftDelta),
      pieces: sum(stockMovements.piecesDelta),
    })
    .from(stockMovements)
    .innerJoin(importLoads, eq(importLoads.id, stockMovements.importLoadId))
    .where(and(inArray(stockMovements.importLoadId, ids), eq(stockMovements.kind, 'FINISHED')))
    .groupBy(importLoads.code, stockMovements.woodType, stockMovements.thicknessIn, stockMovements.widthIn, stockMovements.lengthFt)
    .having(sql`sum(${stockMovements.cftDelta}) < ${-EPSILON} or sum(${stockMovements.piecesDelta}) < 0`);
  if (finished.length) {
    const f = finished[0];
    const size = sizeLabel(Number(f.thicknessIn), Number(f.widthIn), Number(f.lengthFt));
    throw new ConflictException(
      `Not enough finished stock: ${f.woodType} ${size} from ${f.code} (short by ${-Number(f.pieces ?? 0)} pieces)`,
    );
  }
}

/** Finished pieces and CFT in stock for one wood type and size from one import load. */
export async function finishedBalance(
  tx: DbOrTx,
  key: { millId: string; woodType: string; importLoadId: string; thicknessIn: number; widthIn: number; lengthFt: number },
) {
  const [r] = await tx
    .select({ pieces: sum(stockMovements.piecesDelta), cft: sum(stockMovements.cftDelta) })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.millId, key.millId),
        eq(stockMovements.kind, 'FINISHED'),
        eq(stockMovements.woodType, key.woodType),
        eq(stockMovements.importLoadId, key.importLoadId),
        eq(stockMovements.thicknessIn, String(key.thicknessIn)),
        eq(stockMovements.widthIn, String(key.widthIn)),
        eq(stockMovements.lengthFt, String(key.lengthFt)),
      ),
    );
  return { pieces: Number(r?.pieces ?? 0), cft: roundTo(Number(r?.cft ?? 0)) };
}

/** Import loads a source record has already posted stock against (to lock them before re-posting). */
export async function postedLoads(tx: DbOrTx, source: StockSource, sourceId: string): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ id: stockMovements.importLoadId })
    .from(stockMovements)
    .where(and(eq(stockMovements.source, source), eq(stockMovements.sourceId, sourceId)));
  return rows.map((r) => r.id);
}

/** Raw CFT currently in stock for one import load (approved movements only). */
export async function rawBalance(tx: DbOrTx, importLoadId: string): Promise<number> {
  const [r] = await tx
    .select({ cft: sum(stockMovements.cftDelta) })
    .from(stockMovements)
    .where(and(eq(stockMovements.importLoadId, importLoadId), eq(stockMovements.kind, 'RAW')));
  return roundTo(Number(r?.cft ?? 0));
}
