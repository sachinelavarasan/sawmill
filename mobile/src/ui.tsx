/** Shared UI for the Android app: language, styles, small components. Colours always come from useTheme().c. */
import { Feather } from '@expo/vector-icons';
import { translate, type Lang, type ThemeColors, type TKey } from '@sawmill/shared';
import { createContext, ReactNode, useCallback, useContext, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './theme';

// ───────── language ─────────
export const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} });
export function useT() {
  const { lang } = useContext(LangCtx);
  return useCallback((k: TKey, v?: Record<string, string | number>) => translate(lang, k, v), [lang]);
}

export function useStyles() {
  const { c } = useTheme();
  return useMemo(() => makeStyles(c), [c]);
}

// ───────── formatting ─────────
export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
export const num3 = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const dateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
export const timeOnly = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '—';

// ───────── components ─────────

/** `onHero` = sitting on the dark slate app bar rather than on a card. */
export function LangToggle({ onHero }: { onHero?: boolean }) {
  const { lang, setLang } = useContext(LangCtx);
  const s = useStyles();
  return (
    <View style={[s.langToggle, onHero && s.langToggleHero]}>
      {(['en', 'ta'] as const).map((l) => {
        const on = lang === l;
        return (
          <Pressable
            key={l}
            onPress={() => setLang(l)}
            accessibilityRole="button"
            accessibilityLabel={l === 'en' ? 'English' : 'தமிழ்'}
            accessibilityState={{ selected: on }}
            style={[s.langBtn, onHero && s.langBtnHero, on && (onHero ? s.langBtnOnHero : s.langBtnOn)]}
          >
            <Text style={[s.langText, onHero && s.langTextHero, on && (onHero ? s.langTextOnHero : s.langTextOn)]}>
              {l === 'en' ? 'EN' : onHero ? 'த' : 'தமிழ்'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ThemeToggle({ onHero }: { onHero?: boolean }) {
  const { name, c, toggle } = useTheme();
  const t = useT();
  const s = useStyles();
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={name === 'dark' ? t('lightTheme') : t('darkTheme')}
      style={[s.iconBtn, onHero && s.iconBtnHero]}
    >
      <Feather name={name === 'dark' ? 'sun' : 'moon'} size={20} color={onHero ? c.heroText : c.text} />
    </Pressable>
  );
}

/** Slate bar with a back arrow, used by every pushed screen. */
export function BackBar({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack: () => void; right?: ReactNode }) {
  const { c } = useTheme();
  const t = useT();
  const s = useStyles();
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} style={[s.iconBtn, s.iconBtnHero]} accessibilityRole="button" accessibilityLabel={t('back')}>
        <Feather name="arrow-left" size={22} color={c.heroText} />
      </Pressable>
      <View style={s.fill}>
        <Text style={s.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={s.headerSub} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  const s = useStyles();
  return <View style={s.grid}>{children}</View>;
}

export type Tone = 'warn' | 'good' | 'bad';

export function useToneColors(): Record<Tone, { fg: string; bg: string }> {
  const { c } = useTheme();
  return {
    warn: { fg: c.accent, bg: c.accentSoft },
    good: { fg: c.ok, bg: c.okSoft },
    bad: { fg: c.bad, bg: c.badSoft },
  };
}

export function Kpi({ label, value, unit, tone }: { label: string; value: string | number; unit?: string; tone?: Tone }) {
  const s = useStyles();
  const tones = useToneColors();
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, tone && { color: tones[tone].fg }]}>
        {value}
        {unit ? <Text style={s.kpiUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export function Pill({ tone, text }: { tone?: Tone; text: string }) {
  const s = useStyles();
  const tones = useToneColors();
  return (
    <View style={[s.pill, tone && { backgroundColor: tones[tone].bg }]}>
      <Text style={[s.pillText, tone && { color: tones[tone].fg }]}>{text}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const t = useT();
  const map: Record<string, { key: TKey; tone?: Tone }> = {
    DRAFT: { key: 'draft' },
    SUBMITTED: { key: 'pending', tone: 'warn' },
    APPROVED: { key: 'approved', tone: 'good' },
    REJECTED: { key: 'rejected', tone: 'bad' },
  };
  const m = map[status];
  return <Pill tone={m?.tone} text={m ? t(m.key) : status} />;
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  busy,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  icon?: keyof typeof Feather.glyphMap;
  disabled?: boolean;
  busy?: boolean;
}) {
  const { c } = useTheme();
  const s = useStyles();
  const off = disabled && !busy;
  const fg = kind === 'primary' ? (off ? c.muted : c.onPrimary) : kind === 'danger' ? c.bad : c.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={[
        kind === 'primary' ? s.btnPrimary : kind === 'danger' ? s.btnDanger : s.btnSecondary,
        { marginTop: 0 },
        off && kind === 'primary' ? s.btnPrimaryOff : (disabled || busy) && { opacity: 0.55 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={s.row}>
          {icon && <Feather name={icon} size={18} color={fg} />}
          <Text style={[s.btnPrimaryText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Loading() {
  const { c } = useTheme();
  return <ActivityIndicator color={c.primary} style={{ marginTop: 32 }} />;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  const s = useStyles();
  return (
    <View style={[s.errorBox]}>
      <Text style={s.errorText}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} accessibilityRole="button" style={s.errorRetry}>
          <Text style={s.errorRetryText}>{t('retry')}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ───────── styles ─────────
export const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    fill: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },

    // login: slate hero on top, form as a sheet rising from the bottom
    loginScroll: { flexGrow: 1 },
    loginHero: { flexGrow: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
    brandMarkLarge: { width: 84, height: 84, marginBottom: 10 },
    loginTitle: { color: c.heroText, fontSize: 30, fontWeight: '700', letterSpacing: 0.5 },
    loginTagline: { color: c.heroMuted, fontSize: 15 },
    loginCard: {
      backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingHorizontal: 24, paddingTop: 28, paddingBottom: 36, gap: 18,
    },
    h2: { fontSize: 22, fontWeight: '700', color: c.text },
    field: { gap: 6 },
    label: { fontSize: 14, fontWeight: '600', color: c.text },
    input: {
      borderWidth: 1.5, borderColor: c.border, borderRadius: 12, paddingHorizontal: 16, minHeight: 52,
      fontSize: 16, color: c.text, backgroundColor: c.surface,
    },
    inputFocused: { borderColor: c.primary },
    error: { color: c.bad, backgroundColor: c.badSoft, padding: 12, borderRadius: 10, fontSize: 14 },
    btnPrimary: { backgroundColor: c.primary, borderRadius: 12, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 4, paddingHorizontal: 16 },
    btnPrimaryOff: { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
    btnPrimaryText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    btnSecondary: {
      borderWidth: 1.5, borderColor: c.primary, backgroundColor: c.surface, borderRadius: 12, minHeight: 50,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16,
    },
    btnDanger: {
      borderWidth: 1.5, borderColor: c.bad, backgroundColor: c.surface, borderRadius: 12, minHeight: 50,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16,
    },

    langToggle: { flexDirection: 'row', padding: 3, borderWidth: 1, borderColor: c.border, borderRadius: 10, backgroundColor: c.surface2 },
    langToggleHero: { borderColor: '#5C8A73', backgroundColor: 'transparent' },
    langBtn: { minHeight: 38, paddingHorizontal: 10, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    langBtnHero: { minHeight: 34, minWidth: 34, paddingHorizontal: 8 },
    langBtnOn: { backgroundColor: c.primary },
    langBtnOnHero: { backgroundColor: '#FFFFFF' },
    langText: { fontSize: 13, fontWeight: '600', color: c.muted },
    langTextHero: { color: c.heroMuted },
    langTextOn: { color: c.onPrimary },
    langTextOnHero: { color: '#1E262E' },

    iconBtn: {
      width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
    },
    iconBtnHero: { borderColor: 'transparent', backgroundColor: 'transparent' },

    // app bar
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8, paddingRight: 8, paddingVertical: 10, backgroundColor: c.hero, minHeight: 60 },
    brandMark: { width: 40, height: 40, marginLeft: 8, marginRight: 4 },
    headerTitle: { color: c.heroText, fontWeight: '700', fontSize: 16 },
    headerSub: { color: c.heroMuted, fontSize: 12 },

    body: { padding: 16, paddingBottom: 32, gap: 12 },
    h1: { fontSize: 24, fontWeight: '700', color: c.text, letterSpacing: -0.4 },
    section: { fontSize: 12, fontWeight: '700', color: c.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8 },
    sectionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    lockChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: c.primarySoft },
    lockChipText: { fontSize: 11, fontWeight: '600', color: c.primary },

    pendingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: c.accentSoft },
    pendingCount: { minWidth: 40, height: 40, paddingHorizontal: 8, borderRadius: 20, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    pendingCountText: { color: c.surface, fontSize: 17, fontWeight: '700' },
    pendingText: { flex: 1, color: c.accent, fontSize: 15, fontWeight: '600' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    kpi: {
      flexBasis: '47%', flexGrow: 1, backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      borderWidth: 1, borderColor: c.border, gap: 6,
    },
    kpiLabel: { fontSize: 12, fontWeight: '500', color: c.muted },
    kpiValue: { fontSize: 21, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'] },
    kpiUnit: { fontSize: 12, fontWeight: '600', color: c.muted },

    heroCard: { backgroundColor: c.primary, borderRadius: 14, padding: 16, gap: 4 },
    heroCardLabel: { color: c.onPrimary, opacity: 0.85, fontSize: 13, fontWeight: '500' },
    heroCardValue: { color: c.onPrimary, fontSize: 30, fontWeight: '700', fontVariant: ['tabular-nums'] },

    card: { backgroundColor: c.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border, gap: 10 },
    cardTitle: { fontWeight: '600', fontSize: 15, color: c.text },
    cardNumber: { fontWeight: '700', fontSize: 15, color: c.text, fontVariant: ['tabular-nums'] },
    avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: c.text, fontSize: 14, fontWeight: '700' },
    muted: { color: c.muted, fontSize: 13 },
    text: { color: c.text, fontSize: 15 },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: c.surface2 },
    pillText: { fontSize: 12, fontWeight: '600', color: c.muted },
    statRow: { flexDirection: 'row', gap: 16 },
    statText: { fontSize: 14, color: c.text, fontVariant: ['tabular-nums'] },
    statStrong: { fontWeight: '700' },
    reason: { color: c.bad, backgroundColor: c.badSoft, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, fontSize: 13 },
    notice: { color: c.accent, backgroundColor: c.accentSoft, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, fontSize: 14, fontWeight: '600' },

    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, backgroundColor: c.badSoft },
    errorText: { flex: 1, color: c.bad, fontSize: 14 },
    errorRetry: { paddingHorizontal: 12, minHeight: 36, borderRadius: 8, justifyContent: 'center', backgroundColor: c.surface },
    errorRetryText: { color: c.bad, fontWeight: '700' },

    // bottom tabs
    tabBar: { flexDirection: 'row', borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 58, gap: 3 },
    tabPill: { width: 56, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    tabPillOn: { backgroundColor: c.primarySoft },
    tabText: { fontSize: 12, fontWeight: '600', color: c.muted },
    tabTextOn: { color: c.primary },

    // lists & forms
    chip: { paddingHorizontal: 12, minHeight: 36, borderRadius: 999, justifyContent: 'center', backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
    chipOn: { backgroundColor: c.primarySoft, borderColor: c.primary },
    chipText: { fontSize: 14, fontWeight: '600', color: c.text },
    kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    kvKey: { color: c.muted, fontSize: 14 },
    kvVal: { color: c.text, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
    divider: { height: 1, backgroundColor: c.border },
    fab: {
      position: 'absolute', right: 16, bottom: 16, minHeight: 56, paddingHorizontal: 20, borderRadius: 28,
      backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 4,
    },
    fabText: { color: c.onPrimary, fontWeight: '700', fontSize: 16 },

    // measurement
    mStats: { flexDirection: 'row', gap: 10 },
    mStat: { flex: 1, borderRadius: 14, padding: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 2 },
    mStatPrimary: { backgroundColor: c.primary, borderColor: c.primary },
    mStatLabel: { fontSize: 12, fontWeight: '600', color: c.muted },
    mStatValue: { fontSize: 24, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'] },
    mLogHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    mLogNo: { fontSize: 20, fontWeight: '700', color: c.text },
    mLive: { fontSize: 22, fontWeight: '700', color: c.accent, fontVariant: ['tabular-nums'] },
    mInputs: { flexDirection: 'row', gap: 10 },
    mInput: { flex: 1, borderWidth: 2, borderColor: c.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: c.surface, minHeight: 80 },
    mInputOn: { borderColor: c.primary, backgroundColor: c.primarySoft },
    mInputLabel: { fontSize: 13, fontWeight: '600', color: c.muted },
    mInputValue: { fontSize: 32, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'] },
    mRecent: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 12, borderRadius: 10, backgroundColor: c.surface },
    mRecentOn: { borderWidth: 2, borderColor: c.accent },
    keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    key: { width: '31.8%', height: 56, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    keyText: { fontSize: 24, fontWeight: '600', color: c.text },
  });
