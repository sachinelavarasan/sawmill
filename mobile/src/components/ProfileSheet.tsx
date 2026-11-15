/**
 * Opened from the avatar on Home: who is signed in (navy identity card), dark mode and
 * language for this phone, a way into Settings, and log out.
 */
import { Permission } from '@timbertrail/shared';
import { useRouter } from 'expo-router';
import { forwardRef } from 'react';
import { View } from 'react-native';
import { useT } from '../lib/i18n';
import { useSession, useUser } from '../lib/session';
import { useThemeToggle } from '../lib/theme';
import { useConfirm } from './confirm';
import { Sheet, type SheetHandle } from './sheet';
import { Text } from './text';
import { Avatar, Icon, LangPills, MenuGroup, MenuRow, Toggle } from './ui';

export const ProfileSheet = forwardRef<SheetHandle>(function ProfileSheet(_, ref) {
  const t = useT();
  const user = useUser();
  const { can, logout } = useSession();
  const { dark, toggle } = useThemeToggle();
  const router = useRouter();
  const confirm = useConfirm();
  const close = () => (ref as React.RefObject<SheetHandle | null>).current?.close();
  const owner = can(Permission.DASHBOARD_OWNER);

  return (
    <Sheet ref={ref}>
      <View className="gap-2 px-4">
        {/* identity */}
        <View className="gap-4 rounded-3xl bg-hero p-5">
          <View className="flex-row items-center gap-3.5">
            <Avatar name={user.name} size="lg" tone="saffron" />
            <View className="flex-1 gap-0.5">
              <Text className="text-lg font-bold tracking-tight text-hero-foreground font-display" numberOfLines={1}>
                {user.name}
              </Text>
              <Text className="text-[13px] text-hero-muted" numberOfLines={1}>
                @{user.username}
              </Text>
            </View>
            <View className="rounded-full bg-saffron px-3 py-1">
              <Text className="text-xs font-semibold text-saffron-foreground">{owner ? t('owner') : t('accountant')}</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2 border-t border-hero-border pt-4">
            <Icon name="building" size={15} colorClassName="accent-saffron" />
            <Text className="flex-1 text-[13px] font-medium text-hero-foreground" numberOfLines={1}>
              {user.mill.name}
            </Text>
            <Text className="text-xs text-hero-muted">{user.mill.code}</Text>
          </View>
        </View>

        {/* this phone */}
        <MenuGroup>
          <MenuRow icon={dark ? 'moon' : 'sun'} title={t('darkMode')} right={<Toggle value={dark} onChange={toggle} label={t('darkMode')} />} />
          <MenuRow icon="languages" title={t('language')} right={<LangPills />} />
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
              if (await confirm({ title: t('logout'), message: t('logoutConfirm'), confirmText: t('logout'), cancelText: t('cancel'), destructive: true })) await logout();
            }}
          />
        </MenuGroup>
      </View>
    </Sheet>
  );
});
