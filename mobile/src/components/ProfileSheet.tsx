import { Permission } from '@sawmill/shared';
import { useRouter } from 'expo-router';
import { forwardRef } from 'react';
import { Text, View } from 'react-native';
import { useT } from '../lib/i18n';
import { useSession, useUser } from '../lib/session';
import { useConfirm } from './confirm';
import { Sheet, type SheetHandle } from './sheet';
import { Avatar, Button, LangToggle, MenuGroup, MenuRow, Muted, ThemeToggle } from './ui';

/** Who is signed in, language and theme, settings, and log out. */
export const ProfileSheet = forwardRef<SheetHandle>(function ProfileSheet(_, ref) {
  const t = useT();
  const user = useUser();
  const { can, logout } = useSession();
  const router = useRouter();
  const confirm = useConfirm();
  const close = () => (ref as React.RefObject<SheetHandle | null>).current?.close();

  return (
    <Sheet ref={ref}>
      <View className="gap-4 px-5">
        <View className="flex-row items-center gap-3">
          <Avatar name={user.name} size="lg" />
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{user.name}</Text>
            <Muted>
              {can(Permission.DASHBOARD_OWNER) ? t('owner') : t('accountant')} · @{user.username}
            </Muted>
            <Muted>{user.mill.name}</Muted>
          </View>
        </View>
        <View className="gap-2">
          <Muted>{t('language')}</Muted>
          <View className="flex-row items-center gap-2.5">
            <View className="flex-1">
              <LangToggle />
            </View>
            <ThemeToggle />
          </View>
        </View>
        <MenuGroup>
          <MenuRow
            icon="sliders"
            title={t('settings')}
            last
            onPress={() => {
              close();
              router.push('/more/settings');
            }}
          />
        </MenuGroup>
        <Button
          kind="danger"
          icon="log-out"
          title={t('logout')}
          onPress={async () => {
            close();
            if (await confirm({ title: t('logout'), message: t('logoutConfirm'), confirmText: t('logout'), cancelText: t('cancel'), destructive: true })) await logout();
          }}
        />
      </View>
    </Sheet>
  );
});
