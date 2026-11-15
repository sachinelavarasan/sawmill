import { QueryClient } from '@tanstack/react-query';

/**
 * One TanStack Query client for the app. Lists read through `useApi` share a cache
 * keyed by API path: going back to a list shows what was there at once, and it is
 * always re-fetched on opening (staleTime 0), so nothing saved meanwhile is missed.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      // a wrong request (4xx) will be wrong again; only network and server faults are retried
      retry: (failures, error) => !(((error as { status?: number }).status ?? 500) < 500) && failures < 2,
      // forms on detail pages are filled from loaded data: don't refetch under someone typing
      refetchOnWindowFocus: false,
    },
  },
});

/** Key prefix of every query read through `useApi`. */
export const API_KEY = 'api';
