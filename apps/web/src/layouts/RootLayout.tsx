import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Outlet, ScrollRestoration } from 'react-router';
import { AuthProvider } from '@/auth/AuthProvider';
import { createQueryClient } from '@/lib/query-client';

/**
 * Wraps every page: server-data cache, auth state, scroll restoration on
 * back/forward, and starting new pages at the top.
 */
export function RootLayout() {
  // useState so the client is created once, not on every render.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <ScrollRestoration />
      </AuthProvider>
    </QueryClientProvider>
  );
}
