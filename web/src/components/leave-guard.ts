/**
 * Ask before leaving a form with unsaved changes — the web twin of the phone app's useUnsavedGuard.
 *
 *   const release = useLeaveGuard(dirty);
 *   …after a successful save: release(); navigate(...)
 *
 * Covers every way of leaving:
 *  - any navigation inside the app — links, the sidebar, the browser's Back and Forward buttons,
 *    and navigate() calls — is held by React Router's useBlocker and goes ahead only if the
 *    person chooses "Discard changes" in the app's confirm dialog;
 *  - closing or reloading the tab, or typing another address: the browser's own "Leave site?" prompt.
 * A jump within the same page (#section, ?query) is never held.
 *
 * Needs the data router set up in main.tsx. A router holds one blocker at a time, so use one
 * guard per page.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useConfirm } from './confirm';

export function useLeaveGuard(dirty: boolean): () => void {
  const { t } = useI18n();
  const confirm = useConfirm();
  const released = useRef(false);

  // new unsaved changes after an earlier save: guard again
  useEffect(() => {
    if (dirty) released.current = false;
  }, [dirty]);

  // read at navigation time, so release() just before navigate() lets that navigation through
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !released.current && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    let active = true;
    void confirm({ title: t('leaveTitle'), description: t('unsavedChanges'), confirmLabel: t('discardChanges'), destructive: true }).then((ok) => {
      if (!active) return;
      if (ok) {
        released.current = true;
        blocker.proceed();
      } else blocker.reset();
    });
    return () => {
      active = false;
    };
  }, [blocker, confirm, t]);

  // tab close / reload / another address: only the browser may ask
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (released.current) return;
      e.preventDefault();
      e.returnValue = ''; // older browsers need this to show the prompt
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return useCallback(() => {
    released.current = true;
  }, []);
}

/**
 * For a form that opens filled in (the "New …" pages): unsaved means "differs from what the page
 * opened with". Pass everything the person can change, e.g. `useChangedGuard([form, supplierId])`.
 * Returns release(), to call just before navigating away after a successful save.
 */
export function useChangedGuard(value: unknown): () => void {
  const json = JSON.stringify(value);
  const [opened] = useState(json);
  return useLeaveGuard(json !== opened);
}

/**
 * For an inline edit form that is `null` while closed (the record detail pages): unsaved means
 * "differs from what it held when Edit was pressed". Saving or cancelling closes the form
 * (back to null), which lifts the guard, so no release() is needed.
 */
export function useEditGuard(form: unknown) {
  const json = form == null ? null : JSON.stringify(form);
  const [opened, setOpened] = useState<string | null>(null);
  // remember the values the form opened with; forget them when it closes (derived state, set during render)
  if (json === null && opened !== null) setOpened(null);
  if (json !== null && opened === null) setOpened(json);
  useLeaveGuard(json !== null && opened !== null && json !== opened);
}
