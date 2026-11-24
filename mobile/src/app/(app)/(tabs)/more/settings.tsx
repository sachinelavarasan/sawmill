/**
 * Security & Sign-in: PIN configuration, biometric authentication, authentication preferences,
 * plus Help & About. Preserves existing authentication and security logic.
 */
import { Permission } from '@timbertrail/shared';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppBottomSheet, useSheet } from '../../../../components/bottom-sheet';
import { BrandMark } from '../../../../components/Brand';
import { Page, ScreenHeader } from '../../../../components/header';
import { Appear } from '../../../../components/motion';
import { Text } from '../../../../components/text';
import { toast } from '../../../../components/toast';
import { Avatar, Button, Icon, KV, MenuGroup, MenuRow, Muted, Overline, Toggle } from '../../../../components/ui';
import { biometricAvailable, useAppLock } from '../../../../lib/app-lock';
import { checkForAppUpdate, restartIntoUpdate, runningUpdateLabel, updatesOn, useUpdateWaiting } from '../../../../lib/app-updates';
import { APP_NAME } from '../../../../lib/brand';
import { useT } from '../../../../lib/i18n';
import { useSession, useUser } from '../../../../lib/session';

export default function SecuritySignInScreen() {
  const t = useT();
  const user = useUser();
  const router = useRouter();
  const { can } = useSession();
  const help = useSheet();
  const about = useSheet();
  const version = Constants.expoConfig?.version ?? '';
  const lock = useAppLock();
  const updateWaiting = useUpdateWaiting();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [canBio, setCanBio] = useState(false);
  const runningUpdate = runningUpdateLabel();

  useEffect(() => {
    void biometricAvailable().then(setCanBio);
  }, []);

  const checkUpdate = async () => {
    setCheckingUpdate(true);
    const r = await checkForAppUpdate();
    setCheckingUpdate(false);
    if (r === 'latest') toast(t('upToDate'));
    else if (r === 'failed') toast(t('updateCheckFailed'), 'error');
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader compact title={t('securitySignIn')} back />
      <Page
        compact
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
        <Overline className="px-1">{t('appLock')}</Overline>
        <MenuGroup inset>
          <MenuRow
            icon="lock"
            title={t('pinConfig')}
            subtitle={t('appLockSub')}
            value={lock.enabled ? t('switchOn') : t('switchOff')}
            last={!(canBio && lock.enabled)}
            onPress={() => router.push('/app-lock')}
          />
          {canBio && lock.enabled && (
            <MenuRow
              icon="fingerprint"
              title={t('biometricAuth')}
              subtitle={t('useFingerprintSub')}
              last
              right={<Toggle value={lock.biometric} onChange={(on) => void lock.setBiometric(on)} label={t('biometricAuth')} />}
            />
          )}
        </MenuGroup>

        <Overline className="mt-3 px-1">{t('support')}</Overline>
        <MenuGroup inset>
          <MenuRow icon="help" title={t('helpSupport')} onPress={help.open} />
          <MenuRow icon="info" title={t('aboutApp')} value={updateWaiting ? t('updateReady') : `v${version}`} last onPress={about.open} />
        </MenuGroup>

        <Muted className="pt-2 text-center">
          {APP_NAME} · {t('version')} {version}
        </Muted>
      </Page>

      <AppBottomSheet ref={help.ref} variant="medium" title={t('helpSupport')}>
        <View className="gap-4">
          {(['helpStep1', 'helpStep2', 'helpStep3'] as const).map((k, i) => (
            <View key={k} className="flex-row gap-3.5">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-saffron">
                <Text className="text-[13px] font-bold text-saffron-foreground">{i + 1}</Text>
              </View>
              <Text className="flex-1 pt-1 text-[15px] leading-[22px] text-foreground">{t(k)}</Text>
            </View>
          ))}
          <View className="mt-1 flex-row gap-3 rounded-3xl bg-card p-4 shadow-sm shadow-black/5">
            <Icon name="info" size={18} colorClassName="accent-muted-foreground" />
            <Text className="flex-1 text-[13px] leading-[19px] text-muted-foreground">{t('helpContact')}</Text>
          </View>
        </View>
      </AppBottomSheet>

      <AppBottomSheet ref={about.ref} variant="medium" showClose>
        <View className="gap-5 pb-2">
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
      </AppBottomSheet>
    </View>
  );
}
