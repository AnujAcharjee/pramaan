import { ENV } from './env.js';
import { logger } from './logger.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: ENV.NEON_PG_DATABASE_URL });

const prisma = new PrismaClient({
  adapter,
  log: ENV.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : [],
});

let isShuttingDown = false;
const handleShutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('Shutting down database connection');
  await prisma.$disconnect();
};

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

export default prisma;
