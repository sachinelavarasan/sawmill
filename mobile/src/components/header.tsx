/**
 * Screen chrome, in two weights:
 *
 *  - band (default) — primary screens (the tab roots, Accounts): the app bar sits on the warm band
 *    (orange melting into warm black, see glow.tsx) and the content rises over it on a white sheet.
 *  - compact — secondary and data-entry screens (records, forms, measuring, settings): a slim light
 *    bar with a hairline under it and the content straight below. A screen's headline figures still
 *    get the dark treatment: `hero` content on a compact page is drawn in a dark headline card.
 *
 * The status bar follows whichever header the focused screen shows (light icons on the band, dark
 * icons on a light compact bar).
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { createContext, createElement, ReactNode, useCallback, useContext } from 'react';
import { FlatList, type FlatListProps, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarInset } from '../lib/tab-chrome';
import { useT } from '../lib/i18n';
import { useThemeToggle } from '../lib/theme';
import { Glow } from './glow';
import { Text } from './text';
import { cn, Icon, type IconName, refresher } from './ui';

/** true inside a compact (light) app bar: header buttons switch to their on-surface look */
const OnSurface = createContext(false);

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

/** Icon button for the app bar: round white on the band, round grey on a compact bar. */
export function HeaderButton({ icon, label, onPress, badge }: { icon: IconName; label: string; onPress: () => void; badge?: ReactNode }) {
  const surface = useContext(OnSurface);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      className={cn('mx-0.5 h-10 w-10 items-center justify-center rounded-full', surface ? 'bg-secondary active:bg-background' : 'bg-hero-foreground active:opacity-80')}
    >
      <Icon name={icon} size={19} colorClassName={surface ? 'accent-foreground' : 'accent-hero'} />
      {badge && <View className="absolute right-1 top-1">{badge}</View>}
    </Pressable>
  );
}

/**
 * App bar: back arrow (when `back` is set), title + subtitle, actions on the right.
 * `large` is for tab roots: bigger title, no back arrow. `compact` is the light bar for secondary and
 * data-entry screens. `children` render under the title (a search box, tabs, a summary).
 */
