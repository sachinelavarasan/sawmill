import { usePreventRemove } from 'expo-router/react-navigation';
import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfirm } from '../components/confirm';
import { useT } from './i18n';

/**
 * Run a save / submit at most once at a time: a second tap while the first request
 * is still out does nothing. Returns [run, busy, error, setError].
 */
export function useSubmit<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (...args: A): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        await fn(...args);
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [fn],
  );
  return [run, busy, error, setError] as const;
}

/**
 * Ask before leaving a form with unsaved changes (back button, swipe, header back).
 * Call the returned `release()` right before navigating away after a successful save.
 */
export function useUnsavedGuard(dirty: boolean) {
  const t = useT();
  const navigation = useNavigation();
  const confirm = useConfirm();
  const released = useRef(false);
  usePreventRemove(dirty, ({ data }) => {
    if (released.current) {
      navigation.dispatch(data.action);
      return;
    }
    void confirm({
      title: t('leaveTitle'),
      message: t('unsavedChanges'),
      confirmText: t('discardChanges'),
      cancelText: t('keepEditing'),
      destructive: true,
    }).then((ok) => {
      if (ok) navigation.dispatch(data.action);
    });
  });
  return useCallback(() => {
    released.current = true;
  }, []);
}

/** A value that only updates after it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
