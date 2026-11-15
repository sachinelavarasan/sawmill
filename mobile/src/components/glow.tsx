/**
 * The warm gradient behind the app bar, the home band and the headline cards: orange at the top
 * melting through burnt orange into warm black, with a soft light bloom in the upper right.
 * Drawn with react-native-svg (already in the app), so it needs no extra native module.
 * Colours come from the theme tokens (--color-hero-top / -mid / hero).
 *
 * Place it as the first child of a container with `overflow-hidden`; it fills the container and
 * ignores touches.
 */
import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';

export function Glow({
  variant = 'band',
}: {
  /**
   * band — the top of a screen: orange fades down into the dark.
   * card — a headline card: dark, with the orange rising from its lower left (like a lit edge).
   */
  variant?: 'band' | 'card';
}) {
  const id = useId().replace(/:/g, '');
  const [top, mid, base] = useCSSVariable(['--color-hero-top', '--color-hero-mid', '--color-hero']).map((c, i) => String(c ?? ['#f06a1c', '#9c3f12', '#17110e'][i]));
  const band = variant === 'band';
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`${id}l`} x1="0" y1="0" x2={band ? '0.25' : '1'} y2="1">
            {(band
              ? [
                  [0, top, 1],
                  [0.45, mid, 1],
                  [1, base, 1],
                ]
              : [
                  [0, base, 1],
                  [0.55, mid, 0.85],
                  [1, top, 1],
                ]
            ).map(([offset, color, opacity]) => (
              <Stop key={String(offset)} offset={String(offset)} stopColor={String(color)} stopOpacity={String(opacity)} />
            ))}
          </LinearGradient>
          <RadialGradient id={`${id}r`} cx={band ? '0.85' : '0.9'} cy={band ? '0.05' : '0.1'} r="0.6">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={band ? '0.28' : '0.16'} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={base} />
        <Rect width="100%" height="100%" fill={`url(#${id}l)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}r)`} />
      </Svg>
    </View>
  );
}
