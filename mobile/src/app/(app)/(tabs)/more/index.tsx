/**
 * More: everything that isn't a bottom tab, in sections — Operations, Business management,
 * Accounts, Personalisation, Administration — showing only what this person may open (a section
 * with nothing allowed is left out). Then Settings and Log out, and the version.
 *
 * Modules are two-across tiles (icon beside a name that wraps to two lines, for Tamil);
 * personal choices are grouped rows that open Preferences at the right place.
 */
import { Permission } from '@timbertrail/shared';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { BrandMark } from '../../../../components/Brand';
import { useConfirm } from '../../../../components/confirm';
import { Page, ScreenHeader } from '../../../../components/header';
import { Appear } from '../../../../components/motion';
import { Text } from '../../../../components/text';
import { Avatar, Icon, LangPills, MenuGroup, MenuRow, Overline, Tile, TileGrid } from '../../../../components/ui';
import { APP_NAME } from '../../../../lib/brand';
import { useT } from '../../../../lib/i18n';
import { type MenuItem, MORE_GROUPS, visible } from '../../../../lib/nav';
import { useApi } from '../../../../lib/query';
import { useSession, useUser } from '../../../../lib/session';
import { usePreferences } from '../../../../services/preferences';

function Group({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <Appear index={index} className="gap-2.5 pt-2">
      <Overline className="px-1">{title}</Overline>
      {children}
    </Appear>
  );
}

export default function MoreHome() {
  const t = useT();
  const router = useRouter();
  const user = useUser();
  const { can, logout } = useSession();
  const confirm = useConfirm();
  const { theme } = usePreferences();
  const pending = useApi<{ total: number }>(can(Permission.OPERATIONS_APPROVE) ? '/approvals/count' : null);
  const groups = MORE_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => visible(i, can)) })).filter((g) => g.items.length);
  // Administration goes after Personalisation; the rest before it
  const admin = groups.filter((g) => g.labelKey === 'navAdmin');
  const modules = groups.filter((g) => g.labelKey !== 'navAdmin');
  const themeLabel = t(theme === 'dark' ? 'themeDark' : theme === 'system' ? 'themeSystem' : 'themeLight');

  const tiles = (items: MenuItem[]) => (
    <TileGrid columns={2}>
      {items.map((i) => (
        <Tile
          key={i.key}
          variant="row"
          icon={i.icon}
          tone={i.tone}
          title={t(i.labelKey)}
          badge={i.key === 'approvals' ? pending.data?.total : undefined}
          onPress={() => router.push(i.href as never)}
        />
      ))}
    </TileGrid>
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('more')} large>
        <Pressable
          onPress={() => router.push('/more/settings')}
          accessibilityRole="button"
          accessibilityLabel={`${user.name}, ${t('settings')}`}
          className="flex-row items-center gap-3.5 rounded-2xl bg-hero-chip p-3.5 active:opacity-85"
        >
          <Avatar name={user.name} size="lg" tone="saffron" />
          <View className="flex-1 gap-0.5">
            <Text className="text-base font-semibold text-hero-foreground" numberOfLines={1}>
              {user.name}
            </Text>
            <Text className="text-[13px] text-hero-muted" numberOfLines={1}>
              {can(Permission.DASHBOARD_OWNER) ? t('owner') : t('accountant')} · {user.mill.name}
            </Text>
          </View>
          <Icon name="chevron-right" size={18} colorClassName="accent-hero-muted" />
        </Pressable>
      </ScreenHeader>

      <Page bottomInset={false}>
        {modules.map((g, gi) => (
          <Group key={g.labelKey} index={gi} title={t(g.labelKey)}>
            {tiles(g.items)}
          </Group>
        ))}

        <Group index={modules.length} title={t('personalisation')}>
          <MenuGroup inset>
            <MenuRow icon="sliders" title={t('preferences')} subtitle={t('preferencesSub')} onPress={() => router.push('/preferences')} />
            <MenuRow icon="bell" title={t('notifications')} onPress={() => router.push({ pathname: '/preferences', params: { section: 'notifications' } })} />
            <MenuRow icon="languages" title={t('language')} right={<LangPills />} />
            <MenuRow
              icon={theme === 'dark' ? 'moon' : 'sun'}
              title={t('appearance')}
              value={themeLabel}
              last
              onPress={() => router.push({ pathname: '/preferences', params: { section: 'appearance' } })}
            />
          </MenuGroup>
        </Group>

        {admin.map((g) => (
          <Group key={g.labelKey} index={modules.length + 1} title={t(g.labelKey)}>
            {tiles(g.items)}
          </Group>
        ))}

        <Appear index={modules.length + 2} className="pt-2">
          <MenuGroup inset>
            <MenuRow icon="settings-2" title={t('settings')} subtitle={t('appLockSub')} onPress={() => router.push('/more/settings')} />
            <MenuRow
              icon="log-out"
              tone="bad"
              title={t('logout')}
              last
              onPress={async () => {
                if (await confirm({ title: t('logout'), message: t('logoutConfirm'), confirmText: t('logout'), cancelText: t('cancel'), destructive: true })) await logout();
              }}
            />
          </MenuGroup>
        </Appear>

        <View className="items-center gap-1 pt-2">
          <View className="opacity-70">
            <BrandMark size="sm" onDark={false} />
          </View>
          <Text className="text-xs text-muted-foreground">
            {APP_NAME} · {t('version')} {Constants.expoConfig?.version ?? ''}
          </Text>
        </View>
      </Page>
    </View>
  );
}
