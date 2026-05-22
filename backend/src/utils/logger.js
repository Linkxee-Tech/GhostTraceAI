'use strict';

const pino = require('pino');
const config = require('../config');

// Sanitize sensitive fields from logs
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  'body.password',
  'body.cardNumber',
  'body.cvv',
  'transaction.cardNumber',
  'transaction.accountNumber',
  '*.apiKey',
  '*.secret',
  '*.token',
];

const logger = pino({
  level: config.app.logLevel,
  redact: {
    paths: REDACTED_PATHS,
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label.toUpperCase() };
    },
    bindings(bindings) {
      return {
        pid: bindings.pid,
        service: 'ghosttrace-backend',
        env: config.app.env,
      };
    },
  },
  transport:
    config.app.isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

// Child loggers per module
logger.forModule = (module) => logger.child({ module });

module.exports = logger;
