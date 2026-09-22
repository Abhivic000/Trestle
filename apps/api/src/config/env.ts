import { existsSync } from 'node:fs';
import { z } from 'zod';

// Load apps/api/.env into process.env using Node's built-in loader (no extra
// dependency). In production, variables come from the host instead of a file.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_', 'must be a Supabase secret key'),
  GEMINI_API_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Fail fast with a readable list instead of crashing later on first use.
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`Invalid environment configuration (check apps/api/.env):\n${problems}`);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
