/**
 * The calculator for measuring, as on the web (web/src/components/calc-pad.tsx): a dark display
 * with the numbers being typed and the working, a big keypad whose "=" saves, and the list of
 * saved entries, newest first — the way the mill already works with a hand calculator and a
 * notebook. Used for logs (length × girth), and later load-out lines and sawn sizes
 * (thickness × width × length × pieces).
 *
 *   7 8 9 ⌫
 *   4 5 6 C
 *   1 2 3 =     "=" reads "Next →" until the last box, then "= Save"
 *   0 . Clear all
 *
 * The keypad means no phone keyboard covers the screen. CalcPad is the display + keys; CalcTape
 * is the entries list, placed by the screen (below the keys on a phone).
 */
import { type ReactNode, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { num3 } from '../lib/format';
import { useT } from '../lib/i18n';
import { Tap } from './motion';
import { Text } from './text';
import { cn, Icon } from './ui';

export interface CalcField {
  key: string;
  label: string;
  /** shown after the value, e.g. "in", "ft" */
  unit?: string;
  value: string;
  /** whole numbers only (pieces): the "." key is off */
  integer?: boolean;
  /** a short note in the box, e.g. "same as last" */
  note?: string;
  /** the value is carried over (not typed): the first key replaces it instead of adding to it */
  replaceOnType?: boolean;
}

/** One saved entry in the list. */
export interface CalcEntry {
  key: string;
  /** its number (#12); null shows "—" */
  no: number | null;
  /** the measurements, e.g. "8 ft × 9 in" */
  label: string;
  /** a smaller second line (the source load, "waiting to send" …) */
  sub?: string;
  subTone?: 'info' | 'bad';
  cft: number;
  /** red: something is wrong with it (more than in stock) */
  warn?: boolean;
  /** crossed out: not counted (a log the server refused) */
  strike?: boolean;
  /** just saved: briefly highlighted */
  fresh?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const MAX_DIGITS = 6;

/** What a key press does to a typed value; null = the press is not allowed. */
function typeKey(value: string, key: string, integer: boolean): string | null {
  if (key === 'back') return value.slice(0, -1);
  if (key === 'clear') return '';
  if (key === '.') {
    if (integer || value.includes('.')) return null;
    return `${value || '0'}.`;
  }
  const [whole, dec] = value.split('.');
  if (dec !== undefined && dec.length >= 2) return null; // two decimals, as everywhere else
  if (whole.length + (dec?.length ?? 0) >= MAX_DIGITS) return null;
  if (value === '0') return key;
  return value + key;
}

/** Number keys: white with a visible border, so each one stands out on the grey panel. */
const NUM_KEY = 'border border-input bg-card';
/** ⌫, C, Clear all, Next: soft orange with orange text, so they never read as numbers. */
const FN_KEY = 'border border-saffron/30 bg-saffron-soft';
const KEY_H = 'h-[58px]';

function Key({
  label,
  onPress,
  className,
  a11y,
  disabled,
}: {
  label: ReactNode;
  onPress: () => void;
  className: string;
  a11y: string;
  disabled?: boolean;
}) {
  return (
    <Tap
      scale={0.94}
      haptic
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !!disabled }}
      className={cn('flex-1 items-center justify-center rounded-xl active:opacity-75', className, disabled && 'opacity-35')}
    >
      {typeof label === 'string' ? <Text className="text-[26px] font-semibold tabular-nums text-foreground">{label}</Text> : label}
    </Tap>
  );
}

