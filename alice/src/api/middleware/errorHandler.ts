import { Request, Response, NextFunction } from 'express';
import { baseLog } from '../../utils/logger';

/**
 * Centralized Express error handler. Every route's thrown error funnels
 * through here so responses are consistently shaped and traceable via
 * the x-request-id header.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const id = req.id || 'unknown';
  const message = err instanceof Error ? err.message : 'Unknown error';
  const stack = err instanceof Error ? err.stack : undefined;
  baseLog.error(
    {
      requestId: id,
      method: req.method,
      path: req.path,
      err: message,
      stack,
    },
    'request.error'
  );
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error', requestId: id });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found', requestId: req.id, path: req.path });
}
