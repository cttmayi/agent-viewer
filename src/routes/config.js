import { Router } from 'express';
import { getConfig, updateConfig } from '../config.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'));

const router = Router();

router.get('/', async (req, res) => {
  const config = await getConfig();
  res.json({ ...config, version: pkg.version });
});

router.put('/', async (req, res) => {
  const updated = await updateConfig(req.body);
  if (req.body.directories && req.app.locals.watcher) {
    const config = await getConfig();
    req.app.locals.watcher.startWatching(config);
  }
  res.json(updated);
});

export default router;
