/**
 * PM2 process file for IT Request system
 *
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save
 *   pm2 startup     # ทำครั้งแรกเพื่อให้ start อัตโนมัติเมื่อบูต
 *
 *   pm2 logs itrequest          ดู log สด
 *   pm2 restart itrequest       restart
 *   pm2 reload itrequest        zero-downtime restart
 *   pm2 stop itrequest
 *   pm2 delete itrequest
 */
module.exports = {
  apps: [
    {
      name: 'itrequest',
      cwd: __dirname,
      script: 'server/index.js',
      exec_mode: 'fork',     // fork mode — บาง dep ใช้ global ไม่ดีกับ cluster
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      watch: false,           // production: ไม่ watch
      time: true,             // log มี timestamp
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // log files (PM2 จะเขียนใน ~/.pm2/logs/ ถ้าไม่ระบุ path)
      out_file: './logs/itrequest-out.log',
      error_file: './logs/itrequest-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
