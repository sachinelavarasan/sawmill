/**
 * The app lock screen (lib/app-lock.tsx), drawn over everything while locked: PIN pad, the
 * fingerprint key when turned on (and offered straight away), and "Sign in with password instead".
 * While the lock setting is still being read at start-up it is a plain navy cover, so the app
 * never flashes into view before the lock decides.
 */
import { useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_TRIES, useAppLock } from '../lib/app-lock';
import { useT } from '../lib/i18n';
import { useSession } from '../lib/session';
import { BrandMark } from './Brand';
import { PinPad } from './PinPad';
import { Text } from './text';
import { Avatar, Button } from './ui';

export function LockScreen() {
  const lock = useAppLock();
  const { user, logout } = useSession();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const prompted = useRef(false);
  const show = !!user && (lock.checking || lock.locked);

  // offer the fingerprint once each time the lock appears
  useEffect(() => {
    if (!lock.locked) {
      prompted.current = false;
      setError(null);
      return;
    }
    if (lock.biometric && !prompted.current) {
      prompted.current = true;
      void lock.unlockWithBiometric(t('unlockPrompt'), t('cancel'));
    }
  }, [lock.locked, lock.biometric, lock, t]);

  // Android back must not slip past the lock
  useEffect(() => {
    if (!show) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [show]);

  if (!show || !user) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]} className="z-50 items-center justify-between bg-hero px-6">
      {lock.locked && (
        <>
          <View className="items-center gap-4">
            <BrandMark size="sm" />
            <View className="items-center gap-2">
              <Avatar name={user.name} size="md" tone="saffron" />
              <Text className="text-base font-semibold text-hero-foreground">{user.name}</Text>
            </View>
          </View>
          <PinPad
            onDark
            title={t('enterPin')}
            error={error}
            extraKey={lock.biometric ? { icon: 'fingerprint', label: t('useFingerprint'), onPress: () => void lock.unlockWithBiometric(t('unlockPrompt'), t('cancel')) } : undefined}
            onComplete={async (pin) => {
              const ok = await lock.unlockWithPin(pin);
              if (!ok) setError(t('wrongPin', { n: Math.max(0, MAX_TRIES - lock.tries - 1) }));
            }}
          />
          <Button kind="ghost" size="md" title={t('usePassword')} onPress={() => void logout()} />
        </>
      )}
    </View>
  );
}
