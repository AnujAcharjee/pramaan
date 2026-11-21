import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { ENV } from './env.js';
import { logger } from './logger.js';

// Dedicated connection pool to eliminate repeated TLS/SASL handshake latency (~700ms -> ~40ms)
const pool = new pg.Pool({
  connectionString: ENV.NEON_PG_DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const adapter = new PrismaPg(pool as any);

const prisma = new PrismaClient({
  adapter,
  log: ENV.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : [],
});

// Periodic lightweight keepalive query every 4 minutes to prevent serverless Neon from sleeping
if (ENV.NODE_ENV === 'production') {
  setInterval(async () => {
    try {
      await pool.query('SELECT 1');
    } catch {
      // Ignore background keepalive errors
    }
  }, 4 * 60 * 1000).unref();
}

let isShuttingDown = false;
const handleShutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('Shutting down database connection');
  await prisma.$disconnect();
  await pool.end();
};

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

export default prisma;
