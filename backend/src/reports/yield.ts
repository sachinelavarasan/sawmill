/**
 * Yield (recovery) of approved production, grouped by wood type or by supplier + wood type.
 *
 * Each production run takes `input` raw CFT from one import load and gives `output` finished
 * CFT. Recovery = Σ output / Σ input (not an average of percentages, so a big run weighs more).
 *
 * Cost (supplier report only): a run's raw wood costs input × the load's purchase price per CFT
 * (purchase amount ÷ the load's measured CFT). Cost per finished CFT = that cost ÷ the output
 * of the same runs — what a usable CFT really cost from that supplier. Runs whose load has no
 * purchase amount yet are left out of the cost figures (not counted as free).
 */
import { recoveryPercent, roundTo } from '@timbertrail/shared';

export interface YieldRun {
  loadId: string;
  woodType: string;
  input: number;
  output: number;
  /** the import load's measured CFT */
  loadCft: number;
  purchaseAmount?: number | null;
  supplierId?: string | null;
  supplierName?: string | null;
}

export interface YieldGroup {
  key: string;
  woodType: string;
  supplierName: string | null;
  loads: number;
  runs: number;
  input: number;
  output: number;
  waste: number;
  recovery: number | null;
  /** Σ cost of the raw wood used / Σ its CFT — null when no load in the group has a price */
  avgRate: number | null;
  costPerFinished: number | null;
  /** behind the figures, for overall totals */
  cost: number;
  costedOutput: number;
}

export function aggregateYield(runs: YieldRun[], keyOf: (r: YieldRun) => string): YieldGroup[] {
  const groups = new Map<string, YieldGroup & { loadIds: Set<string>; costedInput: number }>();
  for (const r of runs) {
    if (!(r.input > 0)) continue;
    const key = keyOf(r);
    let g = groups.get(key);
    if (!g) {
      g = { key, woodType: r.woodType, supplierName: r.supplierName ?? null, loads: 0, runs: 0, input: 0, output: 0, waste: 0, recovery: null, avgRate: null, costPerFinished: null, cost: 0, costedOutput: 0, costedInput: 0, loadIds: new Set() };
      groups.set(key, g);
    }
    g.loadIds.add(r.loadId);
    g.runs += 1;
    g.input += r.input;
    g.output += r.output;
    if (r.purchaseAmount != null && r.loadCft > 0) {
      g.cost += (r.input * r.purchaseAmount) / r.loadCft;
      g.costedInput += r.input;
      g.costedOutput += r.output;
    }
  }
  return [...groups.values()].map(({ loadIds, costedInput, ...g }) => ({
    ...g,
    loads: loadIds.size,
    input: roundTo(g.input),
    output: roundTo(g.output),
    waste: roundTo(g.input - g.output),
    recovery: recoveryPercent(g.input, g.output),
    avgRate: costedInput > 0 ? roundTo(g.cost / costedInput, 2) : null,
    costPerFinished: g.costedOutput > 0 ? roundTo(g.cost / g.costedOutput, 2) : null,
    cost: roundTo(g.cost, 2),
  }));
}
