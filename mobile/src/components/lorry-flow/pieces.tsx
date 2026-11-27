/**
 * Choosing the pieces that go on a lorry, shared by Lorry Out (app/(app)/lorry-out.tsx, step 2–3)
 * and a load out's own page (app/(app)/load-out/[id].tsx, "Change pieces"):
 *
 *   useLorryStock   approved sawn stock, with the plate of the lorry each load came in on
 *   buildSources    that stock for one wood, grouped by load (oldest first), each size with what is
 *                   left — plus custom sizes and the sizes already on the load out
 *   PiecesPicker    "From lorry" cards (a green count of pieces taken from each), then the chosen
 *                   lorry's sizes with − [10] +, and "+ Custom size"
 *   PiecesSummary   "From N lorries · Change", then each lorry with its sizes and pieces
 *   SendCard        the walnut card: plate, wood · time, pieces and CFT
 *   WoodSwitch      the woods as one segmented bar
 */
import { exportPieceCft, totalCft } from '@timbertrail/shared';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { int, num3, parseNum } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { ImportSummary } from '../../lib/imports-api';
import { useApi } from '../../lib/query';
import type { Balances } from '../../lib/types';
import { AppBottomSheet, SheetActions, useSheet } from '../bottom-sheet';
import { NumberField, Row } from '../form';
import { TreeRings } from '../glow';
import { Tap } from '../motion';
import { fontStyleFor, Text, TextInput } from '../text';
import { cn, Icon, Plate } from '../ui';
import { GroupLabel } from './parts';

export type Size = { t: number; w: number; l: number; left: number | null };
export type Source = { id: string; code: string; plate: string | null; sizes: Size[] };
export type Line = { loadId: string; code: string; plate: string | null; t: number; w: number; l: number; pieces: number; cft: number };
/** pieces chosen, by sizeKey */
export type Qty = Record<string, number>;
/** a size already on a load out (for editing it) */
export type ExistingLine = { loadId: string; code: string; plate: string | null; t: number; w: number; l: number; pieces: number; available: number };

/** 4, 4.5 — no trailing zeros */
export const n = (x: number) => String(Number(x.toFixed(2)));
export const sizeKey = (loadId: string, s: { t: number; w: number; l: number }) => `${loadId}|${s.t}|${s.w}|${s.l}`;

/** Approved sawn stock (pieces > 0), and the plate of the lorry each load came in on (stock rows carry only the load code). */
export function useLorryStock() {
  const stock = useApi<Balances>('/stock');
  const loadsList = useApi<{ items: ImportSummary[] }>('/imports?take=200');
  const plateOf = useMemo(() => new Map((loadsList.data?.items ?? []).map((i) => [i.id, i.lorryNumber])), [loadsList.data]);
  const finished = useMemo(() => (stock.data?.finished ?? []).filter((r) => r.pieces > 0), [stock.data]);
  const woods = useMemo(() => [...new Set(finished.map((r) => r.woodType))].sort(), [finished]);
  return { stock, finished, woods, plateOf };
}

/**
 * One wood's stock by the load it came from (oldest load first: its pieces go out first), the
 * bigger sizes first, then custom sizes; `existing` adds the sizes already on a load out (so they
 * can be changed even when that stock has run out) and never lets "left" fall below them.
 */
