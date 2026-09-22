import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { healthRouter } from './routes/health';

/**
 * Builds the Express app without starting it, so tests can exercise it directly.
 * Middleware runs top to bottom for every request; order matters.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet()); // standard security-related HTTP headers
  app.use(cors({ origin: env.WEB_ORIGIN })); // only our web app may call us from a browser
  app.use(express.json({ limit: '1mb' })); // parse JSON request bodies

  app.use('/health', healthRouter);

  app.use(notFoundHandler); // no route matched
  app.use(errorHandler); // must be last

  return app;
}
