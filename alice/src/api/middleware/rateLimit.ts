import { Request, Response, NextFunction } from 'express';

const requestCounts = new Map<string, { count: number; resetAt: number }>();
let requestsSinceCleanup = 0;

const WINDOW_MS = 60_000;   // 1 minute
const MAX_REQUESTS = 600;   // 10 req/sec per IP — dashboard polls multiple endpoints at 2s cadence
const CLEANUP_INTERVAL = 100; // prune stale entries every 100 requests

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || 'unknown';
  const now = Date.now();

  let entry = requestCounts.get(key);
  if (!entry || now > entry.resetAt) {
    if (entry) requestCounts.delete(key);
    entry = { count: 0, resetAt: now + WINDOW_MS };
    requestCounts.set(key, entry);
  }

  entry.count++;

  // Periodic cleanup of stale entries
  requestsSinceCleanup++;
  if (requestsSinceCleanup >= CLEANUP_INTERVAL) {
    requestsSinceCleanup = 0;
    for (const [k, v] of requestCounts) {
      if (now > v.resetAt) requestCounts.delete(k);
    }
  }

  if (entry.count > MAX_REQUESTS) {
    res.status(429).json({ error: 'Rate limit exceeded. Try again in 1 minute.' });
    return;
  }

  next();
}
