/**
 * Data loading and number/date formatting shared by all pages.
 * UI components live in components/ui (shadcn) and components/page.tsx.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Tiny data loader with loading / error / retry states. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  // Only the newest request may update the screen: while someone types in a search box,
  // an older, slower response must not replace the results of a newer one.
  const latest = useRef(0);
  const reload = useCallback(() => {
    const id = ++latest.current;
    setLoading(true);
    setError(null);
    run()
      .then((d) => id === latest.current && setData(d))
      .catch((e: Error) => id === latest.current && setError(e.message))
      .finally(() => id === latest.current && setLoading(false));
  }, [run]);

  useEffect(reload, [reload]);
  return { data, error, loading, reload };
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const money = (n: number) => inr.format(n);
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Rupees with paise, for statements and reports. */
export const money2 = (n: number) => inr2.format(n);
export const num3 = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const cft = (n: number) => `${n.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} CFT`;
export const dateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
