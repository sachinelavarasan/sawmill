/** Screen chrome: the white top bar every screen uses, and the scrolling page body. */
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../lib/i18n';
import { cn, Icon, type IconName, refresher } from './ui';

/** Icon button for the top bar. */
export function HeaderButton({ icon, label, onPress, badge }: { icon: IconName; label: string; onPress: () => void; badge?: ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} className="h-11 w-11 items-center justify-center rounded-full active:bg-secondary">
      <Icon name={icon} size={22} colorClassName="accent-foreground" />
      {badge && <View className="absolute right-1 top-1">{badge}</View>}
    </Pressable>
  );
}

/**
 * Top bar: back arrow (when `back` is set), title + subtitle, actions on the right.
 * Sits under the status bar; white in light theme, slate in dark.
 */
export function ScreenHeader({
  title,
  subtitle,
  back,
  onBack,
  right,
  large,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  /** tab roots: bigger title, no back arrow */
  large?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View className="border-b border-border bg-card" style={{ paddingTop: insets.top }}>
      <View className={cn('flex-row items-center gap-1 px-2', large ? 'min-h-16 pl-4' : 'min-h-14')}>
        {back && <HeaderButton icon="arrow-left" label={t('back')} onPress={onBack ?? (() => router.back())} />}
        <View className={cn('flex-1', back && 'pl-1')}>
          <Text className={cn('font-bold text-foreground', large ? 'text-[22px] tracking-tight' : 'text-[17px]')} numberOfLines={1} accessibilityRole="header">
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
    </View>
  );
}

/** Scrolling page body with the standard padding, optional pull-to-refresh, and room for the tab bar. */
export function Page({
  children,
  refreshing,
  onRefresh,
  className,
  bottomInset = true,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  className?: string;
  /** add the phone's bottom inset (screens without the tab bar) */
  bottomInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName={cn('gap-3 p-4', className)}
      contentContainerStyle={{ paddingBottom: 24 + (bottomInset ? insets.bottom : 0) }}
      refreshControl={onRefresh ? refresher(!!refreshing, onRefresh) : undefined}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
