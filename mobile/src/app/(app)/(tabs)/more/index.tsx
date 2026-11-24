/**
 * More: a clean, grouped-list ERP settings and navigation centre in four sections:
 * BUSINESS, ADMINISTRATION, PREFERENCES & SECURITY, and ACCOUNT.
 * Sections with no permitted items are omitted automatically.
 */
import { Permission } from '@timbertrail/shared';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '../../../../components/Brand';
import { useConfirm } from '../../../../components/confirm';
import { useStatusBar } from '../../../../components/header';
import { Appear } from '../../../../components/motion';
import { Text } from '../../../../components/text';
import { Avatar, cn, Icon, MenuGroup, MenuRow, Overline } from '../../../../components/ui';
import { useAppLock } from '../../../../lib/app-lock';
import { APP_NAME } from '../../../../lib/brand';
import { useT } from '../../../../lib/i18n';
import { labelOf, MORE_GROUPS, visible } from '../../../../lib/nav';
import { useApi } from '../../../../lib/query';
import { useSession, useUser } from '../../../../lib/session';
import { useTabBarInset } from '../../../../lib/tab-chrome';
import { useThemeToggle } from '../../../../lib/theme';

function Group({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <Appear index={index} className="gap-2 pt-2">
      <Overline className="px-1">{title}</Overline>
      {children}
    </Appear>
  );
}

export default function MoreHome() {
  const t = useT();
  const router = useRouter();
  const user = useUser();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarInset();
  const { dark } = useThemeToggle();
  useStatusBar(dark);

  const { can, logout, simple } = useSession();
  const confirm = useConfirm();
  const lock = useAppLock();
  const pending = useApi<{ total: number }>(can(Permission.OPERATIONS_APPROVE) ? '/approvals/count' : null);

  const groups = MORE_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => visible(i, can, simple)),
  })).filter((g) => g.items.length > 0);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="grow" keyboardShouldPersistTaps="handled">
      <View style={{ paddingTop: insets.top }}>
        <View className="gap-3 px-4 pb-2 pt-2">
          <View className="min-h-[72px] justify-center">
            <Text className="pl-1 text-[30px] font-bold leading-9 tracking-tight text-foreground font-display" numberOfLines={1} accessibilityRole="header">
              {t('more')}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/more/settings')}
            accessibilityRole="button"
            accessibilityLabel={`${user.name}, ${t('securitySignIn')}`}
            className="min-h-[88px] flex-row items-center gap-3.5 rounded-3xl bg-card px-4 py-3.5 shadow-sm shadow-black/5 active:bg-secondary"
          >
            <Avatar name={user.name} size="lg" tone="hero" />
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-bold tracking-tight text-foreground font-display" numberOfLines={1}>
                {user.name}
              </Text>
              <Text className="text-[13px] font-medium text-muted-foreground" numberOfLines={1}>
                {can(Permission.DASHBOARD_OWNER) ? t('owner') : t('accountant')} · {user.mill.name}
              </Text>
            </View>
            <Icon name="chevron-right" size={18} colorClassName="accent-muted-foreground" />
          </Pressable>
        </View>
      </View>

      <View className="grow">
      <View className="grow gap-3 px-4 pt-2" style={{ paddingBottom: 32 + tabBar }}>
        {groups.map((g, gi) => (
          <Group key={g.labelKey} index={gi} title={t(g.labelKey)}>
            <MenuGroup inset>
              {g.items.map((item, idx) => (
                <MenuRow
                  key={item.key}
                  icon={item.icon}
                  title={t(labelOf(item, simple))}
                  badge={item.key === 'approvals' ? pending.data?.total : undefined}
                  last={idx === g.items.length - 1}
                  onPress={() => router.push(item.href as never)}
                />
              ))}
            </MenuGroup>
          </Group>
        ))}

        <Group index={groups.length} title={t('secPrefSecurity')}>
          <MenuGroup inset>
            <MenuRow
              icon="sliders"
              title={t('preferences')}
              onPress={() => router.push('/preferences')}
            />
            <MenuRow
              icon="bell"
              title={t('notifications')}
              onPress={() => router.push({ pathname: '/preferences', params: { section: 'notifications' } })}
            />
            <MenuRow
              icon="lock"
              title={t('securitySignIn')}
              value={lock.enabled ? t('switchOn') : undefined}
              last
              onPress={() => router.push('/more/settings')}
            />
          </MenuGroup>
        </Group>

        <Group index={groups.length + 1} title={t('account')}>
          <MenuGroup inset>
            <MenuRow
              icon="log-out"
              tone="bad"
              title={t('signOut')}
              last
              onPress={async () => {
                if (await confirm({ title: t('signOut'), message: t('logoutConfirm'), confirmText: t('signOut'), cancelText: t('cancel'), destructive: true })) {
                  await logout();
                }
              }}
            />
          </MenuGroup>
        </Group>

        <View className="items-center gap-1 pt-3">
          <View className="opacity-70">
            <BrandMark size="sm" onDark={false} />
          </View>
          <Text className="text-xs text-muted-foreground">
            {APP_NAME} · {t('version')} {Constants.expoConfig?.version ?? ''}
          </Text>
        </View>
      </View>
      </View>
    </ScrollView>
  );
}
