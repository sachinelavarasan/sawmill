import { Permission } from '@sawmill/shared';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useConfirm } from '../../../../components/confirm';
import { Page, ScreenHeader } from '../../../../components/header';
import { Avatar, MenuGroup, MenuRow, Muted, SectionTitle } from '../../../../components/ui';
import { useT } from '../../../../lib/i18n';
import { MORE_GROUPS, visible } from '../../../../lib/nav';
import { useSession, useUser } from '../../../../lib/session';

/** More: stock, parties, accounts and administration — whatever this person may open. */
export default function MoreHome() {
  const t = useT();
  const router = useRouter();
  const user = useUser();
  const { can, logout } = useSession();
  const confirm = useConfirm();
  const groups = MORE_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => visible(i, can)) })).filter((g) => g.items.length);

  return (
    <>
      <ScreenHeader title={t('more')} large />
      <Page bottomInset={false}>
        <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Avatar name={user.name} size="lg" />
          <View className="flex-1">
            <Text className="text-base font-bold text-foreground">{user.name}</Text>
            <Muted>
              {can(Permission.DASHBOARD_OWNER) ? t('owner') : t('accountant')} · {user.mill.name}
            </Muted>
          </View>
        </View>

        {groups.map((g) => (
          <View key={g.labelKey} className="gap-2">
            <SectionTitle>{t(g.labelKey)}</SectionTitle>
            <MenuGroup>
              {g.items.map((i, n) => (
                <MenuRow key={i.key} icon={i.icon} title={t(i.labelKey)} last={n === g.items.length - 1} onPress={() => router.push(i.href as never)} />
              ))}
            </MenuGroup>
          </View>
        ))}

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
        <Muted className="text-center">
          TimberTrail · {t('version')} {Constants.expoConfig?.version ?? ''}
        </Muted>
      </Page>
    </>
  );
}
