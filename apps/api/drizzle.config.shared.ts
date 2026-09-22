import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'drizzle-kit';

function readEnvFile(file: string): Record<string, string | undefined> | null {
  return existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : null;
}

/** Supabase project id from a pooler ("postgres.<ref>") or direct ("db.<ref>...") URL. */
function projectRef(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const user = decodeURIComponent(url.username);
  return user.includes('.') ? (user.split('.')[1] ?? user) : (url.hostname.split('.')[1] ?? '');
}

/**
 * drizzle-kit config for the database named in `envFile` (.env or .env.test).
 *
 * The URL is read straight from that file on purpose: drizzle-kit auto-loads
 * `.env` into process.env on startup, so reading process.env here would
 * silently use the DEV database even for `db:migrate:test`.
 */
export function drizzleConfigFor(envFile: '.env' | '.env.test') {
  const vars = readEnvFile(envFile);
  if (!vars) {
    throw new Error(`${envFile} not found in apps/api (copy it from the matching .example file)`);
  }
  const databaseUrl = vars.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is not set in apps/api/${envFile}`);
  }

  if (envFile === '.env.test') {
    const devUrl = readEnvFile('.env')?.DATABASE_URL;
    if (devUrl && projectRef(devUrl) === projectRef(databaseUrl)) {
      throw new Error(
        'apps/api/.env.test DATABASE_URL points at the same Supabase project as .env. ' +
          'Use the separate "trestle-test" project.',
      );
    }
  }

  return defineConfig({
    dialect: 'postgresql',
    schema: './src/db/schema.ts',
    out: './drizzle',
    dbCredentials: { url: databaseUrl },
    // Only manage our own tables; Supabase owns auth, storage, etc.
    schemaFilter: ['public'],
    strict: true,
    verbose: true,
  });
}
