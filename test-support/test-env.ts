import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const repoRoot = resolve(import.meta.dirname, '..');

function readEnvFile(relativePath: string): Record<string, string> | null {
  const path = resolve(repoRoot, relativePath);
  if (!existsSync(path)) return null;
  const parsed = parseEnv(readFileSync(path, 'utf8'));
  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

/**
 * Loads a `.env.test` file for the test runners. Refuses to continue if it is
 * missing, or if it points at the same Supabase project as the dev `.env`
 * next to it, because tests create and delete users and data freely.
 */
export function loadTestEnv(appDir: 'apps/api' | 'apps/web'): Record<string, string> {
  const testEnv = readEnvFile(`${appDir}/.env.test`);
  if (!testEnv) {
    throw new Error(
      `${appDir}/.env.test is missing. Copy ${appDir}/.env.test.example and fill in the ` +
        'values of the separate "trestle-test" Supabase project.',
    );
  }

  const devEnv = readEnvFile(`${appDir}/.env`) ?? {};
  const testRefs = projectRefs(testEnv);
  const devRefs = projectRefs(devEnv);

  if (testRefs.some((ref) => devRefs.includes(ref))) {
    throw new Error(
      `${appDir}/.env.test points at the same Supabase project as ${appDir}/.env. ` +
        'Tests must use the separate "trestle-test" project, never your real one.',
    );
  }
  if (new Set(testRefs).size > 1) {
    throw new Error(
      `${appDir}/.env.test mixes settings from different Supabase projects ` +
        '(DATABASE_URL and SUPABASE_URL must both belong to trestle-test).',
    );
  }
  return testEnv;
}

/**
 * Supabase project ids ("refs") referenced by an env file. Comparing ids, not
 * whole strings, catches two different-looking URLs for the same project
 * (e.g. the pooler vs. the direct database address).
 */
function projectRefs(env: Record<string, string>): string[] {
  const refs: string[] = [];
  for (const key of ['SUPABASE_URL', 'VITE_SUPABASE_URL']) {
    const value = env[key];
    if (value) refs.push(new URL(value).hostname.split('.')[0] ?? value);
  }
  const databaseUrl = env.DATABASE_URL;
  if (databaseUrl) {
    const url = new URL(databaseUrl);
    // Pooler: user is "postgres.<ref>". Direct: host is "db.<ref>.supabase.co".
    const user = decodeURIComponent(url.username);
    refs.push(
      user.includes('.')
        ? (user.split('.')[1] ?? user)
        : (url.hostname.split('.')[1] ?? url.hostname),
    );
  }
  return refs;
}
