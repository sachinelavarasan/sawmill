/**
 * Screen chrome: the navy app bar every screen uses, and the scrolling page body.
 * The bar is navy in both themes, so the status bar icons are always light.
 */
import { useRouter } from 'expo-router';
import { createElement, ReactNode } from 'react';
import { FlatList, type FlatListProps, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../lib/i18n';
import { Text } from './text';
import { cn, Icon, type IconName, refresher } from './ui';

/** Icon button for the app bar (white on navy). */
export function HeaderButton({ icon, label, onPress, badge }: { icon: IconName; label: string; onPress: () => void; badge?: ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} className="h-11 w-11 items-center justify-center rounded-full active:bg-hero-chip">
      <Icon name={icon} size={21} colorClassName="accent-hero-foreground" />
      {badge && <View className="absolute right-1 top-1">{badge}</View>}
    </Pressable>
  );
}

/**
 * App bar: back arrow (when `back` is set), title + subtitle, actions on the right.
 * `large` is for tab roots: bigger title, no back arrow. `children` render inside the
 * navy band under the title (a search box, a segmented control, a summary).
 */
export function ScreenHeader({
  title,
  subtitle,
  back,
  onBack,
  right,
  large,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  large?: boolean;
  children?: ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View className="bg-hero" style={{ paddingTop: insets.top }}>
      <View className={cn('flex-row items-center gap-1 px-2', large ? 'min-h-16 pl-5' : 'min-h-14')}>
        {back && <HeaderButton icon="arrow-left" label={t('back')} onPress={onBack ?? (() => router.back())} />}
        <View className={cn('flex-1', back && 'pl-1')}>
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
      {children ? <View className="gap-3 px-4 pb-4 pt-1">{children}</View> : null}
    </View>
  );
}

/**
 * The page surface: the navy of the app bar carries on behind the content, and the
 * content sits on ONE rounded sheet that rises over it. Anything in `hero` (a headline
 * figure, a chart) is drawn on the navy above the sheet and scrolls away with it.
 *
 * Inside the sheet there are no boxed cards: rows divided by hairlines, tinted panels for
 * grouped figures, and section headings.
 */
export const SHEET_TOP = 'rounded-t-[28px] bg-card';

/** Navy content above the sheet. */
function Hero({ children }: { children?: ReactNode }) {
  return children ? <View className="gap-4 px-5 pb-7 pt-2">{children}</View> : <View className="h-2" />;
}

/** Scrolling page body: optional navy hero, then the sheet holding `children`. */
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
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-hero"
      contentContainerClassName="grow"
      refreshControl={onRefresh ? refresher(!!refreshing, onRefresh) : undefined}
      keyboardShouldPersistTaps="handled"
    >
      <Hero>{hero}</Hero>
      <View className={cn('grow gap-3 px-4 pt-6', SHEET_TOP, className)} style={{ paddingBottom: 32 + (bottomInset ? insets.bottom : 0) }}>
        {children}
      </View>
    </ScrollView>
  );
}

type SheetListProps<T> = Omit<FlatListProps<T>, 'contentContainerClassName' | 'contentContainerStyle' | 'ListFooterComponentStyle'> & {
  /** navy content above the sheet */
  hero?: ReactNode;
  /** room under the last row (a pinned footer, the phone's inset) */
  bottomPad?: number;
};

/**
 * A FlatList laid out as navy hero + sheet: `ListHeaderComponent` is the top of the sheet
 * (search, filters), rows follow on the sheet, and the sheet always reaches the bottom of
 * the screen even when the list is short.
 */
export function SheetList<T>({ hero, ListHeaderComponent, ListFooterComponent, ListEmptyComponent, renderItem, bottomPad = 24, ...rest }: SheetListProps<T>) {
  const node = (c: SheetListProps<T>['ListHeaderComponent']) => (c == null ? null : typeof c === 'function' ? createElement(c) : c);
  return (
    <FlatList
      {...rest}
      className="flex-1 bg-hero"
      contentContainerClassName="grow"
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <>
          <Hero>{hero}</Hero>
          <View className={cn('gap-3 px-4 pb-1 pt-6', SHEET_TOP)}>{node(ListHeaderComponent)}</View>
        </>
      }
      renderItem={renderItem ? (info) => <View className="bg-card px-4">{renderItem(info)}</View> : undefined}
      ListEmptyComponent={ListEmptyComponent ? <View className="bg-card px-4 pt-2">{node(ListEmptyComponent)}</View> : null}
      ListFooterComponent={<View style={{ paddingBottom: bottomPad }}>{node(ListFooterComponent)}</View>}
      ListFooterComponentStyle={{ flexGrow: 1 }}
      ListFooterComponentClassName="bg-card"
    />
  );
}

/** Action pinned under a scrolling screen (Save, Generate, Add). Stays above the keyboard and the nav bar. */
export function StickyFooter({ children, tabBar }: { children: ReactNode; /** the screen sits above the tab bar, which already pads the inset */ tabBar?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="gap-2 border-t border-border bg-card px-4 pt-3" style={{ paddingBottom: 12 + (tabBar ? 0 : insets.bottom) }}>
      {children}
    </View>
  );
}
