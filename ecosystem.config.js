/**
 * PM2 ecosystem for stage server
 *
 * Usage on stage server:
 *   cd <REPO_ROOT>/server
 *   pm2 start ecosystem.config.js --env stage
 */
module.exports = {
  apps: [
    {
      name: 'pnt-stage',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      env_stage: {
        NODE_ENV: 'stage',
        PORT: '9991',
      },
    },
  ],
};

