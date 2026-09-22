import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env';
import * as schema from './schema';

// One shared connection pool for the whole process. Connects through Supabase's
// session pooler (IPv4-friendly); see DATABASE_URL in .env.example.
export const sql = postgres(env.DATABASE_URL, { max: 10 });

export const db = drizzle(sql, { schema });
