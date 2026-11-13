import { roundTo } from './cft';

/**
 * Production maths shared by the API and the apps.
 *
 * A production run consumes raw CFT from one import load and produces sawn
 * pieces (each output line's CFT uses the export formula). Waste is what was
 * consumed but not produced.
 */

/** Raw CFT consumed minus finished CFT produced. Negative means the output measured more than the input. */
export function productionWaste(inputCft: number, outputCft: number): number {
  return roundTo(inputCft - outputCft);
}

/** Share of the consumed raw CFT that became finished wood, as a percentage with 1 decimal; null without input. */
export function recoveryPercent(inputCft: number | null | undefined, outputCft: number): number | null {
  if (inputCft == null || inputCft <= 0) return null;
  return roundTo((outputCft / inputCft) * 100, 1);
}

/** Compact size label used in tables and on reports: 4 × 2 in × 8 ft. */
export function sizeLabel(thicknessIn: number, widthIn: number, lengthFt: number): string {
  return `${thicknessIn} × ${widthIn} in × ${lengthFt} ft`;
}