export function ScreenHeader({
  title,
  subtitle,
  back,
  onBack,
  right,
  large,
  compact,
  children,
}: {
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
  useStatusBar(!compact || dark);
  const goBack = onBack ?? (() => router.back());

  if (compact)
    return (
      <OnSurface.Provider value>
        <View className="border-b border-border bg-card" style={{ paddingTop: insets.top }}>
          <View className="min-h-14 flex-row items-center gap-1 px-3">
            {back && <HeaderButton icon="chevron-left" label={t('back')} onPress={goBack} />}
            <View className="flex-1 pl-2">
              <Text className="text-[17px] font-semibold tracking-tight text-foreground font-display" numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
              {!!subtitle && (
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>
            {right}
          </View>
          {children ? <View className="gap-3 px-4 pb-3 pt-1">{children}</View> : null}
        </View>
      </OnSurface.Provider>
    );

  return (
    <View className="overflow-hidden bg-hero" style={{ paddingTop: insets.top }}>
      <Glow />
      <View className={cn('flex-row items-center gap-1 px-3', large ? 'min-h-16 pl-5' : 'min-h-14')}>
        {back && <HeaderButton icon="chevron-left" label={t('back')} onPress={goBack} />}
        <View className={cn('flex-1', back && 'pl-2')}>
          <Text className={cn('font-semibold text-hero-foreground font-display', large ? 'text-[22px] font-bold tracking-tight font-display' : 'text-[17px]')} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {!!subtitle && (
            <Text className="text-xs text-hero-muted" numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {right}
      </View>
      {children ? <View className="gap-3 px-4 pb-4 pt-1">{children}</View> : <View className="h-1" />}
    </View>
  );
}

/**
 * The page surface on band screens: the dark of the app bar carries on behind the content, and the
 * content sits on ONE rounded sheet that rises over it. Anything in `hero` (a headline figure, a
 * chart) is drawn on the band above the sheet and scrolls away with it.
 *
 * Inside the sheet there are no boxed cards: rows divided by hairlines, soft grey panels for
 * grouped figures, and section headings.
 */
export const SHEET_TOP = 'rounded-t-[30px] bg-card';

/** Dark content above the sheet (the band continues under the app bar's gradient). */
function Hero({ children }: { children?: ReactNode }) {
  return children ? <View className="gap-4 px-5 pb-7 pt-2">{children}</View> : <View className="h-2" />;
}

/**
 * The dark headline card: what `hero` becomes on a compact page, and a frame for any headline
 * figure written for the dark (hero-foreground / hero-muted text).
 */
export function HeroPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={cn('gap-4 overflow-hidden rounded-3xl bg-hero p-5', className)}>
      <Glow variant="card" />
      {children}
    </View>
  );
}

/** Scrolling page body: optional hero, then the content (on the sheet, or flat when `compact`). */
export function Page({
  children,
  hero,
  refreshing,
  onRefresh,
  className,
  bottomInset = true,
  compact,
}: {
  children: ReactNode;
  hero?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  className?: string;
  /** add the phone's bottom inset (screens without the tab bar) */
  bottomInset?: boolean;
  /** under a compact header: flat white body, `hero` drawn as a dark headline card */
  compact?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarInset();
  const paddingBottom = 32 + (tabBar || (bottomInset ? insets.bottom : 0));
  const refreshControl = onRefresh ? refresher(!!refreshing, onRefresh) : undefined;
  if (compact)
    return (
      <ScrollView className="flex-1 bg-card" contentContainerClassName={cn('grow gap-3 px-4 pt-4', className)} contentContainerStyle={{ paddingBottom }} refreshControl={refreshControl} keyboardShouldPersistTaps="handled">
        {hero ? <HeroPanel>{hero}</HeroPanel> : null}
        {children}
      </ScrollView>
    );
  return (
    <ScrollView className="flex-1 bg-hero" contentContainerClassName="grow" refreshControl={refreshControl} keyboardShouldPersistTaps="handled">
      <Hero>{hero}</Hero>
      <View className={cn('grow gap-3 px-4 pt-6', SHEET_TOP, className)} style={{ paddingBottom }}>
        {children}
      </View>
    </ScrollView>
  );
}

type SheetListProps<T> = Omit<FlatListProps<T>, 'contentContainerClassName' | 'contentContainerStyle' | 'ListFooterComponentStyle'> & {
  /** dark content above the sheet (a headline card when `compact`) */
  hero?: ReactNode;
  /** room under the last row (a pinned footer, the phone's inset) */
  bottomPad?: number;
  /** under a compact header: flat white list, `hero` drawn as a dark headline card */
  compact?: boolean;
};

/**
 * A FlatList laid out as hero + sheet: `ListHeaderComponent` is the top of the sheet (search,
 * filters), rows follow on the sheet, and the sheet always reaches the bottom of the screen even
 * when the list is short.
 */
export function SheetList<T>({ hero, ListHeaderComponent, ListFooterComponent, ListEmptyComponent, renderItem, bottomPad = 24, compact, ...rest }: SheetListProps<T>) {
  const tabBar = useTabBarInset();
  const node = (c: SheetListProps<T>['ListHeaderComponent']) => (c == null ? null : typeof c === 'function' ? createElement(c) : c);
  return (
    <FlatList
      {...rest}
      className={cn('flex-1', compact ? 'bg-card' : 'bg-hero')}
      contentContainerClassName="grow"
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        compact ? (
          <View className="gap-3 bg-card px-4 pb-1 pt-4">
            {hero ? <HeroPanel>{hero}</HeroPanel> : null}
            {node(ListHeaderComponent)}
          </View>
        ) : (
          <>
            <Hero>{hero}</Hero>
            <View className={cn('gap-3 px-4 pb-1 pt-6', SHEET_TOP)}>{node(ListHeaderComponent)}</View>
          </>
        )
      }
      renderItem={renderItem ? (info) => <View className="bg-card px-4">{renderItem(info)}</View> : undefined}
      ListEmptyComponent={ListEmptyComponent ? <View className="bg-card px-4 pt-2">{node(ListEmptyComponent)}</View> : null}
      ListFooterComponent={<View style={{ paddingBottom: bottomPad + tabBar }}>{node(ListFooterComponent)}</View>}
      ListFooterComponentStyle={{ flexGrow: 1 }}
      ListFooterComponentClassName="bg-card"
    />
  );
}

/** Action pinned under a scrolling screen (Save, Generate, Add). Stays above the keyboard and the nav bar. */
export function StickyFooter({ children, tabBar }: { children: ReactNode; /** on a tab screen: sits just above the floating bar, which pads the phone's inset */ tabBar?: boolean }) {
  const insets = useSafeAreaInsets();
  const barHeight = useTabBarInset();
  return (
    <View className="gap-2 border-t border-border bg-card px-4 pt-3" style={{ paddingBottom: 12 + (tabBar ? 0 : insets.bottom), marginBottom: tabBar ? barHeight : 0 }}>
      {children}
    </View>
  );
}
