/**
 * The bottom bar: Home · Inventory · Production · Reports · More.
 *
 * A floating near-black pill of round icon buttons, centred over the foot of the screen. The open tab
 * is an orange circle that springs across to the new tab; its icon pops slightly and a selection
 * haptic ticks. Labels are spoken (accessibility), not printed, so five tabs fit at any text size
 * and in Tamil. More carries the count of records waiting for the owner's approval.
 */
import { Permission, type TKey } from '@timbertrail/shared';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../lib/i18n';
import { useApi } from '../lib/query';
import { useSession } from '../lib/session';
import { AnimatedView, SPRING_SLIDE, tick } from './motion';
import { cn, CountBadge, Icon, type IconName } from './ui';

const TABS: { name: string; labelKey: TKey; icon: IconName }[] = [
  { name: 'index', labelKey: 'home', icon: 'home' },
  { name: 'inventory', labelKey: 'inventory', icon: 'boxes' },
  { name: 'runs', labelKey: 'production', icon: 'factory' },
  { name: 'reports', labelKey: 'reports', icon: 'bar-chart-2' },
  { name: 'more', labelKey: 'more', icon: 'grid' },
];

/** one round tab, the gap between tabs, and the pill's own padding */
const SIZE = 52;
const GAP = 6;
const PAD = 6;

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { can } = useSession();
  const pending = useApi<{ total: number }>(can(Permission.OPERATIONS_APPROVE) ? '/approvals/count' : null, { refetchInterval: 60_000 });

  const current = state.routes[state.index]?.name;
  const activeIndex = Math.max(0, TABS.findIndex((tb) => tb.name === current));

  // the sliding orange circle
  const x = useSharedValue(activeIndex * (SIZE + GAP));
  useEffect(() => {
    x.value = withSpring(activeIndex * (SIZE + GAP), SPRING_SLIDE);
  }, [activeIndex, x]);
  const dot = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

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
    // the strip under the pill is the sheet's own white, so the pill reads as floating over the page
    <View className="items-center bg-card pt-2" style={{ paddingBottom: Math.max(insets.bottom, 10) + 4 }}>
      <View className="flex-row rounded-full bg-sidebar" style={{ padding: PAD, gap: GAP }} accessibilityRole="tablist">
        <AnimatedView pointerEvents="none" className="absolute rounded-full bg-saffron" style={[{ left: PAD, top: PAD, width: SIZE, height: SIZE }, dot]} />
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
    if (on) s.value = withSequence(withSpring(1.18, { damping: 10, stiffness: 420 }), withSpring(1, { damping: 12, stiffness: 260 }));
  }, [on, s]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      className={cn('items-center justify-center rounded-full', !on && 'bg-sidebar-active active:opacity-80')}
      style={{ width: SIZE, height: SIZE }}
    >
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={21} strokeWidth={on ? 2.25 : 1.9} colorClassName={on ? 'accent-saffron-foreground' : 'accent-sidebar-foreground'} />
        {badge > 0 && <CountBadge n={badge} onDark className="absolute -right-3 -top-2" />}
      </Animated.View>
    </Pressable>
  );
}
