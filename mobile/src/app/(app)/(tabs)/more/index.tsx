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
import { Glow } from '../../../../components/glow';
import { SHEET_TOP, useStatusBar } from '../../../../components/header';
import { Appear } from '../../../../components/motion';
import { Text } from '../../../../components/text';
import { Avatar, cn, Icon, MenuGroup, MenuRow, Overline } from '../../../../components/ui';
import { useAppLock } from '../../../../lib/app-lock';
import { APP_NAME } from '../../../../lib/brand';
import { useT } from '../../../../lib/i18n';
import { MORE_GROUPS, visible } from '../../../../lib/nav';
import { useApi } from '../../../../lib/query';
import { useSession, useUser } from '../../../../lib/session';
import { useTabBarInset } from '../../../../lib/tab-chrome';

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
  useStatusBar(true);

  const { can, logout } = useSession();
  const confirm = useConfirm();
  const lock = useAppLock();
  const pending = useApi<{ total: number }>(can(Permission.OPERATIONS_APPROVE) ? '/approvals/count' : null);

  const groups = MORE_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => visible(i, can)),
  })).filter((g) => g.items.length > 0);

  return (
    <ScrollView className="flex-1 bg-hero" contentContainerClassName="grow" keyboardShouldPersistTaps="handled">
      <View className="overflow-hidden bg-hero" style={{ paddingTop: insets.top }}>
        <Glow />
        <View className="gap-2.5 px-4 pb-5 pt-2">
          <View className="min-h-10 justify-center">
            <Text className="pl-1 text-[22px] font-bold tracking-tight text-hero-foreground font-display" numberOfLines={1} accessibilityRole="header">
              {t('more')}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/more/settings')}
            accessibilityRole="button"
            accessibilityLabel={`${user.name}, ${t('securitySignIn')}`}
            className="min-h-[88px] flex-row items-center gap-3.5 rounded-2xl border border-hero-border bg-hero-chip px-4 py-3.5 active:opacity-85"
          >
            <Avatar name={user.name} size="lg" tone="saffron" />
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-bold tracking-tight text-hero-foreground font-display" numberOfLines={1}>
                {user.name}
              </Text>
              <Text className="text-[13px] font-medium text-hero-muted" numberOfLines={1}>
                {can(Permission.DASHBOARD_OWNER) ? t('owner') : t('accountant')} · {user.mill.name}
              </Text>
            </View>
            <Icon name="chevron-right" size={18} colorClassName="accent-hero-muted" />
          </Pressable>
        </View>
      </View>

      <View className={cn('grow gap-3 px-4 pt-5', SHEET_TOP)} style={{ paddingBottom: 32 + tabBar }}>
        {groups.map((g, gi) => (
          <Group key={g.labelKey} index={gi} title={t(g.labelKey)}>
            <MenuGroup inset>
              {g.items.map((item, idx) => (
                <MenuRow
                  key={item.key}
                  icon={item.icon}
                  title={t(item.labelKey)}
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
    </ScrollView>
  );
}
