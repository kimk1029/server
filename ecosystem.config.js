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
      env_stage: {
        NODE_ENV: 'stage',
        PORT: '9991',
      },
    },
  ],
};

