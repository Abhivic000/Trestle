import type { ApiErrorBody } from '@trestle/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../errors';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, 'not_found', `No route for ${req.method} ${req.path}`));
};

// Express recognises error handlers by their four parameters, so `_next` must stay.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    const body: ApiErrorBody = { error: { code: err.code, message: err.message } };
    res.status(err.status).json(body);
    return;
  }

  // Unexpected: log everything (with the request id), reveal nothing to the client.
  req.log.error({ err }, 'Unhandled error');
  const body: ApiErrorBody = {
    error: { code: 'internal_error', message: 'Something went wrong on our side.' },
  };
  res.status(500).json(body);
};