export function buildSources(
  finished: Balances['finished'],
  wood: string,
  plateOf: Map<string, string>,
  custom: Record<string, Size[]>,
  existing: ExistingLine[] = [],
): Source[] {
  const m = new Map<string, Source>();
  for (const r of finished.filter((x) => x.woodType === wood)) {
    const s = m.get(r.importLoadId) ?? { id: r.importLoadId, code: r.importCode, plate: plateOf.get(r.importLoadId) ?? null, sizes: [] };
    s.sizes.push({ t: r.thicknessIn, w: r.widthIn, l: r.lengthFt, left: r.pieces });
    m.set(r.importLoadId, s);
  }
  for (const e of existing) {
    const s = m.get(e.loadId) ?? { id: e.loadId, code: e.code, plate: e.plate ?? plateOf.get(e.loadId) ?? null, sizes: [] };
    if (!s.plate && e.plate) s.plate = e.plate;
    const z = s.sizes.find((x) => x.t === e.t && x.w === e.w && x.l === e.l);
    if (z) z.left = Math.max(z.left ?? 0, e.pieces);
    else s.sizes.push({ t: e.t, w: e.w, l: e.l, left: Math.max(e.available, e.pieces) });
    m.set(e.loadId, s);
  }
  for (const s of m.values()) {
    s.sizes.sort((a, b) => b.t * b.w - a.t * a.w || b.l - a.l);
    for (const c of custom[s.id] ?? []) if (!s.sizes.some((x) => x.t === c.t && x.w === c.w && x.l === c.l)) s.sizes.push(c);
  }
  return [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** What goes on the lorry: the chosen pieces, by lorry, in the lorries' order. */
export function linesOf(sources: Source[], qty: Qty): Line[] {
  return sources.flatMap((s) =>
    s.sizes
      .map((z) => ({ z, pieces: qty[sizeKey(s.id, z)] ?? 0 }))
      .filter((x) => x.pieces > 0)
      .map(({ z, pieces }) => ({ loadId: s.id, code: s.code, plate: s.plate, t: z.t, w: z.w, l: z.l, pieces, cft: exportPieceCft(z.t, z.w, z.l, pieces) })),
  );
}

export const totalsOf = (lines: Line[]) => ({
  pieces: lines.reduce((a, x) => a + x.pieces, 0),
  cft: totalCft(lines.map((x) => x.cft)),
  lorries: new Set(lines.map((x) => x.loadId)).size,
});

/** "From lorry" cards, then the chosen lorry's sizes with − [n] +, and "+ Custom size". */
export function PiecesPicker({
  sources,
  qty,
  onQty,
  onAddCustom,
}: {
  sources: Source[];
  qty: Qty;
  onQty: (next: Qty) => void;
  onAddCustom: (loadId: string, size: Size) => void;
}) {
  const t = useT();
  const [pick, setPick] = useState('');
  const source = sources.find((s) => s.id === pick) ?? sources[0];
  const taken = (loadId: string) => Object.entries(qty).reduce((a, [k, v]) => (k.startsWith(`${loadId}|`) ? a + v : a), 0);
  const set = (key: string, v: number, max: number | null) => onQty({ ...qty, [key]: Math.max(0, max != null ? Math.min(v, max) : v) });

  // ── custom size ──
  const sheet = useSheet();
  const [cs, setCs] = useState({ t: '', w: '', l: '' });
  const [T, W, L] = [parseNum(cs.t), parseNum(cs.w), parseNum(cs.l)];
  const ok = [T, W, L].every((v) => v != null && v > 0 && v <= 999);
  const add = () => {
    if (!source || !ok) return;
    onAddCustom(source.id, { t: T!, w: W!, l: L!, left: null });
    setCs({ t: '', w: '', l: '' });
    sheet.close();
  };

  return (
    <>
      <GroupLabel>{t('fromLorry')}</GroupLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-2 pt-2.5" className="-mt-2.5">
        {sources.map((s) => {
          const on = s.id === source?.id;
          const n = taken(s.id);
          return (
            <Tap
              key={s.id}
              scale={0.97}
              onPress={() => setPick(s.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${s.plate ?? s.code}, ${s.code}${n ? `, ${n} ${t('pcsShort')}` : ''}`}
              className={cn('min-h-[64px] min-w-[136px] items-center justify-center rounded-2xl border-2 px-3 py-2', on ? 'border-saffron bg-saffron-soft' : 'border-control-border bg-card')}
            >
              <Text className="text-[15px] font-bold tracking-[1px] text-foreground" numberOfLines={1}>
                {s.plate ?? s.code}
              </Text>
              {!!s.plate && <Text className="text-[12px] font-medium text-muted-foreground">{s.code}</Text>}
              {n > 0 && (
                <View className="absolute -right-1.5 -top-2.5 h-7 min-w-7 items-center justify-center rounded-full border-2 border-background bg-success px-1.5">
                  <Text className="text-[12px] font-bold tabular-nums text-white">{n}</Text>
                </View>
              )}
            </Tap>
          );
        })}
      </ScrollView>

      {source && (
        <View className="mt-3 rounded-3xl bg-card px-3.5 shadow-sm shadow-black/5">
          {source.sizes.map((z) => {
            const key = sizeKey(source.id, z);
            return <SizeRow key={key} size={z} value={qty[key] ?? 0} onChange={(v) => set(key, v, z.left)} />;
          })}
          <Pressable onPress={sheet.open} accessibilityRole="button" className="min-h-[52px] flex-row items-center gap-2 active:opacity-70">
            <Icon name="plus" size={18} colorClassName="accent-saffron-strong" />
            <Text className="text-[15px] font-semibold text-saffron-strong">{t('customSize')}</Text>
          </Pressable>
        </View>
      )}

      <AppBottomSheet ref={sheet.ref} variant="medium" title={t('customSize')} footer={<SheetActions primary={{ icon: 'plus', title: t('addSize'), disabled: !ok, onPress: add }} />}>
        <View className="gap-3.5">
          <Row>
            <NumberField label={t('thickness')} unit="in" value={cs.t} onChangeText={(v) => setCs((c) => ({ ...c, t: v }))} />
            <NumberField label={t('width')} unit="in" value={cs.w} onChangeText={(v) => setCs((c) => ({ ...c, w: v }))} />
          </Row>
          <NumberField label={t('lengthFt')} unit="ft" value={cs.l} onChangeText={(v) => setCs((c) => ({ ...c, l: v }))} />
        </View>
      </AppBottomSheet>
    </>
  );
}

/** "From N lorries · Change", then each lorry (its plate and load code) with its sizes and pieces. */
export function PiecesSummary({ lines, onChange }: { lines: Line[]; /** absent: nothing can be changed */ onChange?: () => void }) {
  const t = useT();
  const groups = useMemo(() => {
    const m = new Map<string, { code: string; plate: string | null; lines: Line[] }>();
    for (const x of lines) {
      const g = m.get(x.loadId) ?? { code: x.code, plate: x.plate, lines: [] };
      g.lines.push(x);
      m.set(x.loadId, g);
    }
    return [...m.entries()];
  }, [lines]);
  return (
    <View className="mt-3 rounded-3xl bg-card px-4 pb-1 pt-3.5 shadow-sm shadow-black/5">
      <View className="flex-row items-center justify-between border-b border-border pb-3">
        <Text className="text-[15px] font-bold text-foreground">{t('fromNLorries', { n: groups.length })}</Text>
        {onChange && (
          <Pressable onPress={onChange} accessibilityRole="button" hitSlop={8} className="active:opacity-70">
            <Text className="text-[15px] font-semibold text-saffron-strong">{t('change')}</Text>
          </Pressable>
        )}
      </View>
      {groups.map(([id, g], gi) => (
        <View key={id} className={cn('gap-1 py-3', gi < groups.length - 1 && 'border-b border-border')}>
          <View className="flex-row items-center gap-2.5 pb-1">
            {g.plate ? <Plate number={g.plate} size="sm" /> : null}
            <Text className="text-[12px] font-medium text-muted-foreground">{g.code}</Text>
          </View>
          {g.lines.map((x) => (
            <View key={sizeKey(x.loadId, x)} className="min-h-9 flex-row items-center justify-between gap-3">
              <Text className="shrink text-[15px] font-semibold text-foreground">
                {n(x.t)} × {n(x.w)} · {n(x.l)} ft
              </Text>
              <Text className="text-[15px] font-bold tabular-nums text-foreground">
                {int(x.pieces)} {t('pcsShort')}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** The woods as one segmented bar; it scrolls sideways when there are many. */
export function WoodSwitch({ woods, value, onChange }: { woods: string[]; value: string; onChange: (w: string) => void }) {
  const fit = woods.length <= 3;
  const items = woods.map((w) => {
    const on = w === value;
    return (
      <Pressable
        key={w}
        onPress={() => onChange(w)}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        className={cn('min-h-[44px] items-center justify-center rounded-2xl px-4', fit && 'flex-1', on && 'bg-card shadow-sm shadow-black/10')}
      >
        <Text className={cn('text-[15px] font-semibold', on ? 'text-foreground' : 'text-muted-foreground')} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {w}
        </Text>
      </Pressable>
    );
  });
  return fit ? (
    <View className="flex-row rounded-[20px] bg-secondary p-1">{items}</View>
  ) : (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="rounded-[20px] bg-secondary" contentContainerClassName="p-1">
      {items}
    </ScrollView>
  );
}

/** One size: "4 × 2 · 8 ft", "120 left", and − [10] + (the count can also be typed). */
export function SizeRow({ size, value, onChange }: { size: Size; value: number; onChange: (v: number) => void }) {
  const t = useT();
  const full = size.left != null && value >= size.left;
  return (
    <View className="min-h-[68px] flex-row items-center gap-2 border-b border-border py-2.5">
      <View className="min-w-0 flex-1">
        <Text className="text-[18px] font-bold text-foreground font-display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {n(size.t)} × {n(size.w)}
          <Text className="text-[13px] font-semibold text-muted-foreground"> · {n(size.l)} ft</Text>
        </Text>
        {size.left != null && <Text className={cn('text-[13px] font-medium', full ? 'text-saffron-strong' : 'text-muted-foreground')}>{t('nLeft', { n: int(size.left - value) })}</Text>}
      </View>
      <Tap
        scale={0.92}
        haptic
        onPress={() => onChange(value - 1)}
        disabled={value <= 0}
        accessibilityRole="button"
        accessibilityLabel="−"
        className={cn('h-11 w-11 items-center justify-center rounded-full border-2 border-control-border bg-card', value <= 0 && 'opacity-40')}
      >
        <Icon name="minus" size={19} colorClassName="accent-foreground" />
      </Tap>
      <View className={cn('h-11 w-[58px] items-center justify-center rounded-xl border-2', value ? 'border-saffron bg-saffron-soft' : 'border-control-border bg-card')}>
        <TextInput
          value={value ? String(value) : ''}
          onChangeText={(v) => onChange(Number(v.replace(/\D/g, '') || 0))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColorClassName="accent-muted-foreground"
          maxLength={6}
          selectTextOnFocus
          accessibilityLabel={t('pieces')}
          className="w-full p-0 text-center text-[17px] font-bold tabular-nums text-foreground"
          style={fontStyleFor('font-bold')}
        />
      </View>
      <Tap
        scale={0.92}
        haptic
        onPress={() => onChange(value + 1)}
        disabled={full}
        accessibilityRole="button"
        accessibilityLabel="+"
        className={cn('h-11 w-11 items-center justify-center rounded-full bg-primary', full && 'opacity-40')}
      >
        <Icon name="plus" size={19} colorClassName="accent-primary-foreground" />
      </Tap>
    </View>
  );
}

/** The walnut card: the lorry, its wood and time, pieces and CFT, tree rings in the corner. */
export function SendCard({ plate, wood, time, pieces, cft }: { plate: string; wood: string; time: string; pieces: number; cft: number }) {
  const t = useT();
  const [ring] = useCSSVariable(['--color-hero-ring']).map(String);
  if (!pieces)
    return (
      <View className="flex-row gap-6 rounded-3xl bg-secondary p-5">
        <Figure label={t('pieces')} value="0" muted />
        <Figure label={t('totalCft')} value="0.000" muted />
      </View>
    );
  return (
    <View className="gap-3 overflow-hidden rounded-3xl bg-hero p-5">
      <TreeRings color={ring} placement="bottom-right" size={260} opacity={0.5} />
      <View className="flex-row flex-wrap items-center gap-2.5">
        {plate ? <Plate number={plate} size="md" /> : null}
        <Text className="text-[14px] font-medium text-hero-muted">
          {wood}
          {time ? ` · ${time}` : ''}
        </Text>
      </View>
      <View className="flex-row gap-6">
        <Figure label={t('pieces')} value={int(pieces)} />
        <Figure label={t('totalCft')} value={num3(cft)} />
      </View>
    </View>
  );
}

function Figure({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View>
      <Text className={cn('text-[14px] font-medium', muted ? 'text-muted-foreground' : 'text-hero-muted')}>{label}</Text>
      <Text className={cn('text-[32px] font-bold leading-[38px] tabular-nums font-display', muted ? 'text-muted-foreground/60' : 'text-hero-foreground')} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
    </View>
  );
}

/** The running total under the pieces: "40 pcs · 2 lorries" over the CFT, and a button beside it. */
export function TotalBar({ lines, button }: { lines: Line[]; button: React.ReactNode }) {
  const t = useT();
  const { pieces, cft, lorries } = totalsOf(lines);
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1">
        <Text className="text-[13px] font-medium text-muted-foreground" numberOfLines={1}>
          {t('pcsAndLorries', { pcs: int(pieces), n: lorries })}
        </Text>
        <Text className={cn('text-[24px] font-bold leading-[30px] tabular-nums font-display', pieces ? 'text-foreground' : 'text-muted-foreground/60')} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {num3(cft)} CFT
        </Text>
      </View>
      <View className="w-[128px]">{button}</View>
    </View>
  );
}
