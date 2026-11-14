import { AlertTriangleIcon, CircleCheckIcon } from 'lucide-react';
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useI18n } from '../i18n';

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  /** Label of the confirming button (defaults to "OK"-style save text). */
  confirmLabel?: string;
  /** Red confirm button, for deletions. */
  destructive?: boolean;
}

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<Confirm | null>(null);

/**
 * One app-wide confirmation dialog, replacing window.confirm:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: t('delete'), description: t('confirmDelete'), destructive: true })) …
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(ok: boolean) => void>(undefined);

  const confirm = useCallback<Confirm>(
    (o) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false); // a dialog already open counts as cancelled
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = undefined;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!opts} onOpenChange={(open) => !open && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className={opts?.destructive ? 'bg-destructive-soft text-destructive' : 'bg-primary-soft text-primary'}>
              {opts?.destructive ? <AlertTriangleIcon aria-hidden /> : <CircleCheckIcon aria-hidden />}
            </AlertDialogMedia>
            <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
            {opts?.description && <AlertDialogDescription>{opts.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction variant={opts?.destructive ? 'destructive' : 'default'} onClick={() => close(true)}>
              {opts?.confirmLabel ?? t('save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm outside ConfirmProvider');
  return ctx;
}

/** The common case: "Delete this entry? This cannot be undone." */
export function useConfirmDelete() {
  const confirm = useConfirm();
  const { t } = useI18n();
  return useCallback(() => confirm({ title: t('delete'), description: t('confirmDelete'), confirmLabel: t('delete'), destructive: true }), [confirm, t]);
}
