import { z } from 'zod';

// Vite injects VITE_* variables from apps/web/.env at build time.
// Validate them once here so a missing value fails immediately and clearly.
const envSchema = z.object({
  VITE_API_URL: z.url(),
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .startsWith('sb_publishable_', 'must be a Supabase publishable key'),
});

const result = envSchema.safeParse(import.meta.env);
if (!result.success) {
  const problems = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment configuration (check apps/web/.env): ${problems}`);
}

export const env = result.data;
