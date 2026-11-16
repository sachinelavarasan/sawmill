/**
 * The floating, frosted bottom bar's plumbing.
 *
 * The bar floats over the tab screens, so content scrolls on underneath it and shows through
 * the glass. Two things make that work:
 *  - its measured height, which every scrolling surface adds as bottom room (useTabBarInset),
 *    so the last row can always be scrolled clear of the bar — 0 outside the tabs;
 *  - on Android, a blur needs a "target" to blur: each tab screen is wrapped in one
 *    (TabScreenLayout, the tabs' screenLayout) and the bar blurs the focused screen's target.
 *
 * expo-blur is a native module: a dev build made before it was added has no blur, and the bar
 * then falls back to a translucent tint (blurAvailable = false) instead of crashing.
 */
import { requireOptionalNativeModule } from 'expo';
import { createContext, type ReactNode, type RefObject, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

type BlurModule = typeof import('expo-blur');
/** expo-blur, if this build has its native side; loaded lazily so a missing module can't crash the import */
export const blur: BlurModule | null = requireOptionalNativeModule('ExpoBlur') ? (require('expo-blur') as BlurModule) : null;
export const blurAvailable = !!blur;

interface TabChrome {
  height: number;
  setHeight: (h: number) => void;
  targets: Map<string, RefObject<View | null>>;
  /** re-renders the bar when a screen's target comes or goes (the Map itself changes silently) */
  targetsChanged: () => void;
}

const Ctx = createContext<TabChrome | null>(null);

export function TabChromeProvider({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState(0);
  const targets = useRef(new Map<string, RefObject<View | null>>()).current;
  // Tab screens mount on first visit, after the bar has already drawn for them: without this the
  // bar kept "no target" for that screen (no blur on Android) until something else re-rendered it.
  const [version, setVersion] = useState(0);
  const targetsChanged = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(() => ({ height, setHeight, targets, targetsChanged }), [height, targets, targetsChanged, version]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Room to leave at the bottom of a scrolling screen so nothing stays hidden under the floating bar (0 outside the tabs). */
export function useTabBarInset(): number {
  return useContext(Ctx)?.height ?? 0;
}

/** For the bar: report its height; find the blur target of the screen it floats over. */
export function useTabChrome() {
  const ctx = useContext(Ctx);
  const setHeight = useCallback((h: number) => ctx?.setHeight(Math.round(h)), [ctx]);
  return { setHeight, targetFor: (routeKey: string) => ctx?.targets.get(routeKey) };
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

/** Wraps each tab screen: on Android it is the view the bar blurs. */
export function TabScreenLayout({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const ctx = useContext(Ctx);
  const ref = useRef<View>(null);
  useEffect(() => {
    if (!ctx) return;
    const { targets, targetsChanged } = ctx;
    targets.set(routeKey, ref);
    targetsChanged();
    return () => {
      targets.delete(routeKey);
      targetsChanged();
    };
    // ctx changes on every version bump: depending on it would re-register forever
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.targets, ctx?.targetsChanged, routeKey]);
  if (!blur || Platform.OS !== 'android') return <>{children}</>;
  const Target = blur.BlurTargetView;
  return (
    <Target ref={ref} style={styles.fill}>
      {children}
    </Target>
  );
}
