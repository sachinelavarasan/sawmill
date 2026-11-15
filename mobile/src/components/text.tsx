/**
 * Typography: two families.
 *   Inter   — everything you read: body, labels, lists, forms, small print.
 *   Plus Jakarta Sans — display: screen and section titles, the big figures, the wordmark.
 *             Opt in with the `font-display` class (Text picks Plus Jakarta Sans at the class's weight).
 * Both have tabular figures, so `tabular-nums` keeps columns of numbers aligned.
 *
 * React Native can't pick a weight from one font family on Android, so each weight is
 * its own font file. This `Text` reads the weight class you already write
 * (`font-semibold`, `font-bold` …) and swaps in the matching Inter file, so screens
 * keep using plain Tailwind classes. Nested Text without a weight class inherits its
 * parent's font, exactly as React Native does.
 *
 * Tamil has no glyphs in Inter; Android falls back to the system Tamil font per glyph.
 *
 * Import `Text` / `TextInput` from here, never from 'react-native'.
 */
import { createContext, forwardRef, useContext } from 'react';
import { Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps, type TextStyle } from 'react-native';

/** The font files, registered with expo-font in the root layout. */
export const FONT_FILES = {
  Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
  Inter_800ExtraBold: require('@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf'),
  PlusJakartaSans_500Medium: require('@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf'),
  PlusJakartaSans_600SemiBold: require('@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf'),
  PlusJakartaSans_700Bold: require('@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf'),
  PlusJakartaSans_800ExtraBold: require('@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf'),
};

export type FontName = keyof typeof FONT_FILES;

const WEIGHT_CLASS: [RegExp, FontName][] = [
  [/(^|\s)font-(extrabold|black)(\s|$)/, 'Inter_800ExtraBold'],
  [/(^|\s)font-bold(\s|$)/, 'Inter_700Bold'],
  [/(^|\s)font-semibold(\s|$)/, 'Inter_600SemiBold'],
  [/(^|\s)font-medium(\s|$)/, 'Inter_500Medium'],
  [/(^|\s)font-(normal|light|thin|extralight)(\s|$)/, 'Inter_400Regular'],
];

const DISPLAY = /(^|\s)font-display(\s|$)/;

/** Inter weight → the Plus Jakarta Sans file used for display text (display starts at Medium). */
const DISPLAY_FILE: Record<string, FontName> = {
  Inter_400Regular: 'PlusJakartaSans_500Medium',
  Inter_500Medium: 'PlusJakartaSans_500Medium',
  Inter_600SemiBold: 'PlusJakartaSans_600SemiBold',
  Inter_700Bold: 'PlusJakartaSans_700Bold',
  Inter_800ExtraBold: 'PlusJakartaSans_800ExtraBold',
};

/** The font file for a class string, or null when it names neither a weight nor `font-display`. */
export function fontFor(className?: string): FontName | null {
  if (!className) return null;
  let weight: FontName | null = null;
  for (const [re, f] of WEIGHT_CLASS)
    if (re.test(className)) {
      weight = f;
      break;
    }
  if (DISPLAY.test(className)) return DISPLAY_FILE[weight ?? 'Inter_700Bold'];
  return weight;
}

/** The weight is in the file; a fontWeight on top would make Android fake-bold it again. */
const fontStyle = (f: FontName): TextStyle => ({ fontFamily: f, fontWeight: 'normal' });

/** Tailwind's named sizes, in px. */
const NAMED_SIZE: Record<string, number> = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48 };
const SIZE = /(?:^|\s)text-(?:\[(\d+(?:\.\d+)?)px\]|(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl))(?:\s|$)/;
const LEADING = /(?:^|\s)leading-\[(\d+(?:\.\d+)?)px\](?:\s|$)/;

/**
 * Plus Jakarta Sans sits taller than Inter (its ascent + descent run to about 1.3 × the size, Inter 1.22).
 * Tailwind's size classes bring line heights as low as 1.11 ×, and Android cuts off whatever
 * sticks out of the line box — the tops of capitals and the tails of g/y/₹. So display text
 * always gets a line box tall enough for the font (a larger leading-[…] still wins).
 */
const DISPLAY_LINE = 1.32;
function displayLineHeight(className: string): number | undefined {
  const m = SIZE.exec(className);
  if (!m) return undefined;
  const size = m[1] ? Number(m[1]) : NAMED_SIZE[m[2]];
  const min = Math.ceil(size * DISPLAY_LINE);
  const lead = LEADING.exec(className);
  return lead ? Math.max(min, Number(lead[1])) : min;
}

const Nested = createContext(false);

export const Text = forwardRef<RNText, TextProps & { className?: string }>(function Text({ className, style, ...rest }, ref) {
  const nested = useContext(Nested);
  const f = fontFor(className) ?? (nested ? null : 'Inter_400Regular');
  const lineHeight = f?.startsWith('PlusJakartaSans') && className ? displayLineHeight(className) : undefined;
  const base = f ? (lineHeight ? { ...fontStyle(f), lineHeight } : fontStyle(f)) : null;
  const el = <RNText ref={ref} {...rest} className={className} style={base ? [base, style] : style} />;
  return nested ? el : <Nested.Provider value>{el}</Nested.Provider>;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps & { className?: string }>(function TextInput({ className, style, ...rest }, ref) {
  return <RNTextInput ref={ref} {...rest} className={className} style={[fontStyle(fontFor(className) ?? 'Inter_400Regular'), style]} />;
});

/** For components that take a style rather than a className (calendar, bottom-sheet input). */
export const fontStyleFor = (className?: string) => fontStyle(fontFor(className) ?? 'Inter_400Regular');
