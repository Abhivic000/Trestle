import { createApp } from './app';
import { env } from './config/env';
import { sql } from './db/client';
import { logger } from './logger';

const server = createApp().listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Graceful shutdown: stop accepting new requests, let in-flight ones finish,
// close database connections, then exit.
function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    sql
      .end({ timeout: 5 })
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        logger.error({ err }, 'Error closing database connections');
        process.exit(1);
      });
  });
  setTimeout(() => process.exit(1), 10_000).unref(); // force-exit if something hangs
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
