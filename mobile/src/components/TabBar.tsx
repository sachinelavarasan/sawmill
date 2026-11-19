/**
 * The bottom bar: Home · Loads in · Production · Loads out · More — the daily work, nothing else.
 * Inventory and Reports open from More (they are tabs without a button here; More stays lit on them).
 *
 * A floating near-black bar across the foot of the screen: five equal tabs, each an icon with its
 * name under it. The open tab sits on an orange block that slides across to the new tab; its icon
 * pops slightly and a selection haptic ticks. Names shrink to fit their tab (Tamil runs long) and
 * stop growing past 1.2× with the phone's text size, so five tabs always fit; the full name is
 * still spoken. More carries the count of records waiting for the owner's approval.
 */
import { Permission, type TKey } from '@timbertrail/shared';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../lib/i18n';
import { useApi } from '../lib/query';
import { useSession } from '../lib/session';
import { blur, useTabChrome } from '../lib/tab-chrome';
import { useThemeToggle } from '../lib/theme';
import { AnimatedView, EASE_SMOOTH, SLIDE, tick } from './motion';
import { Text } from './text';
import { cn, CountBadge, Icon, type IconName } from './ui';

const TABS: { name: string; labelKey: TKey; icon: IconName }[] = [
  { name: 'index', labelKey: 'home', icon: 'home' },
  { name: 'loads-in', labelKey: 'imports', icon: 'download' },
  { name: 'runs', labelKey: 'production', icon: 'factory' },
  { name: 'loads-out', labelKey: 'exports', icon: 'upload' },
  { name: 'more', labelKey: 'more', icon: 'grid' },
];

/** a tab's height, the gap between tabs, and the bar's own padding (tab width follows the screen) */
const HEIGHT = 58;
const GAP = 4;
const PAD = 6;

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { can } = useSession();
  const pending = useApi<{ total: number }>(can(Permission.OPERATIONS_APPROVE) ? '/approvals/count' : null, { refetchInterval: 60_000 });
  const { setHeight, targetFor } = useTabChrome();
  const { dark } = useThemeToggle();

  const current = state.routes[state.index]?.name;
  // Inventory and Reports have no button: they are reached from More, so More stays lit
  const found = TABS.findIndex((tb) => tb.name === current);
  const activeIndex = found >= 0 ? found : TABS.length - 1;

  // each tab's width, from the bar's measured width
  const [tabW, setTabW] = useState(0);
  // the sliding orange block
  const x = useSharedValue(0);
  useEffect(() => {
    if (tabW) x.value = withTiming(activeIndex * (tabW + GAP), SLIDE);
  }, [activeIndex, tabW, x]);
  const dot = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (event.defaultPrevented) return;
    if (current !== name) tick();
    // More is a menu: its button always opens the menu, even if a screen inside it (say Accounts,
    // opened from Home) was left on top
    if (name === 'more') navigation.navigate(name, { screen: 'index' } as never);
    else navigation.navigate(name);
  };

  const BlurView = blur?.BlurView;
  const target = targetFor(state.routes[state.index]?.key ?? '');

  return (
    // the strip floats over the page: frosted glass the content scrolls on beneath (see lib/tab-chrome)
    <View
      className="absolute inset-x-0 bottom-0 items-center overflow-hidden border-t border-border/60 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 10) + 4 }}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      {BlurView ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          // a strong frost under a light tint, so the page shows through as soft colour
          // a strong frost; the light tint below gives the glass the same look on every tab
          intensity={dark ? 100 : 90}
          // Android divides the intensity by this (default 4); 2.5 makes the frost clearly visible there too
          blurReductionFactor={2.5}
          tint={dark ? 'dark' : 'light'}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={Platform.OS === 'android' ? target : undefined}
        />
      ) : null}
      {/* the glass's own faint colour, so the bar looks the same over coloured cards (Home) and plain
          sheet (More); nearly solid where there is no blur (old builds) */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill} className={BlurView ? (dark ? 'bg-card/5' : 'bg-card/10') : 'bg-card/85'} />
      <View
        className={cn(
          'flex-row self-stretch rounded-[28px] border border-hero-border',
          BlurView ? 'bg-sidebar/70' : 'bg-sidebar/92',
        )}
        style={{ padding: PAD, gap: GAP, marginHorizontal: 12 }}
        accessibilityRole="tablist"
        onLayout={(e) => {
          const w = (e.nativeEvent.layout.width - PAD * 2 - GAP * (TABS.length - 1)) / TABS.length;
          // first measurement: put the block in place without sliding in from the left
          if (!tabW) x.value = activeIndex * (w + GAP);
          setTabW(w);
        }}
      >
        {tabW > 0 && <AnimatedView pointerEvents="none" className="absolute rounded-[22px] bg-saffron" style={[{ left: PAD, top: PAD, width: tabW, height: HEIGHT }, dot]} />}
        {TABS.map((tb, i) => (
          <Tab
            key={tb.name}
            icon={tb.icon}
            label={t(tb.labelKey)}
            on={i === activeIndex}
            badge={tb.name === 'more' ? (pending.data?.total ?? 0) : 0}
            onPress={() => go(tb.name)}
          />
        ))}
      </View>
    </View>
  );
}

function Tab({ icon, label, on, badge, onPress }: { icon: IconName; label: string; on: boolean; badge: number; onPress: () => void }) {
  const s = useSharedValue(1);
  useEffect(() => {
    // a gentle lift as it becomes the open tab, then back
    if (on) s.value = withSequence(withTiming(1.08, { duration: 160, easing: EASE_SMOOTH }), withTiming(1, { duration: 260, easing: EASE_SMOOTH }));
  }, [on, s]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      className={cn('flex-1 items-center justify-center gap-1 rounded-[22px] px-0.5', !on && 'active:bg-sidebar-active')}
      style={{ height: HEIGHT }}
    >
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={20} strokeWidth={on ? 2.25 : 1.9} colorClassName={on ? 'accent-saffron-foreground' : 'accent-sidebar-foreground'} />
        {badge > 0 && <CountBadge n={badge} onDark className="absolute -right-3 -top-2" />}
      </Animated.View>
      <Text
        className={cn('text-center text-[11px] leading-[14px]', on ? 'font-semibold text-saffron-foreground' : 'font-medium text-sidebar-muted')}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        maxFontSizeMultiplier={1.2}
        importantForAccessibility="no"
      >
        {label}
      </Text>
    </Pressable>
  );
}
