// Точка входа для виртуального хостинга (cPanel → Setup Node.js App).
// В поле «Application startup file» в панели хостинга указывается app.js,
// поэтому этот файл просто загружает основной сервер server.js.
require('./server.js');
