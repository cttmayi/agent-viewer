import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { initConfig } from './config.js';
import { initStore } from './store.js';
import { initWatcher } from './watcher.js';
import { initWebSocket } from './websocket.js';
import sessionsRouter from './routes/sessions.js';
import configRouter from './routes/config.js';
import uploadRouter from './routes/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3456;

const app = express();
const server = http.createServer(app);

app.use(express.json());

// API 路由
app.use('/api/sessions', sessionsRouter);
app.use('/api/config', configRouter);
app.use('/api/upload', uploadRouter);

// 生产环境静态文件 + SPA 回退
const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

async function start() {
  const config = await initConfig();
  const store = initStore();
  const wss = initWebSocket(server);

  // 把共享实例挂到 app 上供路由使用
  app.locals.config = config;
  app.locals.store = store;
  app.locals.wss = wss;

  const watcher = initWatcher(config, store, wss);
  app.locals.watcher = watcher;

  await watcher.scanAll();
  await watcher.startWatching(config);

  server.listen(PORT, () => {
    console.log(`agent-viewer running at http://localhost:${PORT}`);
  });
}

start();
