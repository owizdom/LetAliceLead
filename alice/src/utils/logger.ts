import pino from 'pino';
import { auditLog } from '../locus/audit';

const isDev = process.env.NODE_ENV !== 'production';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  base: { service: 'alice', version: '1.0.0' },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname,service,version',
        },
      }
    : undefined,
});

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

async function emit(level: LogLevel, action: string, data?: unknown): Promise<void> {
  const payload = data && typeof data === 'object' ? { action, ...(data as Record<string, unknown>) } : { action, data };
  switch (level) {
    case LogLevel.DEBUG:
      baseLogger.debug(payload, action);
      break;
    case LogLevel.INFO:
      baseLogger.info(payload, action);
      break;
    case LogLevel.WARN:
      baseLogger.warn(payload, action);
      break;
    case LogLevel.ERROR:
      baseLogger.error(payload, action);
      break;
  }
  if (level !== LogLevel.DEBUG) {
    await auditLog(action, { level, data, timestamp: new Date().toISOString() }).catch(() => {});
  }
}

export const logger = {
  debug: (action: string, data?: unknown) => emit(LogLevel.DEBUG, action, data),
  info: (action: string, data?: unknown) => emit(LogLevel.INFO, action, data),
  warn: (action: string, data?: unknown) => emit(LogLevel.WARN, action, data),
  error: (action: string, data?: unknown) => emit(LogLevel.ERROR, action, data),
};

export const baseLog = baseLogger;
