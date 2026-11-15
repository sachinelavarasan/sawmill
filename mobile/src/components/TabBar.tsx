/**
 * The bottom bar: Home · Inventory · Production · Reports · More.
 *
 * The active tab sits on a rounded soft-saffron pill that wraps icon and label and springs
 * across to the new tab; the active icon pops slightly and a selection haptic ticks.
 * More carries the count of records waiting for the owner's approval.
 */
import { Permission, type TKey } from '@timbertrail/shared';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../lib/i18n';
import { useApi } from '../lib/query';
import { useSession } from '../lib/session';
import { AnimatedView, SPRING_SLIDE, tick } from './motion';
import { Text } from './text';
import { cn, CountBadge, Icon, type IconName } from './ui';

const TABS: { name: string; labelKey: TKey; icon: IconName }[] = [
  { name: 'index', labelKey: 'home', icon: 'home' },
  { name: 'inventory', labelKey: 'inventory', icon: 'boxes' },
  { name: 'runs', labelKey: 'production', icon: 'factory' },
  { name: 'reports', labelKey: 'reports', icon: 'bar-chart-2' },
  { name: 'more', labelKey: 'more', icon: 'grid' },
];

/** horizontal padding of the bar, and the gap between the pill and its tab's edges */
const PAD = 8;
const INSET = 4;

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { can } = useSession();
  const pending = useApi<{ total: number }>(can(Permission.OPERATIONS_APPROVE) ? '/approvals/count' : null, { refetchInterval: 60_000 });

  const current = state.routes[state.index]?.name;
  const activeIndex = Math.max(0, TABS.findIndex((tb) => tb.name === current));

  // the sliding pill: width of one tab, and its x offset
  const [tabW, setTabW] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    if (tabW) x.value = withSpring(activeIndex * tabW, SPRING_SLIDE);
  }, [activeIndex, tabW, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    const w = (e.nativeEvent.layout.width - PAD * 2) / TABS.length;
    if (!tabW) x.value = activeIndex * w; // first layout: no slide from the left edge
    setTabW(w);
  };

  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (event.defaultPrevented) return;
    if (current !== name) tick();
    // tapping the current stacked tab again goes back to its first screen
    if (current === name && (name === 'more' || name === 'reports')) navigation.navigate(name, { screen: 'index' } as never);
    else navigation.navigate(name);
  };

  return (
    <View
      onLayout={onLayout}
      className="flex-row border-t border-border bg-card pt-1.5"
      style={{ paddingHorizontal: PAD, paddingBottom: Math.max(insets.bottom, 6) }}
      accessibilityRole="tablist"
    >
      {tabW > 0 && (
        <AnimatedView
          pointerEvents="none"
          className="absolute rounded-2xl bg-saffron-soft"
          style={[{ left: PAD + INSET, top: 6 + INSET / 2, width: tabW - INSET * 2, height: 56 - INSET }, pill]}
        />
      )}
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
  );
}

function Tab({ icon, label, on, badge, onPress }: { icon: IconName; label: string; on: boolean; badge: number; onPress: () => void }) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (on) s.value = withSequence(withSpring(1.18, { damping: 10, stiffness: 420 }), withSpring(1, { damping: 12, stiffness: 260 }));
  }, [on, s]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      className="min-h-[56px] flex-1 items-center justify-center gap-1"
    >
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={21} strokeWidth={on ? 2.25 : 1.75} colorClassName={on ? 'accent-saffron-strong' : 'accent-muted-foreground'} />
        {badge > 0 && <CountBadge n={badge} className="absolute -right-3 -top-1.5" />}
      </Animated.View>
      <Text className={cn('text-[11px]', on ? 'font-bold text-saffron-strong' : 'font-medium text-muted-foreground')} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
