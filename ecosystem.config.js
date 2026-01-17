module.exports = {
  apps: [
    {
      name: 'pnt-stage',
      script: './dist/index.js',
      cwd: '/kh_dev/server',  // 절대 경로로 명시
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      env_stage: {
        NODE_ENV: 'stage',
        PORT: '9991',
      },
      error_file: '/root/.pm2/logs/pnt-stage-error.log',
      out_file: '/root/.pm2/logs/pnt-stage-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};