import { auditLog } from '../locus/audit';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export async function log(level: LogLevel, action: string, data?: unknown): Promise<void> {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}] [${action}]`;

  switch (level) {
    case LogLevel.ERROR:
      console.error(prefix, data ?? '');
      break;
    case LogLevel.WARN:
      console.warn(prefix, data ?? '');
      break;
    case LogLevel.DEBUG:
      console.debug(prefix, data ?? '');
      break;
    default:
      console.log(prefix, data ?? '');
  }

  if (level !== LogLevel.DEBUG) {
    await auditLog(action, { level, data, timestamp }).catch(() => {});
  }
}

export const logger = {
  debug: (action: string, data?: unknown) => log(LogLevel.DEBUG, action, data),
  info: (action: string, data?: unknown) => log(LogLevel.INFO, action, data),
  warn: (action: string, data?: unknown) => log(LogLevel.WARN, action, data),
  error: (action: string, data?: unknown) => log(LogLevel.ERROR, action, data),
};
