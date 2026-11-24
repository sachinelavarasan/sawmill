/**
 * Screen chrome. Every screen sits on the cream page (--color-background) with white cards on it.
 *
 *  - large — tab roots (Home, Stock, Reports…): a big title and a subtitle straight on the page,
 *    actions on the right.
 *  - default / compact — secondary and data-entry screens: a round white back button beside the
 *    title and subtitle.
 *
 * A screen's headline figures (`hero`) are drawn in the walnut headline card with tree rings
 * (HeroPanel), at the top of the content. The status bar is dark on the light page (light in dark
 * theme).
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { createElement, ReactNode, useCallback } from 'react';
import { FlatList, type FlatListProps, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { useTabBarInset } from '../lib/tab-chrome';
import { useT } from '../lib/i18n';
import { useThemeToggle } from '../lib/theme';
import { Glow } from './glow';
import { Text } from './text';
import { cn, Icon, type IconName, refresher } from './ui';

/**
 * Light or dark status bar icons while this screen is focused. Every screen that draws its own top
 * (Home, login) calls it; ScreenHeader does it for the rest.
 */
export function useStatusBar(light: boolean) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(light ? 'light' : 'dark', true);
    }, [light]),
  );
}

/** Round white icon button with a soft shadow (back, bell, filters). */
export function HeaderButton({ icon, label, onPress, badge }: { icon: IconName; label: string; onPress: () => void; badge?: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      className="mx-0.5 h-11 w-11 items-center justify-center rounded-full bg-card shadow-sm shadow-black/10 active:bg-secondary"
    >
      <Icon name={icon} size={20} colorClassName="accent-foreground" />
      {badge && <View className="absolute right-0.5 top-0.5">{badge}</View>}
    </Pressable>
  );
}

/**
 * App bar: back button (when `back` is set), title + subtitle, actions on the right.
 * `large` is for tab roots: bigger title, no back button. `compact` is kept for callers that ask for
 * the slim bar; it looks the same as the default now. `children` render under the title (a search
 * box, tabs, a summary).
 */
export function ScreenHeader({
  title,
  subtitle,
  back,
  onBack,
  right,
  large,
  step,
  children,
}: {
  /** where this screen sits in a flow (Lorry in → Unloading → Measure): segments under the title */
  step?: { at: number; of: number };
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  large?: boolean;
  compact?: boolean;
  children?: ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dark } = useThemeToggle();
  useStatusBar(dark);
  const goBack = onBack ?? (() => router.back());

  return (
    <View className="bg-background" style={{ paddingTop: insets.top }}>
      <View className={cn('flex-row items-center gap-1', large ? 'min-h-[72px] px-5 pt-2' : 'min-h-16 px-3 pt-1')}>
        {back && <HeaderButton icon="chevron-left" label={t('back')} onPress={goBack} />}
        <View className={cn('flex-1', back && 'pl-2.5')}>
          <Text
            className={cn('tracking-tight text-foreground font-display', large ? 'text-[30px] font-bold leading-9' : 'text-[20px] font-bold leading-6')}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {!!subtitle && (
            <Text className={cn('text-muted-foreground', large ? 'text-[15px]' : 'text-[13px]')} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {right}
      </View>
      {step && <StepBar at={step.at} of={step.of} />}
      {children ? <View className="gap-3 px-4 pb-3 pt-2">{children}</View> : <View className="h-1" />}
    </View>
  );
}

/** Copper segments for the steps done (and this one), beige for the rest. */
export function StepBar({ at, of }: { at: number; of: number }) {
  return (
    <View className="flex-row gap-2 px-4 pb-1 pt-2" accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: of, now: at }}>
      {Array.from({ length: of }, (_, i) => (
        <View key={i} className={cn('h-2 flex-1 rounded-full', i < at ? 'bg-saffron' : 'bg-secondary')} />
      ))}
    </View>
  );
}

/** @deprecated the sheet is gone; kept so older imports still resolve. */
export const SHEET_TOP = '';

