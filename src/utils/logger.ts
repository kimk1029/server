// PM2 호환성을 위해 console.log를 직접 사용하는 logger
// winston은 PM2에서 출력이 제대로 캡처되지 않는 경우가 많음

const logLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();

const shouldLog = (level: string): boolean => {
  const levels = ['error', 'warn', 'info', 'debug'];
  const currentLevelIndex = levels.indexOf(logLevel);
  const messageLevelIndex = levels.indexOf(level);
  return messageLevelIndex <= currentLevelIndex;
};

const formatMessage = (level: string, message: string, ...meta: any[]): string => {
  const ts = new Date().toLocaleTimeString('ko-KR');
  const metaStr = meta.length > 0 && typeof meta[0] === 'object' 
    ? ' ' + JSON.stringify(meta[0], null, 0)
    : meta.length > 0 
      ? ' ' + meta.map(m => String(m)).join(' ')
      : '';
  return `${ts} [${level}] ${message}${metaStr}`;
};

// winston.Logger 인터페이스와 호환되는 logger
export const logger = {
  info: (message: string, ...meta: any[]) => {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, ...meta));
    }
  },
  error: (message: string, ...meta: any[]) => {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, ...meta));
    }
  },
  warn: (message: string, ...meta: any[]) => {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, ...meta));
    }
  },
  debug: (message: string, ...meta: any[]) => {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, ...meta));
    }
  },
  // winston 호환성을 위한 메서드들 (사용하지 않지만 타입 체크를 위해)
  add: () => {},
  remove: () => {},
  clear: () => {},
  close: () => {},
  query: () => {},
  stream: () => {},
  startTimer: () => ({ done: () => {} }),
  configure: () => {},
  log: () => {},
} as any;
