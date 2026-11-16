/**
 * Settings: who you are (on the navy), then grouped rows — appearance and language on this
 * phone, app lock, the mill's settings (owner, opens its own form), help, about (with app
 * updates), and log out.
 */
import { Permission } from '@timbertrail/shared';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { BrandMark } from '../../../../components/Brand';
import { useConfirm } from '../../../../components/confirm';
import { Page, ScreenHeader } from '../../../../components/header';
import { Appear } from '../../../../components/motion';
import { Sheet, useSheet } from '../../../../components/sheet';
import { Text } from '../../../../components/text';
import { Avatar, Button, Chip, Icon, KV, LangPills, MenuGroup, MenuRow, Muted, Overline, Pill, Toggle } from '../../../../components/ui';
import { toast } from '../../../../components/toast';
import { useAppLock } from '../../../../lib/app-lock';
import { checkForAppUpdate, restartIntoUpdate, runningUpdateLabel, updatesOn, useUpdateWaiting } from '../../../../lib/app-updates';
import { APP_NAME } from '../../../../lib/brand';
import { useT } from '../../../../lib/i18n';
import { useSession, useUser } from '../../../../lib/session';
import { useThemeToggle } from '../../../../lib/theme';
import { applyReminder, DEFAULT_REMINDER, loadReminder, type ReminderSetting, useNotifications } from '../../../../lib/notifications';

export default function SettingsScreen() {
  const t = useT();
  const user = useUser();
  const router = useRouter();
  const { can, logout } = useSession();
  const confirm = useConfirm();
  const { dark, toggle } = useThemeToggle();
  const help = useSheet();
  const about = useSheet();
  const version = Constants.expoConfig?.version ?? '';
  const lock = useAppLock();
  const updateWaiting = useUpdateWaiting();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const runningUpdate = runningUpdateLabel();

  const checkUpdate = async () => {
    setCheckingUpdate(true);
    const r = await checkForAppUpdate();
    setCheckingUpdate(false);
    // 'downloaded' is announced by the "update ready" prompt (app/_layout.tsx)
    if (r === 'latest') toast(t('upToDate'));
    else if (r === 'failed') toast(t('updateCheckFailed'), 'error');
  };

  return (
    <View className="flex-1 bg-hero">
      <ScreenHeader title={t('settings')} back />
      <Page
        bottomInset={false}
        hero={
          <Appear className="items-center gap-3 pb-1">
            <Avatar name={user.name} size="lg" tone="saffron" />
            <View className="items-center gap-1">
              <Text className="text-xl font-bold tracking-tight text-hero-foreground font-display">{user.name}</Text>
              <Text className="text-[13px] text-hero-muted">
                @{user.username} · {can(Permission.DASHBOARD_OWNER) ? t('owner') : t('accountant')}
              </Text>
            </View>
            <View className="flex-row items-center gap-2 rounded-full bg-hero-chip py-1.5 pl-2.5 pr-3.5">
              <Icon name="building" size={15} colorClassName="accent-hero-foreground" />
              <Text className="text-[13px] font-medium text-hero-foreground">{user.mill.name}</Text>
            </View>
          </Appear>
        }
      >
        <Overline className="px-1">{t('appearance')}</Overline>
        <MenuGroup>
          <MenuRow icon={dark ? 'moon' : 'sun'} title={t('darkMode')} right={<Toggle value={dark} onChange={toggle} label={t('darkMode')} />} />
          <MenuRow icon="languages" title={t('language')} last right={<LangPills />} />
        </MenuGroup>

        <Overline className="mt-3 px-1">{t('appLock')}</Overline>
        <MenuGroup>
          <MenuRow icon="lock" title={t('appLock')} subtitle={t('appLockSub')} value={lock.enabled ? t('switchOn') : t('switchOff')} last onPress={() => router.push('/app-lock')} />
        </MenuGroup>

        <NotificationSettings />

        {can(Permission.SETTINGS_MANAGE) && (
          <>
            <Overline className="mt-3 px-1">{t('navAdmin')}</Overline>
            <MenuGroup>
              <MenuRow icon="building" title={t('millSettings')} subtitle={t('millSettingsSub')} last onPress={() => router.push('/mill-settings')} />
            </MenuGroup>
          </>
        )}

        <Overline className="mt-3 px-1">{t('support')}</Overline>
        <MenuGroup>
          <MenuRow icon="help" title={t('helpSupport')} onPress={help.open} />
          <MenuRow icon="info" title={t('aboutApp')} value={updateWaiting ? t('updateReady') : `v${version}`} last onPress={about.open} />
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

        <Muted className="pt-2 text-center">
          {APP_NAME} · {t('version')} {version}
        </Muted>
      </Page>

      <Sheet ref={help.ref} title={t('helpSupport')}>
        <View className="gap-4 px-5">
          {(['helpStep1', 'helpStep2', 'helpStep3'] as const).map((k, i) => (
            <View key={k} className="flex-row gap-3.5">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-saffron">
                <Text className="text-[13px] font-bold text-saffron-foreground">{i + 1}</Text>
              </View>
              <Text className="flex-1 pt-1 text-[15px] leading-[22px] text-foreground">{t(k)}</Text>
            </View>
          ))}
          <View className="mt-1 flex-row gap-3 rounded-2xl bg-background p-4">
            <Icon name="info" size={18} colorClassName="accent-muted-foreground" />
            <Text className="flex-1 text-[13px] leading-[19px] text-muted-foreground">{t('helpContact')}</Text>
          </View>
        </View>
      </Sheet>

      <Sheet ref={about.ref}>
        <View className="gap-5 px-5 pb-2">
          <View className="items-center rounded-3xl bg-hero py-8">
            <BrandMark size="md" tagline={t('appTagline')} />
          </View>
          <View className="gap-2.5 px-1">
            <KV label={t('version')} value={version || '—'} />
            {runningUpdate && <KV label={t('appUpdate')} value={runningUpdate} />}
            <KV label={t('millName')} value={user.mill.name} />
            <KV label={t('millCode')} value={user.mill.code} />
          </View>
          {updatesOn &&
            (updateWaiting ? (
              <Button icon="refresh-cw" title={t('restartNow')} onPress={() => void restartIntoUpdate()} />
            ) : (
              <Button kind="secondary" size="md" icon="refresh-cw" title={t('checkUpdates')} busy={checkingUpdate} onPress={() => void checkUpdate()} />
            ))}
          <Muted className="text-center">© {new Date().getFullYear()} {APP_NAME}</Muted>
        </View>
      </Sheet>
    </View>
  );
}

