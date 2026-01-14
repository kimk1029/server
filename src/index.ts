import dotenv from 'dotenv';
import { startServer } from './server';
import { logger } from './utils/logger';

dotenv.config();

logger.info('Starting Police vs Thieves server...');

try {
  startServer();
} catch (error) {
  logger.error('Failed to start server', { error });
  process.exit(1);
}

process.on('SIGINT', () => {
  logger.info('Server shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Server shutting down...');
  process.exit(0);
});
