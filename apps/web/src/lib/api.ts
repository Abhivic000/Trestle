import { apiErrorSchema } from '@trestle/shared';
import type { z } from 'zod';
import { env } from '@/env';
import { supabase } from './supabase';

/** A failed API call, carrying the API's error code and user-facing message. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  signal?: AbortSignal;
  method?: 'GET' | 'POST';
  body?: unknown;
}

/**
 * Calls a Trestle API endpoint as the signed-in user and validates the response
 * against a shared schema, so a contract mismatch fails loudly here.
 */
async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  { signal, method = 'GET', body }: RequestOptions = {},
): Promise<T> {
  // Returns the current session, refreshing the access token first if it's about to expire.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const response = await fetch(`${env.VITE_API_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const responseBody: unknown = await response.json().catch(() => null);

  // NOTE: do not call supabase.auth.signOut() on a 401 here. supabase-js
  // serialises auth calls with a lock, so signing out while a sign-in is in
  // flight hangs that sign-in and then drops the fresh session. The client
  // refreshes tokens by itself, and RequireAuth redirects once there is no
  // session; pages show the 401 message meanwhile.
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(responseBody);
    throw parsed.success
      ? new ApiError(response.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiError(response.status, 'http_error', `Request failed (${response.status})`);
  }
  return schema.parse(responseBody);
}

export function apiGet<T>(
  path: string,
  schema: z.ZodType<T>,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  return apiRequest(path, schema, options);
}

export function apiPost<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  return apiRequest(path, schema, { ...options, method: 'POST', body });
}