export function CalcPad({
  title,
  fields,
  onChange,
  active,
  setActive,
  result,
  formula,
  total,
  totalLabel,
  problem,
  canSave,
  busy,
  onSave,
  saveLabel,
  afterSave = 0,
  editing,
  extra,
}: {
  /** what is being entered, e.g. "Log # 12" */
  title: string;
  fields: CalcField[];
  onChange: (key: string, value: string) => void;
  /** which box the keys type into */
  active: number;
  setActive: (i: number) => void;
  /** this entry's CFT, null while incomplete */
  result: number | null;
  /** the working: "12 × 48 × 48 ÷ 2304", or the formula in words before anything is typed */
  formula: string;
  /** the total with this entry */
  total: number;
  totalLabel: string;
  /** why it can't be saved yet, in words */
  problem?: string | null;
  canSave: boolean;
  busy?: boolean;
  /** return false when the save did not happen (the cursor then stays put) */
  onSave: () => Promise<boolean | void> | boolean | void;
  saveLabel: string;
  /** the box to type into after a save (the one that usually changes next) */
  afterSave?: number;
  /** a saved entry loaded into the keys to be corrected */
  editing?: { label: string; onCancel: () => void } | null;
  /** shown in the display under the numbers (e.g. which load the pieces come from) */
  extra?: ReactNode;
}) {
  const t = useT();
  const field = fields[active] ?? fields[0];
  const ready = canSave && !busy;
  const allFilled = fields.every((f) => f.value);
  const last = active === fields.length - 1 || (ready && allFilled);

  const press = (key: string) => {
    const from = field.replaceOnType && key !== 'back' && key !== 'clear' ? '' : field.value;
    const next = field.replaceOnType && key === 'back' ? '' : typeKey(from, key, !!field.integer);
    if (next != null) onChange(field.key, next);
  };
  const clearAll = () => {
    fields.forEach((f) => onChange(f.key, ''));
    setActive(0);
  };

  /** set at once (props update later): a second "=" while saving is ignored, not saved twice */
  const saving = useRef(false);
  const save = async () => {
    if (!ready || saving.current) return;
    saving.current = true;
    try {
      if ((await onSave()) !== false) setActive(afterSave);
    } finally {
      saving.current = false;
    }
  };
  /** Next, or "=" on the last box: move on while something is missing, save once it is all there */
  const enter = () => {
    if (active < fields.length - 1 && !(ready && allFilled)) return setActive(active + 1);
    if (ready) return void save();
    const empty = fields.findIndex((f) => !f.value);
    setActive(empty >= 0 ? empty : active);
  };

  const fnText = (s: string, size = 'text-[22px]') => <Text className={cn(size, 'font-semibold text-saffron-strong')}>{s}</Text>;

  return (
    <View className="gap-3 rounded-3xl bg-background p-3">
      {/* the display */}
      <View className="gap-3 rounded-2xl bg-hero p-4" accessibilityLiveRegion="polite">
        {editing && (
          <View className="-mx-1 flex-row items-center justify-between gap-2 rounded-xl bg-saffron/20 py-1.5 pl-3 pr-1">
            <View className="flex-1 flex-row items-center gap-2">
              <Icon name="edit-2" size={15} colorClassName="accent-saffron" />
              <Text className="flex-1 text-[14px] font-semibold text-hero-foreground" numberOfLines={1}>
                {editing.label}
              </Text>
            </View>
            <Pressable onPress={editing.onCancel} accessibilityRole="button" hitSlop={6} className="flex-row items-center gap-1 rounded-lg px-2.5 py-1.5 active:bg-hero-border">
              <Icon name="x" size={15} colorClassName="accent-hero-foreground" />
              <Text className="text-[14px] font-semibold text-hero-foreground">{t('cancel')}</Text>
            </Pressable>
          </View>
        )}
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-[13px] font-semibold text-hero-foreground">{editing ? '' : title}</Text>
          <Text className="shrink text-right text-[13px] tabular-nums text-hero-muted" numberOfLines={1}>
            {totalLabel}: <Text className="font-semibold text-hero-foreground">{num3(total)}</Text> CFT
          </Text>
        </View>

        {/* the numbers being typed: tap one to type into it */}
        <View className="flex-row flex-wrap gap-2">
          {fields.map((f, i) => {
            const on = i === active;
            return (
              <Pressable
                key={f.key}
                onPress={() => setActive(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${f.label} ${f.value || '0'}`}
                className={cn('min-h-[78px] grow basis-[45%] justify-between rounded-xl border-2 px-3 py-2', on ? 'border-saffron bg-hero-chip' : 'border-transparent bg-hero-chip/60')}
              >
                <View className="flex-row items-center justify-between gap-1">
                  <Text className="shrink text-[12px] font-medium text-hero-muted" numberOfLines={1}>
                    {f.label}
                  </Text>
                  {!!f.note && (
                    <Text className="text-[11px] font-semibold text-saffron" numberOfLines={1}>
                      {f.note}
                    </Text>
                  )}
                </View>
                <View className="flex-row items-baseline gap-1">
                  <Text className={cn('text-[30px] font-bold leading-9 tabular-nums font-display', f.value ? 'text-hero-foreground' : 'text-hero-muted/60')}>{f.value || '0'}</Text>
                  {on && <View className="h-6 w-0.5 self-center bg-saffron" />}
                  {/* the unit, unless the label already says it ("Girth (in)") */}
                  {!!f.unit && !f.label.includes(`(${f.unit})`) && <Text className="text-sm font-medium text-hero-muted">{f.unit}</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>

        {extra}

        <View className="gap-1 border-t border-hero-border pt-3">
          <Text className="text-[13px] tabular-nums text-hero-muted">{formula}</Text>
          <Text className="self-end text-[38px] font-bold leading-[44px] tabular-nums text-hero-foreground font-display" accessibilityLabel={`${result != null ? num3(result) : '0.000'} CFT`}>
            {result != null ? `= ${num3(result)}` : '0.000'}
            <Text className="text-base font-medium text-hero-muted"> CFT</Text>
          </Text>
        </View>
        {!!problem && (
          <Text className="text-[13px] font-medium text-saffron" accessibilityRole="alert">
            {problem}
          </Text>
        )}
      </View>

      {/* the keypad: three number columns, and a function column whose "=" is two keys tall */}
      <View className="flex-row gap-2">
        <View className="flex-[3] gap-2">
          {[
            ['7', '8', '9'],
            ['4', '5', '6'],
            ['1', '2', '3'],
          ].map((row) => (
            <View key={row[0]} className={cn('flex-row gap-2', KEY_H)}>
              {row.map((k) => (
                <Key key={k} label={k} a11y={k} onPress={() => press(k)} className={NUM_KEY} />
              ))}
            </View>
          ))}
          <View className={cn('flex-row gap-2', KEY_H)}>
            <Key label="0" a11y="0" onPress={() => press('0')} className={NUM_KEY} />
            <Key label="." a11y="." onPress={() => press('.')} className={NUM_KEY} disabled={!!field.integer} />
            <Key label={fnText(t('calcClearAll'), 'text-[14px] text-center')} a11y={t('calcClearAll')} onPress={clearAll} className={FN_KEY} />
          </View>
        </View>
        <View className="flex-1 gap-2">
          <View className={KEY_H}>
            <Key label={<Icon name="delete" size={26} colorClassName="accent-saffron-strong" />} a11y={t('delete')} onPress={() => press('back')} className={FN_KEY} />
          </View>
          <View className={KEY_H}>
            <Key label={fnText('C')} a11y={t('clear')} onPress={() => press('clear')} className={FN_KEY} />
          </View>
          <View className="flex-1">
            <Key
              a11y={last ? saveLabel : t('next')}
              // never greyed out: while it can't save, it is a dashed orange outline, and a press moves to the empty box
              onPress={enter}
              className={!last ? FN_KEY : ready ? 'bg-saffron' : 'border-2 border-dashed border-saffron/60 bg-card'}
              label={
                last ? (
                  <View className="items-center">
                    <Text className={cn('text-[34px] font-bold leading-9', ready ? 'text-saffron-foreground' : 'text-saffron-strong/70')}>=</Text>
                    <Text className={cn('text-[13px] font-semibold', ready ? 'text-saffron-foreground' : 'text-saffron-strong/70')}>{t('calcEquals')}</Text>
                  </View>
                ) : (
                  <View className="items-center gap-0.5">
                    <Text className="text-[16px] font-semibold text-saffron-strong">{t('next')}</Text>
                    <Icon name="arrow-right" size={20} colorClassName="accent-saffron-strong" />
                  </View>
                )
              }
            />
          </View>
        </View>
      </View>
    </View>
  );
}

/** Everything saved so far, newest on top, with Edit and Delete on each row and the total underneath. */
export function CalcTape({ title, entries, total, empty, selectedKey }: { title: string; entries: CalcEntry[]; total: number; empty?: string; selectedKey?: string | null }) {
  const t = useT();
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card">
      <View className="flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
        <Text className="text-[15px] font-semibold text-foreground">{title}</Text>
        <View className="min-w-7 items-center rounded-full bg-secondary px-2">
          <Text className="text-xs font-bold leading-6 tabular-nums text-foreground">{entries.length}</Text>
        </View>
      </View>
      {entries.length === 0 ? (
        <Text className="px-4 py-8 text-center text-sm text-muted-foreground">{empty ?? t('calcTapeEmpty')}</Text>
      ) : (
        entries.map((e, i) => (
          <Pressable
            key={e.key}
            onPress={e.onEdit}
            disabled={!e.onEdit}
            accessibilityHint={e.onEdit ? t('edit') : undefined}
            className={cn(
              'min-h-[52px] flex-row items-center gap-2 py-1.5 pl-4 pr-1.5 active:bg-secondary',
              i < entries.length - 1 && 'border-b border-border',
              selectedKey === e.key ? 'bg-saffron-soft' : e.fresh && 'bg-success-soft',
            )}
          >
            <Text className="w-10 text-[13px] font-semibold tabular-nums text-muted-foreground">{e.no == null ? '—' : `#${e.no}`}</Text>
            <View className="flex-1">
              <Text className={cn('text-[15px] font-medium tabular-nums', e.warn ? 'text-destructive' : 'text-foreground')} numberOfLines={1}>
                {e.label}
              </Text>
              {!!e.sub && (
                <Text className={cn('text-[12px] font-medium', e.subTone === 'bad' ? 'text-destructive' : e.subTone === 'info' ? 'text-info' : 'text-muted-foreground')} numberOfLines={2}>
                  {e.sub}
                </Text>
              )}
            </View>
            <Text className={cn('text-[15px] font-bold tabular-nums', e.strike ? 'text-muted-foreground line-through' : 'text-foreground')}>{num3(e.cft)}</Text>
            {e.onEdit && (
              <Pressable onPress={e.onEdit} accessibilityRole="button" accessibilityLabel={`${t('edit')} ${e.no == null ? '' : `#${e.no}`}`} className="h-10 w-10 items-center justify-center rounded-lg active:bg-secondary">
                <Icon name="edit-2" size={17} colorClassName="accent-muted-foreground" />
              </Pressable>
            )}
            {e.onDelete && (
              <Pressable onPress={e.onDelete} accessibilityRole="button" accessibilityLabel={`${t('delete')} ${e.no == null ? '' : `#${e.no}`}`} className="h-10 w-10 items-center justify-center rounded-lg active:bg-destructive-soft">
                <Icon name="trash-2" size={17} colorClassName="accent-destructive" />
              </Pressable>
            )}
          </Pressable>
        ))
      )}
      <View className="flex-row items-baseline justify-between gap-3 border-t-2 border-border bg-secondary px-4 py-3">
        <Text className="text-sm font-semibold text-foreground">{t('total')}</Text>
        <Text className="text-xl font-bold tabular-nums text-foreground font-display">
          {num3(total)} <Text className="text-xs font-medium text-muted-foreground">CFT</Text>
        </Text>
      </View>
    </View>
  );
}
