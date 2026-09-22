import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Helpers for integration tests. They create REAL users in the trestle-test
// Supabase project and delete them afterwards.

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, clientOptions);

export interface TestUser {
  id: string;
  email: string;
  accessToken: string;
}

const created: string[] = [];

/** Creates a confirmed user and signs them in. Emails start with `it-` for easy spotting. */
export async function createTestUser(): Promise<TestUser> {
  const email = `it-${randomUUID()}@example.com`;
  const password = `pw-${randomUUID()}`;

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;
  created.push(createdUser.user.id);

  // A fresh client per user so sessions never mix.
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, clientOptions);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;

  return { id: createdUser.user.id, email, accessToken: data.session.access_token };
}

/** Deletes every user created by this test file (their projects cascade-delete). */
export async function deleteTestUsers(): Promise<void> {
  await Promise.all(created.splice(0).map((id) => admin.auth.admin.deleteUser(id)));
}
