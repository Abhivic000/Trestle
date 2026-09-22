import { drizzleConfigFor } from './drizzle.config.shared';

// Test database (apps/api/.env.test), used by `pnpm db:migrate:test`.
export default drizzleConfigFor('.env.test');
