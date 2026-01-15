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
      // 주의: PM2 watch는 재시작만 하고 빌드는 안함
      // 빌드 + 재시작을 자동화하려면 npm run watch:build 사용
      // watch: ['src'],
      // watch_delay: 2000,
      // ignore_watch: ['node_modules', 'dist', '.git', '*.log'],
      env_stage: {
        NODE_ENV: 'stage',
        PORT: '9991',
      },
    },
  ],
};

