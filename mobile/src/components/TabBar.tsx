/**
 * The bottom bar, as in the Sawmill Pro mockups:
 *  - owner (may approve):  Home · Approvals · Stock · Reports
 *  - accountant:           Home · My work · Stock
 * Loads in, production, loads out and More are tabs without a button (opened from Home's tiles
 * and the profile sheet); on them the nearest tab stays lit (My work for the accountant, Home for
 * the owner).
 *
 * A white bar across the foot of the screen: equal tabs, each an icon with its name under it.
 * The open tab's icon sits on a soft peach pill that slides across to the new tab; its icon pops
 * slightly, its name turns bold and a selection haptic ticks. Names shrink to fit their tab (Tamil
 * runs long) and stop growing past 1.2× with the phone's text size; the full name is still spoken.
 * Approvals carries the count of records waiting for the owner.
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

type TabDef = { name: string; labelKey: TKey; icon: IconName };
const OWNER_TABS: TabDef[] = [
  { name: 'index', labelKey: 'home', icon: 'home' },
  { name: 'approvals', labelKey: 'tabApprovals', icon: 'check-circle' },
  { name: 'inventory', labelKey: 'tabStock', icon: 'boxes' },
  { name: 'reports', labelKey: 'reports', icon: 'bar-chart-2' },
];
const ACCOUNTANT_TABS: TabDef[] = [
  { name: 'index', labelKey: 'home', icon: 'home' },
  { name: 'loads-in', labelKey: 'tabMyWork', icon: 'file-text' },
  { name: 'inventory', labelKey: 'tabStock', icon: 'boxes' },
];
/** routes without a button, and the tab that stays lit on them */
const LIT_FOR: Record<string, string> = { 'loads-in': 'index', runs: 'index', 'loads-out': 'index', more: 'index' };
const LIT_FOR_ACCOUNTANT: Record<string, string> = { runs: 'loads-in', 'loads-out': 'loads-in', more: 'index', reports: 'index', approvals: 'index' };

/** a tab's height, the gap between tabs, and the bar's own padding (tab width follows the screen) */
const HEIGHT = 60;
const GAP = 4;
const PAD = 4;
/** the peach pill behind the open tab's icon */
const PILL_W = 60;
const PILL_H = 34;

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { can } = useSession();
  const owner = can(Permission.OPERATIONS_APPROVE);
  const TABS = owner ? OWNER_TABS : ACCOUNTANT_TABS;
  const pending = useApi<{ total: number }>(owner ? '/approvals/count' : null, { refetchInterval: 60_000 });
  const { setHeight, targetFor } = useTabChrome();
  const { dark } = useThemeToggle();

  const current = state.routes[state.index]?.name;
  // a screen without a button lights the tab it belongs with
  const lit = TABS.some((tb) => tb.name === current) ? current : ((owner ? LIT_FOR : LIT_FOR_ACCOUNTANT)[current ?? ''] ?? 'index');
  const activeIndex = Math.max(0, TABS.findIndex((tb) => tb.name === lit));

  // each tab's width, from the bar's measured width
  const [tabW, setTabW] = useState(0);
  // the sliding peach pill
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
      className="absolute inset-x-0 bottom-0 items-center overflow-hidden border-t border-border pt-1.5"
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
      <View pointerEvents="none" style={StyleSheet.absoluteFill} className={BlurView ? 'bg-sidebar/80' : 'bg-sidebar'} />
      <View
        className="flex-row self-stretch"
        style={{ padding: PAD, gap: GAP, marginHorizontal: 8 }}
        accessibilityRole="tablist"
        onLayout={(e) => {
          const w = (e.nativeEvent.layout.width - PAD * 2 - GAP * (TABS.length - 1)) / TABS.length;
          // first measurement: put the block in place without sliding in from the left
          if (!tabW) x.value = activeIndex * (w + GAP);
          setTabW(w);
        }}
      >
        {tabW > 0 && (
          <AnimatedView pointerEvents="none" className="absolute rounded-full bg-sidebar-accent" style={[{ left: PAD + (tabW - PILL_W) / 2, top: PAD + 5, width: PILL_W, height: PILL_H }, dot]} />
        )}
        {TABS.map((tb, i) => (
          <Tab
            key={tb.name}
            icon={tb.icon}
            label={t(tb.labelKey)}
            on={i === activeIndex}
            badge={tb.name === 'approvals' ? (pending.data?.total ?? 0) : 0}
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
      className="flex-1 items-center justify-start gap-1.5 rounded-2xl px-0.5 pt-[11px]"
      style={{ height: HEIGHT }}
    >
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={22} strokeWidth={on ? 2.25 : 1.9} colorClassName={on ? 'accent-sidebar-foreground' : 'accent-sidebar-muted'} />
        {badge > 0 && <CountBadge n={badge} className="absolute -right-3 -top-2" />}
      </Animated.View>
      <Text
        className={cn('text-center text-[12px] leading-[15px]', on ? 'font-bold text-sidebar-foreground' : 'font-medium text-sidebar-muted')}
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
