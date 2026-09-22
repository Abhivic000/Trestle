import type { Request, RequestHandler } from 'express';
import { HttpError } from '../errors';
import { supabase } from './supabase';

export interface AuthUser {
  id: string;
  email: string | null;
}

// Adds `req.user` to Express's Request type (set by requireAuth below).
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

const BEARER_PREFIX = 'Bearer ';

/**
 * Middleware: rejects the request with 401 unless it carries a valid Supabase
 * access token (`Authorization: Bearer <token>`), then sets `req.user`.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith(BEARER_PREFIX)) {
    next(new HttpError(401, 'unauthorized', 'Sign in to continue.'));
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  // Checks the signature against Supabase's public keys and that it hasn't expired.
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data) {
    next(new HttpError(401, 'unauthorized', 'Your session is invalid or has expired.'));
    return;
  }

  const { sub, email } = data.claims;
  req.user = { id: sub, email: typeof email === 'string' ? email : null };
  next();
};

/** The signed-in user. Only call in handlers mounted behind `requireAuth`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) {
    throw new HttpError(401, 'unauthorized', 'Sign in to continue.');
  }
  return req.user;
}
