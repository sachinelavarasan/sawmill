/**
 * Wood type names. Stock, production and reports group by the exact text, so "Teak",
 * "teak " and "TEAK" must end up as one spelling. The mill keeps a list in Settings; entries
 * are matched against it ignoring case and extra spaces, and saved with the list's spelling.
 */

/** Trim and collapse inner spaces: "  Burma   teak " → "Burma teak". */
export const tidyWoodType = (s: string) => s.trim().replace(/\s+/g, ' ');

/** The comparison key: tidied and lower-cased. */
export const woodTypeKey = (s: string) => tidyWoodType(s).toLocaleLowerCase('en-IN');

/** The spelling from `known` that `input` means, or null when it is a new name. */
export function matchWoodType(known: readonly string[], input: string): string | null {
  const k = woodTypeKey(input);
  return known.find((w) => woodTypeKey(w) === k) ?? null;
}

/** Tidy, drop blanks and case-insensitive repeats (the first spelling wins), sort A–Z. */
export function cleanWoodTypeList(list: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const w = tidyWoodType(raw);
    const k = woodTypeKey(w);
    if (!w || seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out.sort((a, b) => a.localeCompare(b, 'en-IN', { sensitivity: 'base' }));
}
