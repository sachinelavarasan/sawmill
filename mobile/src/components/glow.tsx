/**
 * The tree-ring motif: thin concentric rings on the walnut hero surface (headline cards, the dark
 * login/lock screens). It replaces the old orange gradient; the name `Glow` is kept so every
 * surface that drew the gradient now draws the rings.
 *
 * Drawn with react-native-svg (already in the app), so it needs no extra native module.
 * Colours come from the theme tokens (--color-hero, --color-hero-ring).
 *
 * Place it as the first child of a container with `overflow-hidden`; it fills the container and
 * ignores touches.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';

/** radii of the rings, outermost first (in px; the svg is not scaled) */
const RINGS = [150, 124, 100, 78, 58, 40, 24];

export function Glow({
  variant = 'band',
}: {
  /**
   * band — a full screen or a tall surface: rings in the upper right.
   * card — a headline card: rings rising from the lower right edge.
   */
  variant?: 'band' | 'card';
}) {
  const [base, ring] = useCSSVariable(['--color-hero', '--color-hero-ring']).map((c, i) => String(c ?? ['#3d2416', '#a4744f'][i]));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Rect width="100%" height="100%" fill={base} />
      </Svg>
      <TreeRings color={ring} placement={variant === 'band' ? 'top-right' : 'bottom-right'} />
    </View>
  );
}

/**
 * Just the rings, for a light surface (an empty state's circle, the login page): pass the colour.
 * `size` is the diameter of the outermost ring.
 */
export function TreeRings({ color, placement = 'bottom-right', size = 300, opacity = 0.55 }: { color: string; placement?: 'top-right' | 'bottom-right' | 'right'; size?: number; opacity?: number }) {
  const scale = size / 300;
  const pos =
    placement === 'top-right'
      ? { right: -size * 0.28, top: -size * 0.3 }
      : placement === 'right'
        ? { right: -size * 0.45, top: '50%' as const, marginTop: -size / 2 }
        : { right: -size * 0.32, bottom: -size * 0.42 };
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, pos]}>
      <Svg width={size} height={size}>
        {RINGS.map((r) => (
          <Circle key={r} cx={size / 2} cy={size / 2} r={r * scale} stroke={color} strokeOpacity={opacity} strokeWidth={Math.max(1.5, 2.5 * scale)} fill="none" />
        ))}
      </Svg>
    </View>
  );
}
