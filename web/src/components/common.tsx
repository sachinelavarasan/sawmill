/**
 * Data loading (TanStack Query) and number/date formatting shared by all pages.
 * UI components live in components/ui (shadcn), components/page.tsx and components/data-table.tsx.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useId } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { API_KEY } from '../lib/query';

interface Loaded<T> {
  data: T | null;
  error: string | null;
  /** a request is in flight (first load or refresh) */
  loading: boolean;
  reload: () => void;
}

/**
 * Loads with any async function; re-runs when `deps` change. While the next result is
 * on its way the previous one stays on screen (no flash of skeletons when filtering or paging),
 * and only the newest request may update the screen. Private to the calling component.
 */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []): Loaded<T> {
  const id = useId();
  const q = useQuery({ queryKey: ['load', id, ...deps], queryFn: fn, placeholderData: keepPreviousData, gcTime: 0, staleTime: 0 });
  const { refetch } = q;
  const reload = useCallback(() => void refetch(), [refetch]);
  return { data: q.data ?? null, error: q.error ? q.error.message : null, loading: q.isFetching, reload };
}

/**
 * GET an API path, cached by that path and shared between pages: a list opened before
 * shows instantly and is refreshed every time it is opened. Pass `null` to load nothing yet.
 */
export function useApi<T>(path: string | null): Loaded<T> {
  // keyed by who is signed in: one person's cached lists are never shown to the next
  const userId = useAuth().user?.id ?? null;
  const q = useQuery({ queryKey: [API_KEY, userId, path], queryFn: () => api<T>(path!), enabled: path !== null, placeholderData: keepPreviousData });
  const { refetch } = q;
  const reload = useCallback(() => void refetch(), [refetch]);
  return { data: q.data ?? null, error: q.error ? q.error.message : null, loading: q.isFetching, reload };
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
