import { AlertTriangleIcon, CheckIcon, InfoIcon, XIcon } from 'lucide-react';
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
const ICON = { ok: CheckIcon, info: InfoIcon, warn: AlertTriangleIcon, error: XIcon } as const;
/** The tone shows only in the small round chip (same look as the phone app); the card stays plain. */
const ICON_TONE: Record<ToastTone, string> = {
  ok: 'bg-success-soft text-success',
  info: 'bg-info-soft text-info',
  warn: 'bg-warning-soft text-warning',
  error: 'bg-destructive-soft text-destructive',
};

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
        className="pointer-events-none fixed inset-x-4 bottom-8 z-[90] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-10 sm:items-end print:hidden"
      >
        {items.map((i) => {
          const Icon = ICON[i.tone];
          return (
            <div
              key={i.id}
              role={i.tone === 'error' ? 'alert' : 'status'}
              className="group pointer-events-auto flex w-fit max-w-sm animate-in items-center gap-2.5 rounded-2xl border border-border/70 bg-card py-1.5 pr-1.5 pl-1.5 text-[0.8125rem] text-card-foreground shadow-float duration-300 ease-smooth fade-in-0 zoom-in-95 slide-in-from-bottom-2"
            >
              <span className={cn('grid size-7 shrink-0 place-items-center rounded-full', ICON_TONE[i.tone])} aria-hidden>
                <Icon className="size-3.5" strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1 py-1 font-medium break-words">{i.text}</div>
              {/* close: quiet until the toast is hovered or focused */}
              <button
                type="button"
                onClick={() => dismiss(i.id)}
                aria-label={t('close')}
                className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground opacity-60 transition outline-none group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <XIcon className="size-3.5" />
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
