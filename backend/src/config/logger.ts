/**
 * logger.ts — Structured Application Logger
 *
 * Provides a lightweight structured logger that replaces raw console.log calls.
 * Outputs JSON in production for log aggregators; pretty-printed in development.
 *
 * Levels: error | warn | info | debug
 *
 * Usage:
 *   import { logger } from '../config/logger';
 *   logger.info('Server started', { port: 5000 });
 *   logger.error('DB connection failed', { error: err.message });
 */

import { getRequestId } from './context';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Respect LOG_LEVEL env var; default to 'info' in prod, 'debug' in dev
const configuredLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const isProduction = process.env.NODE_ENV === 'production';

// ANSI colour codes for pretty dev output
const COLOURS: Record<LogLevel, string> = {
  error: '\x1b[31m', // red
  warn: '\x1b[33m',  // yellow
  info: '\x1b[36m',  // cyan
  debug: '\x1b[90m', // grey
};
const RESET = '\x1b[0m';

function formatTimestamp(): string {
  return new Date().toISOString();
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] <= LEVELS[configuredLevel];
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const requestId = getRequestId();
  const mergedMeta = { requestId, ...(meta || {}) };

  if (isProduction) {
    // Structured JSON output for log ingestion (CloudWatch, Datadog, etc.)
    const entry = {
      timestamp: formatTimestamp(),
      level,
      message,
      meta: mergedMeta,
    };
    // Use the native console methods so log levels route correctly
    if (level === 'error') console.error(JSON.stringify(entry));
    else if (level === 'warn') console.warn(JSON.stringify(entry));
    else console.log(JSON.stringify(entry));
  } else {
    // Human-readable pretty output for development
    const colour = COLOURS[level];
    const label = `${colour}[${level.toUpperCase().padEnd(5)}]${RESET}`;
    const ts = `\x1b[90m${formatTimestamp()}${RESET}`;
    const metaStr = Object.keys(mergedMeta).length > 0 ? ` ${JSON.stringify(mergedMeta)}` : '';
    const line = `${ts} ${label} ${message}${metaStr}`;

    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}

export const logger = {
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),

  /**
   * Logs an incoming HTTP request — call from a middleware.
   */
  request: (method: string, path: string, statusCode: number, durationMs: number, requestId: string) => {
    log('info', `${method} ${path} → ${statusCode} (${durationMs}ms)`, { requestId });
  },
};
