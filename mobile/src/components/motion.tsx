/**
 * Motion: small, quick, purposeful (Reanimated 4).
 *
 *  - `Tap`     — a Pressable that springs down a little while pressed (cards, buttons, chips).
 *  - `Appear`  — fades a block up into place when it mounts, staggered by `index`.
 *  - `tick()`  — the light selection haptic used when a choice changes (tabs, chips, switches).
 *
 * Every spring and entrance follows the phone's "Remove animations" setting
 * (Reanimated's ReduceMotion.System default), so nothing moves for people who turned it off.
 */
import * as Haptics from 'expo-haptics';
import { forwardRef, type ReactNode, useEffect } from 'react';
import { type GestureResponderEvent, Pressable, type PressableProps, type View as RNView, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export const AnimatedView = Animated.createAnimatedComponent(View);

/** Press-in is quick and firm; the release overshoots a touch so it feels springy, not rubbery. */
export const SPRING_PRESS = { damping: 20, stiffness: 400, mass: 0.6 } as const;
export const SPRING_RELEASE = { damping: 14, stiffness: 260, mass: 0.6 } as const;
/** Indicators that slide between options (tab bar, segmented control, switch). */
export const SPRING_SLIDE = { damping: 22, stiffness: 260, mass: 0.8 } as const;

/** Light selection haptic. Never throws. */
export function tick() {
  void Haptics.selectionAsync().catch(() => undefined);
}

type TapProps = Omit<PressableProps, 'style'> & {
  className?: string;
  /** how far it shrinks while pressed: 0.98 for cards, 0.96 for buttons, 0.92 for icon buttons */
  scale?: number;
  /** selection haptic on press */
  haptic?: boolean;
  children?: ReactNode;
};

/** Pressable with spring press feedback. Takes the same props as Pressable. */
export const Tap = forwardRef<RNView, TapProps>(function Tap({ scale = 0.97, haptic, onPressIn, onPressOut, onPress, disabled, children, ...rest }, ref) {
  const s = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      ref={ref}
      {...rest}
      disabled={disabled}
      style={style}
      onPressIn={(e: GestureResponderEvent) => {
        s.value = withSpring(scale, SPRING_PRESS);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        s.value = withSpring(1, SPRING_RELEASE);
        onPressOut?.(e);
      }}
      onPress={(e: GestureResponderEvent) => {
        if (haptic) tick();
        onPress?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
});

/**
 * Fades and lifts its children into place on mount. `index` staggers siblings
 * (capped, so long lists don't wait). Layout classes go on `className`.
 */
export function Appear({ children, index = 0, className }: { children: ReactNode; index?: number; className?: string }) {
  return (
    <AnimatedView className={className} entering={FadeInDown.duration(320).delay(Math.min(index, 8) * 45).springify().damping(18).stiffness(180)}>
      {children}
    </AnimatedView>
  );
}

/** A 0 → 1 progress that runs once on mount (charts growing in). */
export function useGrowIn(duration = 650) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration });
  }, [p, duration]);
  return p;
}
