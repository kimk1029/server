import dotenv from 'dotenv';
import { startServer } from './server';
import { logger } from './utils/logger';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

// 서버 시작 배너 (버전 정보)
const printBanner = () => {
  let version = '1.0.0';
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
    version = pkg.version || '1.0.0';
  } catch (e) {
    // ignore
  }
  const nodeVersion = process.version;
  const env = process.env.NODE_ENV || 'development';
  const port = process.env.PORT || '9001';
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║     🚔  POLICE vs THIEVES - WebSocket Server  🏃          ║');
  console.log('║                                                           ║');
  console.log(`║     Version: ${version.padEnd(45)} ║`);
  console.log(`║     Node.js:  ${nodeVersion.padEnd(45)} ║`);
  console.log(`║     Env:     ${env.padEnd(45)} ║`);
  console.log(`║     Port:    ${port.padEnd(45)} ║`);
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
};

printBanner();
logger.info('🚀 Starting server...');

try {
  startServer();
} catch (error) {
  logger.error('❌ Failed to start server', { error });
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
