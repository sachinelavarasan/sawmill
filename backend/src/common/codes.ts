import { sql } from 'drizzle-orm';
import type { DbOrTx } from '../db/db.module';
import { counters } from '../db/schema';

/**
 * Next human-readable code for a mill, e.g. IMP-2026-0001.
 * The counter row is incremented atomically (INSERT … ON CONFLICT DO UPDATE …
 * RETURNING), so concurrent creates never get the same number.
 * Call it inside the same transaction as the insert that uses the code.
 */
export async function nextCode(tx: DbOrTx, millId: string, prefix: 'IMP' | 'EXP' | 'PRD' | 'ADJ'): Promise<string> {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;
  const [row] = await tx
    .insert(counters)
    .values({ millId, key, value: 1 })
    .onConflictDoUpdate({ target: [counters.millId, counters.key], set: { value: sql`${counters.value} + 1` } })
    .returning({ value: counters.value });
  return `${key}-${String(row.value).padStart(4, '0')}`;
}