const REMINDER_HOURS = [16, 17, 18, 19, 20, 21];
const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;

/** Push permission for this phone, and the daily reminder (a local notification). */
function NotificationSettings() {
  const t = useT();
  const { status, refresh } = useNotifications();
  const [reminder, setReminder] = useState<ReminderSetting>(DEFAULT_REMINDER);
  useEffect(() => {
    void loadReminder().then(setReminder);
  }, []);
  const save = async (r: ReminderSetting) => {
    setReminder(r); // feels instant; corrected below if permission is refused
    setReminder(await applyReminder(r, { title: t('reminderTitle'), body: t('reminderBody') }));
  };
  const on = status === 'granted';

  return (
    <>
      <Overline className="mt-3 px-1">{t('notifications')}</Overline>
      <MenuGroup>
        <MenuRow
          icon="bell"
          title={t('pushNotifications')}
          subtitle={on ? t('pushOnSub') : status === 'unavailable' ? undefined : t('pushOffSub')}
          right={<Pill tone={on ? 'good' : status === 'denied' ? 'bad' : undefined} text={on ? 'ON' : 'OFF'} />}
          onPress={on ? undefined : () => (status === 'denied' ? void Linking.openSettings() : refresh())}
        />
        <MenuRow
          icon="clock"
          title={t('dailyReminder')}
          subtitle={reminder.on ? `${t('remindAt')} ${hourLabel(reminder.hour)}` : t('dailyReminderSub')}
          last={!reminder.on}
          right={<Toggle value={reminder.on} onChange={(v) => void save({ ...reminder, on: v })} label={t('dailyReminder')} />}
        />
        {reminder.on && (
          <View className="px-4 pb-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pl-[52px]">
              {REMINDER_HOURS.map((h) => (
                <Chip key={h} text={hourLabel(h)} on={reminder.hour === h} onPress={() => void save({ ...reminder, hour: h })} />
              ))}
            </ScrollView>
          </View>
        )}
      </MenuGroup>
    </>
  );
}
