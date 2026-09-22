import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { requireAuth } from './auth/require-auth';
import { env } from './config/env';
import { logger } from './logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { healthRouter } from './routes/health';
import { meRouter } from './routes/me';
import { projectsRouter } from './routes/projects';

// Routers see a URL with their mount path removed; Express keeps the original.
function fullUrl(req: { url?: string; originalUrl?: string }) {
  return req.originalUrl ?? req.url;
}

/**
 * Builds the Express app without starting it, so tests can exercise it directly.
 * Middleware runs top to bottom for every request; order matters.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet()); // standard security-related HTTP headers
  app.use(cors({ origin: env.WEB_ORIGIN })); // only our web app may call us from a browser
  app.use(
    // One log line per request, tagged with an id that is also sent back as X-Request-Id.
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = req.headers['x-request-id'] ?? randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      // Client mistakes (4xx) are warnings, our bugs (5xx) are errors.
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customSuccessMessage: (req, res, responseTime) =>
        `${req.method} ${fullUrl(req)} ${res.statusCode} ${Math.round(responseTime)}ms`,
      customErrorMessage: (req, res) => `${req.method} ${fullUrl(req)} ${res.statusCode}`,
      // Keep log lines short: no headers (they can also hold credentials).
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: fullUrl(req),
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(express.json({ limit: '1mb' })); // parse JSON request bodies

  // Public
  app.use('/health', healthRouter);

  // Everything below requires a signed-in user.
  app.use('/me', requireAuth, meRouter);
  app.use('/projects', requireAuth, projectsRouter);

  app.use(notFoundHandler); // no route matched
  app.use(errorHandler); // must be last

  return app;
}
