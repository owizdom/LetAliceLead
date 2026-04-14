import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

/**
 * Attaches a short request ID to every incoming request and surfaces it in
 * the X-Request-Id response header. Used by the error handler and structured
 * logger so each request is traceable end-to-end.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id = incoming && /^[a-zA-Z0-9_-]{4,64}$/.test(incoming)
    ? incoming
    : crypto.randomBytes(8).toString('hex');
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}