/**
 * The walnut headline card with tree rings: what `hero` content is drawn in, and a frame for any
 * headline figure written for the dark (hero-foreground / hero-muted text).
 */
export function HeroPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={cn('gap-4 overflow-hidden rounded-3xl bg-hero p-5', className)}>
      <Glow variant="card" />
      {children}
    </View>
  );
}

/** @deprecated no dark band any more; render nothing so old layouts stay valid. */
export const BandOverscroll = () => null;
/** @deprecated no dark band any more; render nothing so old layouts stay valid. */
export const CornerBacking = () => null;

/** Scrolling page body: optional headline card, then the content, on the cream page. */
export function Page({
  children,
  hero,
  refreshing,
  onRefresh,
  className,
  bottomInset = true,
}: {
  children: ReactNode;
  hero?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  className?: string;
  /** add the phone's bottom inset (screens without the tab bar) */
  bottomInset?: boolean;
  /** kept for older callers; every page looks the same now */
  compact?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarInset();
  const paddingBottom = 32 + (tabBar || (bottomInset ? insets.bottom : 0));
  const refreshControl = onRefresh ? refresher(!!refreshing, onRefresh) : undefined;
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName={cn('grow gap-3 px-4 pt-2', className)} contentContainerStyle={{ paddingBottom }} refreshControl={refreshControl} keyboardShouldPersistTaps="handled">
      {hero ? <HeroPanel>{hero}</HeroPanel> : null}
      {children}
    </ScrollView>
  );
}

type SheetListProps<T> = Omit<FlatListProps<T>, 'contentContainerClassName' | 'contentContainerStyle' | 'ListFooterComponentStyle'> & {
  /** headline card above the list */
  hero?: ReactNode;
  /** room under the last row (a pinned footer, the phone's inset) */
  bottomPad?: number;
  /** kept for older callers; every list looks the same now */
  compact?: boolean;
};

/**
 * A FlatList on the cream page: `ListHeaderComponent` (search, filters) under the headline card,
 * then the rows.
 */
export function SheetList<T>({ hero, ListHeaderComponent, ListFooterComponent, ListEmptyComponent, renderItem, bottomPad = 24, compact: _compact, ...rest }: SheetListProps<T>) {
  const tabBar = useTabBarInset();
  const [page] = useCSSVariable(['--color-background']).map(String);
  const node = (c: SheetListProps<T>['ListHeaderComponent']) => (c == null ? null : typeof c === 'function' ? createElement(c) : c);
  return (
    <FlatList
      {...rest}
      className="flex-1 bg-background"
      contentContainerClassName="grow"
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View className="gap-3 px-4 pb-1 pt-2">
          {hero ? <HeroPanel>{hero}</HeroPanel> : null}
          {node(ListHeaderComponent)}
        </View>
      }
      renderItem={renderItem ? (info) => <View className="px-4">{renderItem(info)}</View> : undefined}
      ListEmptyComponent={ListEmptyComponent ? <View className="px-4 pt-2">{node(ListEmptyComponent)}</View> : null}
      ListFooterComponent={<View style={{ paddingBottom: bottomPad + tabBar }}>{node(ListFooterComponent)}</View>}
      ListFooterComponentStyle={{ flexGrow: 1, backgroundColor: page }}
    />
  );
}

/**
 * Action pinned under a scrolling screen (Continue, Save, Send to owner): a white bar with rounded
 * top corners, above the keyboard and the nav bar. Buttons inside fill the width.
 */
export function StickyFooter({ children, tabBar }: { children: ReactNode; /** on a tab screen: sits just above the floating bar, which pads the phone's inset */ tabBar?: boolean }) {
  const insets = useSafeAreaInsets();
  const barHeight = useTabBarInset();
  return (
    <View
      className="gap-2 rounded-t-[28px] bg-card px-4 pt-4 shadow-lg shadow-black/10"
      style={{ paddingBottom: 14 + (tabBar ? 0 : insets.bottom), marginBottom: tabBar ? barHeight : 0 }}
    >
      {children}
    </View>
  );
}
