import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for a minute: no refetch on every remount.
        staleTime: 60_000,
        // Retrying a 4xx (bad request, not signed in, not found) never helps.
        retry: (failureCount, error) =>
          error instanceof ApiError && error.status < 500 ? false : failureCount < 2,
      },
    },
  });
}
