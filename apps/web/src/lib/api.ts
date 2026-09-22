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
}

/**
 * GET a Trestle API endpoint as the signed-in user and validate the response
 * against a shared schema, so a contract mismatch fails loudly here.
 */
export async function apiGet<T>(
  path: string,
  schema: z.ZodType<T>,
  { signal }: RequestOptions = {},
): Promise<T> {
  // Returns the current session, refreshing the access token first if it's about to expire.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const response = await fetch(`${env.VITE_API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw parsed.success
      ? new ApiError(response.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiError(response.status, 'http_error', `Request failed (${response.status})`);
  }
  return schema.parse(body);
}
