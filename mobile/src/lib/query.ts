/**
 * Server data through TanStack Query (as on the web): lists and records are cached in
 * memory by API path, so going back shows what was there at once while a fresh copy
 * loads. Nothing is written to the phone's storage — financial figures never leave memory.
 */
import { focusManager, QueryClient, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { api, ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // a wrong request (4xx) will be wrong again; only network and server faults are retried
      retry: (failures, error) => !((error as ApiError).status >= 400 && (error as ApiError).status < 500) && failures < 2,
    },
  },
});

// refetch stale data when the app comes back to the foreground
AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));

/** GET an API path (null = don't load yet). Refetches whenever the screen comes back into view. */
export function useApi<T>(path: string | null, options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>) {
  const q = useQuery<T>({
    queryKey: ['api', path],
    queryFn: () => api<T>(path!),
    enabled: path !== null && (options?.enabled ?? true),
    ...options,
  });
  useRefetchOnFocus(q.refetch, path !== null);
  return q;
}

/** Refetch when a screen regains focus (not on its first render — the query loads by itself then). */
export function useRefetchOnFocus(refetch: () => unknown, enabled = true) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      if (enabled) void refetch();
    }, [refetch, enabled]),
  );
}

/** Mark every cached path starting with one of these prefixes as stale (refetched where shown). */
export function invalidate(...prefixes: string[]) {
  return queryClient.invalidateQueries({
    predicate: (q) => q.queryKey[0] === 'api' && typeof q.queryKey[1] === 'string' && prefixes.some((p) => (q.queryKey[1] as string).startsWith(p)),
  });
}

/** After any change to operational records: lists, dashboards, stock and approvals all move together. */
export const invalidateOperations = () => invalidate('/imports', '/production', '/exports', '/stock', '/approvals', '/dashboard', '/accounts');
