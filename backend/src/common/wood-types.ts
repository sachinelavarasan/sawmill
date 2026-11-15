/**
 * One spelling per wood type. Stock balances, production and reports group by the exact
 * wood_type text, so every entry point (imports, exports, stock adjustments) saves the name
 * through `resolveWoodType`:
 *
 *  - it is tidied (trimmed, inner spaces collapsed);
 *  - a name matching the mill's list, or one already used on a load, ignoring case, is saved
 *    with that existing spelling ("teak " → "Teak");
 *  - once the owner has set up a list (Settings → Wood types), a name that is neither on it
 *    nor already in use is refused. With no list yet, a new name is accepted as typed.
 *
 * Names already in use stay accepted after being removed from the list, so stock on hand can
 * still be exported or adjusted.
 */
import { BadRequestException } from '@nestjs/common';
import { cleanWoodTypeList, matchWoodType, tidyWoodType } from '@timbertrail/shared';
import { eq } from 'drizzle-orm';
import type { DbOrTx } from '../db/db.module';
import { importLoads, mills } from '../db/schema';

/** The mill's list as the owner set it (empty = not set up). */
export async function millWoodTypes(db: DbOrTx, millId: string): Promise<string[]> {
  const [mill] = await db.select({ settings: mills.settings }).from(mills).where(eq(mills.id, millId));
  return mill?.settings?.woodTypes ?? [];
}

/** Every wood type already on a load in this mill. */
export async function usedWoodTypes(db: DbOrTx, millId: string): Promise<string[]> {
  const rows = await db.selectDistinct({ w: importLoads.woodType }).from(importLoads).where(eq(importLoads.millId, millId));
  return rows.map((r) => r.w);
}

/** What the forms offer: the list when there is one, else the names already in use. */
export async function woodTypeChoices(db: DbOrTx, millId: string) {
  const list = await millWoodTypes(db, millId);
  return list.length ? { items: list, fixed: true } : { items: cleanWoodTypeList(await usedWoodTypes(db, millId)), fixed: false };
}

export async function resolveWoodType(db: DbOrTx, millId: string, input: string): Promise<string> {
  const name = tidyWoodType(input);
  if (name.length < 2) throw new BadRequestException('Wood type must be at least 2 characters');
  const list = await millWoodTypes(db, millId);
  const known = matchWoodType(list, name) ?? matchWoodType(await usedWoodTypes(db, millId), name);
  if (known) return known;
  if (list.length) throw new BadRequestException(`"${name}" is not one of the mill's wood types. Pick one from the list, or ask the owner to add it in Settings.`);
  return name;
}

/** `resolveWoodType` for an optional field: undefined stays undefined (= leave unchanged). */
export const resolveOptionalWoodType = (db: DbOrTx, millId: string, input: string | undefined) =>
  input === undefined ? Promise.resolve(undefined) : resolveWoodType(db, millId, input);
