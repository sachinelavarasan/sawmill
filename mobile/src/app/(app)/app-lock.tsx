/**
 * Settings → App lock: set a 4-digit PIN (chosen twice), turn fingerprint unlock on or off,
 * change the PIN, or turn the lock off. Changing anything once a PIN exists asks for it first,
 * so someone else holding the phone can't remove the lock. See lib/app-lock.tsx.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Page, ScreenHeader } from '../../components/header';
import { PinPad } from '../../components/PinPad';
import { toast } from '../../components/toast';
import { Button, MenuGroup, MenuRow, Muted, Notice, Toggle } from '../../components/ui';
import { biometricAvailable, useAppLock } from '../../lib/app-lock';
import { useT } from '../../lib/i18n';

type Step = 'verify' | 'choose' | 'confirm' | 'manage';

export default function AppLockScreen() {
  const t = useT();
  const router = useRouter();
  const lock = useAppLock();
  const [step, setStep] = useState<Step>(lock.enabled ? 'verify' : 'choose');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [canBio, setCanBio] = useState(false);

  useEffect(() => {
    void biometricAvailable().then(setCanBio);
  }, []);

  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };

  const title = { verify: t('currentPin'), choose: t('setPin'), confirm: t('confirmPin'), manage: t('appLock') }[step];

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader compact back title={t('appLock')} subtitle={t('appLockSub')} />
      <Page compact>
        {step === 'verify' && (
          <PinPad
            title={title}
            error={error}
            onComplete={async (pin) => {
              if (await lock.checkPin(pin)) go('manage');
              else setError(t('wrongPinPlain'));
            }}
          />
        )}

        {step === 'choose' && (
          <PinPad
            title={title}
            error={error}
            resetKey={step}
            onComplete={(pin) => {
              setFirst(pin);
              go('confirm');
            }}
          />
        )}

        {step === 'confirm' && (
          <PinPad
            title={title}
            error={error}
            resetKey={step}
            onComplete={async (pin) => {
              if (pin !== first) {
                setFirst('');
                setStep('choose');
                setError(t('pinMismatch'));
                return;
              }
              const wasOn = lock.enabled;
              await lock.enable(pin, wasOn ? lock.biometric : false);
              toast(wasOn ? t('saved') : t('appLockOnToast'));
              go('manage');
            }}
          />
        )}

        {step === 'manage' && (
          <View className="gap-4">
            <MenuGroup>
              {canBio && (
                <MenuRow
                  icon="fingerprint"
                  title={t('useFingerprint')}
                  subtitle={t('useFingerprintSub')}
                  right={<Toggle value={lock.biometric} onChange={(on) => void lock.setBiometric(on)} label={t('useFingerprint')} />}
                />
              )}
              <MenuRow icon="lock" title={t('changePin')} last onPress={() => go('choose')} />
            </MenuGroup>
            <Notice icon="info" tone="info">
              {t('appLockNote')}
            </Notice>
            <Button
              kind="danger"
              size="md"
              icon="x"
              title={t('turnOffLock')}
              onPress={async () => {
                await lock.disable();
                toast(t('appLockOffToast'));
                router.back();
              }}
            />
            <Muted className="text-center">{t('appLockSub')}</Muted>
          </View>
        )}
      </Page>
    </View>
  );
}
