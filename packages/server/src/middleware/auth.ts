import type { Request, Response, NextFunction } from 'express';
import { validateSession, type SessionData } from '../services/session.js';
import { UnauthorizedError } from '../errors/index.js';

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      session?: SessionData;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

/**
 * Express middleware that extracts a Bearer token from the Authorization header,
 * validates it against Redis, and attaches the session data to req.session.
 * Throws UnauthorizedError if token is missing or invalid.
 */
export async function authenticateSession(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or invalid Authorization header'));
    return;
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  if (!token) {
    next(new UnauthorizedError('Missing session token'));
    return;
  }

  const session = await validateSession(token);

  if (!session) {
    next(new UnauthorizedError('Invalid or expired session token'));
    return;
  }

  req.session = session;
  next();
}
