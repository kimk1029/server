import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

// 커스텀 포맷터: 예쁜 로그 출력
const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const ts =
    typeof timestamp === 'string' || typeof timestamp === 'number' || timestamp instanceof Date
      ? new Date(timestamp).toLocaleTimeString('ko-KR')
      : '';
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 0) : '';
  return `${ts} [${level}] ${message}${metaStr ? ' ' + metaStr : ''}`;
});

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        customFormat
      )
    })
  ]
});

// 프로덕션 환경에서는 파일 로깅 추가
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({ filename: 'error.log', level: 'error' })
  );
  logger.add(
    new winston.transports.File({ filename: 'combined.log' })
  );
}
