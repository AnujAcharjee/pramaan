import { Redis } from 'ioredis';
import { ENV } from './env.js';
import { logger } from './logger.js';

const redis = new Redis(ENV.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  enableAutoPipelining: true,
  connectTimeout: 10000,
  keepAlive: 10000,
  family: 4, // Force IPv4 to avoid IPv6 fallback round-trips
});

redis.on('connect', () => {
  logger.info('Redis socket connected');
});

redis.on('error', (error) => {
  logger.error('Redis error', { error });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

let isShuttingDown = false;
const handleShutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('Shutting down Redis connection');
  await redis.quit();
};

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

export default redis;
