import { createClient } from '@supabase/supabase-js';
import { env } from '@/env';

/**
 * Browser Supabase client. Uses the public publishable key; it can only sign
 * users in and out. All data goes through our API, never directly to tables.
 * The session is kept in localStorage and refreshed automatically.
 */
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
