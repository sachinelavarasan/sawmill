/**
 * Opened from the avatar on Home: who is signed in, the two choices people change most
 * (appearance, language), and the account actions (Settings, Log out).
 *
 * Layout, top to bottom: a compact identity card (warm-dark in the dark theme, soft grey in the
 * light one), a "Preferences" group of two segmented choices, and an "Account" group of rows.
 * Choices apply at once and are saved per user by services/preferences. The sheet itself (surface,
 * backdrop, swipe / tap / back to close, safe areas) is the shared Sheet.
 */
import { Permission } from '@timbertrail/shared';
import { useRouter } from 'expo-router';
import { forwardRef } from 'react';
import { View } from 'react-native';
import { useLang, useT } from '../lib/i18n';
import { pendingFor } from '../lib/offline-logs';
import { useSession, useUser } from '../lib/session';
import { useThemeToggle } from '../lib/theme';
import type { Language, ThemePreference } from '../services/preferences';
import { useConfirm } from './confirm';
import { Glow } from './glow';
import { AppBottomSheet, type SheetHandle } from './bottom-sheet';
import { Text } from './text';
import { Avatar, cn, Icon, MenuGroup, MenuRow, Overline, Segmented } from './ui';

export const ProfileSheet = forwardRef<SheetHandle>(function ProfileSheet(_, ref) {
  const t = useT();
  const user = useUser();
  const { can, logout } = useSession();
  const { dark, preference, setPreference } = useThemeToggle();
  const { lang, setLang } = useLang();
  const router = useRouter();
  const confirm = useConfirm();
  const close = () => (ref as React.RefObject<SheetHandle | null>).current?.close();
  const owner = can(Permission.DASHBOARD_OWNER);

  return (
    // medium: identity, two choices and two actions fit without scrolling on most phones
    <AppBottomSheet ref={ref} variant="medium">
      <View className="gap-5 pb-1">
        {/* identity: compact; warm-dark in the dark theme, soft grey in the light one */}
        <View className={cn('gap-3 overflow-hidden rounded-3xl p-4', dark ? 'bg-hero' : 'bg-background')} accessible accessibilityLabel={`${user.name}, @${user.username}, ${owner ? t('owner') : t('accountant')}, ${user.mill.name}`}>
          {dark && <Glow variant="card" />}
          <View className="flex-row items-center gap-3">
            <Avatar name={user.name} size="md" tone="saffron" />
            <View className="flex-1 gap-0.5">
              <Text className={cn('text-[17px] font-bold tracking-tight font-display', dark ? 'text-hero-foreground' : 'text-foreground')} numberOfLines={1}>
                {user.name}
              </Text>
              <Text className={cn('text-[13px]', dark ? 'text-hero-muted' : 'text-muted-foreground')} numberOfLines={1}>
                @{user.username}
              </Text>
            </View>
            <View className="rounded-full bg-saffron px-2.5 py-1">
              <Text className="text-xs font-semibold text-saffron-foreground">{owner ? t('owner') : t('accountant')}</Text>
            </View>
          </View>
          <View className={cn('flex-row items-center gap-2 border-t pt-3', dark ? 'border-hero-border' : 'border-border')}>
            <Icon name="building" size={14} colorClassName={dark ? 'accent-hero-muted' : 'accent-muted-foreground'} />
            <Text className={cn('flex-1 text-[13px] font-medium', dark ? 'text-hero-foreground' : 'text-foreground')} numberOfLines={1}>
              {user.mill.name}
            </Text>
            {!!user.mill.code && (
              <View className={cn('rounded-md px-1.5 py-0.5', dark ? 'bg-hero-chip' : 'bg-card')}>
                <Text className={cn('text-[11px] font-semibold tabular-nums', dark ? 'text-hero-foreground' : 'text-muted-foreground')}>{user.mill.code}</Text>
              </View>
            )}
          </View>
        </View>

        {/* preferences: saved for this user on this phone */}
        <View className="gap-3">
          <Overline className="px-1">{t('preferences')}</Overline>
          <View className="gap-1.5">
            <Text className="px-1 text-[13px] font-semibold text-foreground">{t('appearance')}</Text>
            <Segmented<ThemePreference>
              value={preference}
              onChange={setPreference}
              options={[
                { value: 'light', label: t('themeLight') },
                { value: 'dark', label: t('themeDark') },
                { value: 'system', label: t('themeSystem') },
              ]}
            />
          </View>
          <View className="gap-1.5">
            <Text className="px-1 text-[13px] font-semibold text-foreground">{t('language')}</Text>
            <Segmented<Language>
              value={lang}
              onChange={setLang}
              options={[
                { value: 'en', label: 'English' },
                { value: 'ta', label: 'தமிழ்' },
              ]}
            />
          </View>
        </View>

        {/* account */}
        <View className="gap-3">
          <Overline className="px-1">{t('account')}</Overline>
          <MenuGroup inset>
            <MenuRow
              icon="settings-2"
              title={t('settings')}
              onPress={() => {
                close();
                router.push('/more/settings');
              }}
            />
            <MenuRow
              icon="log-out"
              tone="bad"
              title={t('logout')}
              last
              onPress={async () => {
                close();
                // logs measured offline only go out while their measurer is signed in: say so before signing out
                const waiting = pendingFor(user.id).filter((p) => !p.error).length;
                const message = waiting ? `${t('pendingLogs', { n: waiting })}. ${t('logoutPendingNote')}` : t('logoutConfirm');
                if (await confirm({ title: t('logout'), message, confirmText: t('logout'), cancelText: t('cancel'), destructive: true })) await logout();
              }}
            />
          </MenuGroup>
        </View>
      </View>
    </AppBottomSheet>
  );
});
