import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon, XCircleIcon, XIcon } from 'lucide-react';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '../i18n';

export type ToastTone = 'ok' | 'info' | 'warn' | 'error';
interface ToastItem {
  id: number;
  tone: ToastTone;
  text: ReactNode;
}
type Toast = (text: ReactNode, tone?: ToastTone) => void;

const ToastContext = createContext<Toast | null>(null);

/** How long a toast stays; errors stay longer. Hovering or focusing the stack holds them all. */
const LIFE_MS: Record<ToastTone, number> = { ok: 4000, info: 5000, warn: 6000, error: 8000 };
const ICON = { ok: CheckCircle2Icon, info: InfoIcon, warn: AlertTriangleIcon, error: XCircleIcon } as const;
const ICON_TONE: Record<ToastTone, string> = { ok: 'text-success', info: 'text-info', warn: 'text-warning', error: 'text-destructive' };

/**
 * Short confirmations that something was done ("Saved"), shown in the corner and
 * gone by themselves:
 *   const toast = useToast();
 *   toast(t('saved'));
 * A failure the person must act on belongs next to the form, in a Notice — not here.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [items, setItems] = useState<ToastItem[]>([]);
  const [held, setHeld] = useState(false);
  const nextId = useRef(0);

  const toast = useCallback<Toast>((text, tone = 'ok') => {
    // at most three at once: the oldest makes room
    setItems((list) => [...list.slice(-2), { id: ++nextId.current, tone, text }]);
  }, []);
  const dismiss = useCallback((id: number) => setItems((list) => list.filter((i) => i.id !== id)), []);

  // the oldest toast runs its clock; the next starts when it leaves
  const first = items[0];
  useEffect(() => {
    if (!first || held) return;
    const timer = setTimeout(() => dismiss(first.id), LIFE_MS[first.tone]);
    return () => clearTimeout(timer);
  }, [first, held, dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        role="region"
        aria-live="polite"
        aria-label={t('notifications')}
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={() => setHeld(false)}
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end print:hidden"
      >
        {items.map((i) => {
          const Icon = ICON[i.tone];
          return (
            <div
              key={i.id}
              role={i.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm animate-in items-start gap-3 rounded-lg bg-card py-3 pr-2 pl-3.5 text-sm text-card-foreground shadow-float duration-200 fade-in-0 slide-in-from-bottom-2"
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', ICON_TONE[i.tone])} aria-hidden />
              <div className="min-w-0 flex-1 font-medium break-words">{i.text}</div>
              <button
                type="button"
                onClick={() => dismiss(i.id)}
                aria-label={t('close')}
                className="-my-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast outside ToastProvider');
  return ctx;
}
