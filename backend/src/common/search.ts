import { or, sql, SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * Case-insensitive "contains" search over a few text columns, for the `q` filter
 * on list pages. Spaces are ignored on both sides, so "tn31" finds "TN 31 AB 1214";
 * "0011" finds "IMP-2026-0011".
 * The search text is always a bind parameter; % _ \ in it are matched literally.
 */
export function textSearch(q: string | undefined, columns: AnyPgColumn[]): SQL | undefined {
  const term = q?.replace(/\s+/g, '').trim();
  if (!term) return undefined;
  const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return or(...columns.map((c) => sql`replace(${c}, ' ', '') ilike ${pattern}`));
}
