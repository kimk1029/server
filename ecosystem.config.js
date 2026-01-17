module.exports = {
  apps: [
    {
      name: 'pnt-stage',
      script: './dist/index.js',
      cwd: '/kh_dev/server',  // 절대 경로로 명시
      interpreter: '/root/.nvm/versions/node/v21.7.3/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      env_stage: {
        NODE_ENV: 'stage',
        PORT: '9001',
        PATH: '/root/.nvm/versions/node/v21.7.3/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      },
      error_file: '/root/.pm2/logs/pnt-stage-error.log',
      out_file: '/root/.pm2/logs/pnt-stage-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    // TURN 서버 (Coturn) - systemd로 관리하는 것이 더 일반적이지만, PM2로도 가능
    // 주의: Coturn은 systemd로 관리하는 것을 권장합니다 (ecosystem.config.js에서 제외)
    // {
    //   name: 'pnt-turn-server',
    //   script: 'turnserver',
    //   args: '-c /etc/turnserver.conf',
    //   instances: 1,
    //   exec_mode: 'fork',
    //   autorestart: true,
    //   max_restarts: 10,
    //   error_file: '/root/.pm2/logs/pnt-turn-error.log',
    //   out_file: '/root/.pm2/logs/pnt-turn-out.log',
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss',
    // },
  ],
};