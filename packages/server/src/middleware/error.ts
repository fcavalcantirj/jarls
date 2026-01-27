import type { Request, Response, NextFunction } from 'express';
import { GameError } from '../errors/index.js';

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  if (err instanceof GameError) {
    console.error(
      `${new Date().toISOString()} ERROR ${req.method} ${req.url} [${err.code}]: ${err.message}`
    );
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
    return;
  }

  console.error(
    `${new Date().toISOString()} ERROR ${req.method} ${req.url}: ${err.message}`,
    isProduction ? '' : err.stack
  );

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: isProduction ? 'Internal server error' : err.message,
    ...(isProduction ? {} : { details: err.stack }),
  });
}
