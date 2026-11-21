import winston from 'winston';
import { ENV } from './env.js';

const logLevel = ENV.NODE_ENV === 'production' ? 'info' : 'debug';

const formatConfig = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: logLevel,
  format: formatConfig,
  transports: [
    new winston.transports.Console({
      format:
        ENV.NODE_ENV === 'development' && process.stdout.isTTY
          ? winston.format.combine(winston.format.colorize(), winston.format.simple())
          : formatConfig,
    }),
  ],
});
