import { pino } from 'pino';
import { env } from './config/env';

/**
 * App-wide structured logger. In development it prints readable coloured lines;
 * in production it prints one JSON object per line, which log tools can search.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  // Never write credentials to logs.
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  ...(env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,req,res,responseTime' },
    },
  }),
});
