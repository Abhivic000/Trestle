import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../errors';

/** Every error response has this one shape, so the web app handles errors uniformly. */
interface ErrorBody {
  error: { code: string; message: string };
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, 'not_found', `No route for ${req.method} ${req.path}`));
};

// Express recognises error handlers by their four parameters, so `_next` must stay.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message } };
    res.status(err.status).json(body);
    return;
  }

  console.error('Unhandled error:', err);
  const body: ErrorBody = {
    error: { code: 'internal_error', message: 'Something went wrong on our side.' },
  };
  res.status(500).json(body);
};
