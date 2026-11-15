/**
 * More: the menu for everything that isn't a bottom tab — loads in and out, measuring,
 * approvals, parties, money and administration — showing only what this person may open.
 */
import { Permission } from '@timbertrail/shared';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { BrandMark } from '../../../../components/Brand';
import { useConfirm } from '../../../../components/confirm';
import { Page, ScreenHeader } from '../../../../components/header';
import { Text } from '../../../../components/text';
import { Appear } from '../../../../components/motion';
import { Avatar, Icon, MenuGroup, MenuRow, Overline, Tile, TileGrid, Toggle } from '../../../../components/ui';
import { APP_NAME } from '../../../../lib/brand';
import { useT } from '../../../../lib/i18n';
import { MORE_GROUPS, visible } from '../../../../lib/nav';
import { useApi } from '../../../../lib/query';
import { useSession, useUser } from '../../../../lib/session';
import { useThemeToggle } from '../../../../lib/theme';

export default function MoreHome() {
  const t = useT();
  const router = useRouter();
  const user = useUser();
  const { can, logout } = useSession();
  const confirm = useConfirm();
  const { dark, toggle } = useThemeToggle();
  const pending = useApi<{ total: number }>(can(Permission.OPERATIONS_APPROVE) ? '/approvals/count' : null);
  const groups = MORE_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => visible(i, can)) })).filter((g) => g.items.length);

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
        {groups.map((g, gi) => (
          <Appear key={g.labelKey} index={gi} className="gap-3">
            <Overline className={gi ? 'mt-3 px-1' : 'px-1'}>{t(g.labelKey)}</Overline>
            <TileGrid columns={3}>
              {g.items.map((i) => (
                <Tile
                  key={i.key}
                  icon={i.icon}
                  tone={i.tone}
                  title={t(i.labelKey)}
                  badge={i.key === 'approvals' ? pending.data?.total : undefined}
                  onPress={() => router.push(i.href as never)}
                />
              ))}
            </TileGrid>
          </Appear>
        ))}

        <Overline className="mt-3 px-1">{t('appearance')}</Overline>
        <MenuGroup>
          <MenuRow icon={dark ? 'moon' : 'sun'} title={t('darkMode')} last right={<Toggle value={dark} onChange={toggle} label={t('darkMode')} />} />
        </MenuGroup>

        <MenuGroup>
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

        <View className="items-center gap-1 pt-4">
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
