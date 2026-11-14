/**
 * The bottom bar: four destinations and a raised saffron Quick Add button in the middle.
 * The selected destination gets a soft saffron pill; the Transactions tab shows how many
 * records wait for the owner's approval.
 */
import { Permission, type TKey } from '@sawmill/shared';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../lib/i18n';
import { useApi } from '../lib/query';
import { useSession } from '../lib/session';
import { QuickAddSheet } from './QuickAddSheet';
import { useSheet } from './sheet';
import { cn, CountBadge, Icon, type IconName } from './ui';

const TABS: { name: string; labelKey: TKey; icon: IconName }[] = [
  { name: 'index', labelKey: 'home', icon: 'home' },
  { name: 'transactions', labelKey: 'transactions', icon: 'repeat' },
  { name: 'reports', labelKey: 'reports', icon: 'bar-chart-2' },
  { name: 'more', labelKey: 'more', icon: 'grid' },
];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { can } = useSession();
  const quick = useSheet();
  const pending = useApi<{ total: number }>(can(Permission.OPERATIONS_APPROVE) ? '/approvals/count' : null, { refetchInterval: 60_000 });

  const current = state.routes[state.index]?.name;
  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (event.defaultPrevented) return;
    // tapping the current tab again goes back to its first screen
    if (current === name && name !== 'index') navigation.navigate(name, { screen: 'index' } as never);
    else navigation.navigate(name);
  };

  const tab = (tb: (typeof TABS)[number]) => {
    const on = current === tb.name;
    const badge = tb.name === 'transactions' ? (pending.data?.total ?? 0) : 0;
    return (
      <Pressable
        key={tb.name}
        onPress={() => go(tb.name)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={badge ? `${t(tb.labelKey)}, ${badge}` : t(tb.labelKey)}
        className="min-h-[60px] flex-1 items-center justify-center gap-1 pt-1.5"
      >
        <View className={cn('h-8 w-14 items-center justify-center rounded-full', on && 'bg-saffron-soft')}>
          <Icon name={tb.icon} size={21} colorClassName={on ? 'accent-warning' : 'accent-muted-foreground'} />
          {badge > 0 && <CountBadge n={badge} className="absolute -top-1 right-1.5" />}
        </View>
        <Text className={cn('text-[11px]', on ? 'font-bold text-foreground' : 'font-medium text-muted-foreground')} numberOfLines={1}>
          {t(tb.labelKey)}
        </Text>
      </Pressable>
    );
  };

  return (
    <>
      <View className="flex-row border-t border-border bg-card px-1" style={{ paddingBottom: insets.bottom }} accessibilityRole="tablist">
        {TABS.slice(0, 2).map(tab)}
        <View className="flex-1 items-center">
          <Pressable
            onPress={quick.open}
            accessibilityRole="button"
            accessibilityLabel={t('quickAdd')}
            className="-mt-5 h-14 w-14 items-center justify-center rounded-full border-4 border-card bg-saffron shadow-md active:opacity-85"
          >
            <Icon name="plus" size={26} colorClassName="accent-saffron-foreground" />
          </Pressable>
          <Text className="mt-0.5 text-[11px] font-medium text-muted-foreground" numberOfLines={1}>
            {t('quickAdd')}
          </Text>
        </View>
        {TABS.slice(2).map(tab)}
      </View>
      <QuickAddSheet ref={quick.ref} />
    </>
  );
}
