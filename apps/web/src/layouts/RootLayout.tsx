import { useEffect, useRef, useState } from 'react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Outlet, ScrollRestoration } from 'react-router';
import { AuthProvider } from '@/auth/AuthProvider';
import { useAuth } from '@/auth/useAuth';
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
        <ClearCacheOnUserChange />
        <Outlet />
        <ScrollRestoration />
      </AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * Throws away cached server data whenever the signed-in user changes, so one
 * account never sees another's designs after a sign-out/sign-in on the same device.
 */
function ClearCacheOnUserChange() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;
    const userId = user?.id ?? null;
    if (previousUserId.current !== null && previousUserId.current !== userId) {
      queryClient.clear();
    }
    previousUserId.current = userId;
  }, [user, loading, queryClient]);

  return null;
}
