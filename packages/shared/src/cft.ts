/**
 * CFT (cubic feet) formulas from the SAWMILL PRO requirements.
 *
 *  Import (round logs):   CFT = (Girth × Girth × Length) / 2304
 *                         girth in inches, length in feet
 *  Export (sawn pieces):  CFT = (Thickness × Width × Length × Pieces) / 144
 *                         thickness & width in inches, length in feet
 *
 * Every line is rounded to 3 decimals. Totals are the sum of the rounded lines,
 * so a printed report always adds up exactly.
 */

export const CFT_DECIMALS = 3;

export class CftInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CftInputError';
  }
}

/** Round half away from zero to `decimals` places, avoiding float artefacts like 1.0049999. */
export function roundTo(value: number, decimals = CFT_DECIMALS): number {
  const factor = 10 ** decimals;
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * factor + 1e-9)) / factor;
}

function assertPositive(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new CftInputError(`${name} must be a number greater than 0`);
  }
}

export function importLogCft(girthInches: number, lengthFeet: number): number {
  assertPositive('Girth', girthInches);
  assertPositive('Length', lengthFeet);
  return roundTo((girthInches * girthInches * lengthFeet) / 2304);
}

export function exportPieceCft(
  thicknessInches: number,
  widthInches: number,
  lengthFeet: number,
  pieces: number,
): number {
  assertPositive('Thickness', thicknessInches);
  assertPositive('Width', widthInches);
  assertPositive('Length', lengthFeet);
  if (!Number.isInteger(pieces) || pieces <= 0) {
    throw new CftInputError('Pieces must be a whole number greater than 0');
  }
  return roundTo((thicknessInches * widthInches * lengthFeet * pieces) / 144);
}

/** Sum already-rounded line CFTs. */
export function totalCft(lines: readonly number[]): number {
  return roundTo(lines.reduce((sum, v) => sum + v, 0));
}

/** Format for display: always 3 decimals, e.g. 0.5 → "0.500". */
export function formatCft(value: number): string {
  return value.toFixed(CFT_DECIMALS);
}
