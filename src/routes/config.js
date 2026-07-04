import { Router } from 'express';
import { getConfig, updateConfig } from '../config.js';

const router = Router();

router.get('/', async (req, res) => {
  const config = await getConfig();
  res.json(config);
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
