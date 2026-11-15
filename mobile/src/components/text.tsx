/**
 * Typography: Inter everywhere.
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
};

export type FontName = keyof typeof FONT_FILES;

const WEIGHT_CLASS: [RegExp, FontName][] = [
  [/(^|\s)font-(extrabold|black)(\s|$)/, 'Inter_800ExtraBold'],
  [/(^|\s)font-bold(\s|$)/, 'Inter_700Bold'],
  [/(^|\s)font-semibold(\s|$)/, 'Inter_600SemiBold'],
  [/(^|\s)font-medium(\s|$)/, 'Inter_500Medium'],
  [/(^|\s)font-(normal|light|thin|extralight)(\s|$)/, 'Inter_400Regular'],
];

/** The Inter file for a class string, or null when it names no weight. */
export function fontFor(className?: string): FontName | null {
  if (!className) return null;
  for (const [re, f] of WEIGHT_CLASS) if (re.test(className)) return f;
  return null;
}

/** The weight is in the file; a fontWeight on top would make Android fake-bold it again. */
const fontStyle = (f: FontName): TextStyle => ({ fontFamily: f, fontWeight: 'normal' });

const Nested = createContext(false);

export const Text = forwardRef<RNText, TextProps & { className?: string }>(function Text({ className, style, ...rest }, ref) {
  const nested = useContext(Nested);
  const f = fontFor(className) ?? (nested ? null : 'Inter_400Regular');
  const el = <RNText ref={ref} {...rest} className={className} style={f ? [fontStyle(f), style] : style} />;
  return nested ? el : <Nested.Provider value>{el}</Nested.Provider>;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps & { className?: string }>(function TextInput({ className, style, ...rest }, ref) {
  return <RNTextInput ref={ref} {...rest} className={className} style={[fontStyle(fontFor(className) ?? 'Inter_400Regular'), style]} />;
});

/** For components that take a style rather than a className (calendar, bottom-sheet input). */
export const fontStyleFor = (className?: string) => fontStyle(fontFor(className) ?? 'Inter_400Regular');
