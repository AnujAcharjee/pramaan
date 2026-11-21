import {
  Redis,
  //  type RedisOptions
} from 'ioredis';
import { ENV } from './env.js';
import { logger } from './logger.js';

// const options: RedisOptions = {
//   host: ENV.REDIS_HOST,
//   username: ENV.REDIS_USERNAME,
//   port: ENV.REDIS_PORT,
//   password: ENV.REDIS_PASSWORD,
//   db: 0,
//   ...(ENV.REDIS_TLS_ENABLED ?
//     {
//       tls: { rejectUnauthorized: false },
//     }
//   : {}),
//   maxRetriesPerRequest: 3,
//   enableReadyCheck: true,
//   enableOfflineQueue: true,
//   connectTimeout: 10_000,

//   retryStrategy: (times) => Math.min(times * 100, 3000),
// };

const redis = new Redis(ENV.REDIS_URL!);

redis.on('connect', () => {
  logger.info('Redis socket connected');
});

// redis.on('ready', () => {
//   logger.info('Redis ready');
// });

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
