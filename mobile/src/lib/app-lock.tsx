/**
 * App lock: a 4-digit PIN (and optionally the phone's fingerprint) instead of the
 * password, for staying signed in on a yard phone.
 *
 *  - Each person sets their own PIN on this phone (Settings → App lock). It is kept as a salted
 *    SHA-256 hash in the secure store under that person's id — never the PIN itself, never sent
 *    to the server. On a shared phone everyone has their own.
 *  - The app locks when it is opened with a saved login, and after 3 minutes in the background.
 *    Not straight after a password sign-in.
 *  - Unlock: the PIN, or fingerprint if turned on. "Use password instead" signs out (the password
 *    always works). Five wrong PINs in a row also sign out.
 *
 * Fingerprint caveat: Android accepts ANY fingerprint saved on the phone, so on a shared phone
 * the setup screen recommends the PIN alone.
 */
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSession } from './session';

export const PIN_LENGTH = 4;
export const MAX_TRIES = 5;
const LOCK_AFTER_MS = 3 * 60_000;

interface LockConfig {
  salt: string;
  hash: string;
  biometric: boolean;
}

const keyFor = (userId: string) => `timbertrail_lock_${userId}`;
const hashPin = (salt: string, pin: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);

async function readConfig(userId: string): Promise<LockConfig | null> {
  try {
    const raw = await SecureStore.getItemAsync(keyFor(userId));
    return raw ? (JSON.parse(raw) as LockConfig) : null;
  } catch {
    return null;
  }
}

/** Does this phone have a fingerprint reader with a fingerprint saved? */
export async function biometricAvailable(): Promise<boolean> {
  try {
    const kinds = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (!kinds.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return false;
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

interface AppLock {
  /** a PIN is set for the signed-in person */
  enabled: boolean;
  biometric: boolean;
  /** the lock screen is showing */
  locked: boolean;
  /** still reading this person's lock setting at start-up (show nothing yet) */
  checking: boolean;
  /** wrong PINs so far on this lock screen */
  tries: number;
  enable: (pin: string, biometric: boolean) => Promise<void>;
  setBiometric: (on: boolean) => Promise<void>;
  disable: () => Promise<void>;
  /** true = unlocked. After MAX_TRIES wrong ones the person is signed out. */
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometric: (prompt: string, cancel: string) => Promise<boolean>;
  /** confirm the current PIN (to turn the lock off or change it) without touching the lock state */
  checkPin: (pin: string) => Promise<boolean>;
}

const Ctx = createContext<AppLock | null>(null);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const { user, booting, logout } = useSession();
  const userId = user?.id ?? null;
  const [config, setConfig] = useState<LockConfig | null>(null);
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tries, setTries] = useState(0);
  /** the fingerprint prompt itself can send the app to the background: don't count that */
  const authenticating = useRef(false);
  const backgroundSince = useRef<number | null>(null);
  /** whether this session came from a saved login at start-up (lock) or a password just typed (don't) */
  const restored = useRef<boolean | null>(null);

  // Read this person's setting whenever who is signed in changes.
  useEffect(() => {
    if (booting) return;
    if (restored.current === null) restored.current = !!userId; // signed in already at start-up
    if (!userId) {
      setConfig(null);
      setLocked(false);
      setChecking(false);
      return;
    }
    let live = true;
    const fromSavedLogin = restored.current === true;
    restored.current = false; // later sign-ins on this run are password sign-ins
    setChecking(true);
    void readConfig(userId).then((c) => {
      if (!live) return;
      setConfig(c);
      setLocked(!!c && fromSavedLogin);
      setTries(0);
      setChecking(false);
    });
    return () => {
      live = false;
    };
  }, [userId, booting]);

  // Lock again after a while in the background.
  useEffect(() => {
    if (!config) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (authenticating.current) return;
      if (s === 'background') backgroundSince.current = Date.now();
      else if (s === 'active') {
        const since = backgroundSince.current;
        backgroundSince.current = null;
        if (since && Date.now() - since >= LOCK_AFTER_MS) {
          setTries(0);
          setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, [config]);

  const save = useCallback(
    async (c: LockConfig | null) => {
      if (!userId) return;
      if (c) await SecureStore.setItemAsync(keyFor(userId), JSON.stringify(c));
      else await SecureStore.deleteItemAsync(keyFor(userId));
      setConfig(c);
    },
    [userId],
  );

  const checkPin = useCallback(async (pin: string) => !!config && (await hashPin(config.salt, pin)) === config.hash, [config]);

  const value = useMemo<AppLock>(
    () => ({
      enabled: !!config,
      biometric: !!config?.biometric,
      locked: locked && !!config,
      checking,
      tries,
      enable: async (pin, biometric) => {
        const salt = Crypto.randomUUID();
        await save({ salt, hash: await hashPin(salt, pin), biometric });
      },
      setBiometric: async (on) => {
        if (config) await save({ ...config, biometric: on });
      },
      disable: () => save(null),
      checkPin,
      unlockWithPin: async (pin) => {
        if (await checkPin(pin)) {
          setTries(0);
          setLocked(false);
          return true;
        }
        const next = tries + 1;
        setTries(next);
        if (next >= MAX_TRIES) {
          setLocked(false);
          await logout(); // the password is the way back in
        }
        return false;
      },
      unlockWithBiometric: async (promptMessage, cancelLabel) => {
        if (!config?.biometric) return false;
        authenticating.current = true;
        try {
          // the PIN pad is right there, so no device-PIN fallback inside the prompt
          // 'strong' = fingerprint-class sensors only, never the camera face unlock most Android phones offer
          const r = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel, disableDeviceFallback: true, biometricsSecurityLevel: 'strong' });
          if (r.success) {
            setTries(0);
            setLocked(false);
          }
          return r.success;
        } catch {
          return false;
        } finally {
          authenticating.current = false;
        }
      },
    }),
    [config, locked, checking, tries, save, checkPin, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppLock() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppLock outside AppLockProvider');
  return ctx;
}
