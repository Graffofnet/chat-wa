// Файл для PM2 (если хостинг позволяет запускать pm2 вместо cPanel-панели):
//   npm i -g pm2 && pm2 start ecosystem.config.js && pm2 save
module.exports = {
    apps: [{
        name: 'wa-chat',
        script: './server.js',
        env: { PORT: 3000, NODE_ENV: 'production' },
        autorestart: true,
        max_memory_restart: '256M'
    }]
};
