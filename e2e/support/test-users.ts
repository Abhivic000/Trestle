import { randomUUID } from 'node:crypto';
import { loadTestEnv } from '../../test-support/test-env.ts';

// Talks to the trestle-test project's Auth admin API with its secret key.
// Every e2e user's email starts with this prefix so leftovers can be swept.
export const E2E_EMAIL_PREFIX = 'e2e-';

const env = loadTestEnv('apps/api');
const SUPABASE_URL = env.SUPABASE_URL ?? '';
const SECRET_KEY = env.SUPABASE_SECRET_KEY ?? '';
const adminHeaders = {
  apikey: SECRET_KEY,
  Authorization: `Bearer ${SECRET_KEY}`,
  'Content-Type': 'application/json',
};

export function uniqueEmail(): string {
  return `${E2E_EMAIL_PREFIX}${randomUUID()}@example.com`;
}

export interface Credentials {
  email: string;
  password: string;
}

/** Creates an already-confirmed user directly, for tests that start signed out with an account. */
export async function createUser(): Promise<Credentials> {
  const credentials = { email: uniqueEmail(), password: `pw-${randomUUID()}` };
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ ...credentials, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`Creating test user failed: ${res.status} ${await res.text()}`);
  return credentials;
}

/** Deletes every user whose email starts with the e2e prefix (only ever in trestle-test). */
export async function deleteE2eUsers(): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
    headers: adminHeaders,
  });
  if (!res.ok) throw new Error(`Listing test users failed: ${res.status}`);
  const { users } = (await res.json()) as { users: { id: string; email?: string }[] };

  await Promise.all(
    users
      .filter((user) => user.email?.startsWith(E2E_EMAIL_PREFIX))
      .map((user) =>
        fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
          method: 'DELETE',
          headers: adminHeaders,
        }),
      ),
  );
}
