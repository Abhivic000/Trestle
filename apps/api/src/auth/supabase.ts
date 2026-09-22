import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

/**
 * Server-side Supabase client, used only to verify users' access tokens.
 * It keeps no session of its own: each request brings its own token.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
