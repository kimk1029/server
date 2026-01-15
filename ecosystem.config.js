/**
 * PM2 ecosystem for stage server
 *
 * Usage on stage server:
 *   cd <REPO_ROOT>/server
 *   pm2 startOrReload ecosystem.config.js --env stage
 */
module.exports = {
  apps: [
    {
      name: 'pnt-stage',
      cwd: __dirname,
      script: 'dist/index.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      time: true,
      // 로그 설정: stdout/stderr 즉시 출력
      merge_logs: false, // stdout와 stderr를 분리해서 캡처
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 절대 경로 사용 (상대 경로는 문제가 될 수 있음)
      error_file: '/kh_dev/server/logs/pm2-error.log',
      out_file: '/kh_dev/server/logs/pm2-out.log',
      log_file: '/kh_dev/server/logs/pm2-combined.log',
      // 출력 버퍼링 비활성화 (즉시 출력)
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 10000,
      // PM2가 stdout/stderr를 제대로 캡처하도록 설정
      disable_logs: false,
      log_type: 'json', // JSON 형식으로 로그 저장 (더 안정적)
      combine_logs: true, // stdout와 stderr를 하나로 합침
      // 주의: PM2 watch는 재시작만 하고 빌드는 안함
      // 빌드 + 재시작을 자동화하려면 npm run watch:build 사용
      // watch: ['src'],
      // watch_delay: 2000,
      // ignore_watch: ['node_modules', 'dist', '.git', '*.log'],
      env_stage: {
        NODE_ENV: 'stage',
        PORT: '9991',
        LOG_LEVEL: 'info', // 로그 레벨 명시
      },
      // Node.js 경로 명시 (nvm 사용 시 필요)
      // interpreter: '/root/.nvm/versions/node/v21.7.3/bin/node',
      // interpreter_args: '',
    },
  ],
};

