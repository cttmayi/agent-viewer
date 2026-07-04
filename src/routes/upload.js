import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { parseFile } from '../parsers/registry.js';

const upload = multer({
  dest: path.join(os.tmpdir(), 'agent-viewer-uploads'),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});
const router = Router();

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未提供文件' });
  const { store, wss } = req.app.locals;
  try {
    const raw = await fs.readFile(req.file.path, 'utf-8');
    const result = parseFile(raw, req.file.originalname);
    // place uploaded sessions under a virtual Uploads/ directory in the tree
    const safeName = req.file.originalname.replace(/[/\\]/g, '_');
    const storeKey = `Uploads/${Date.now()}_${safeName}`;
    result.session.filePath = storeKey;
    store.set(storeKey, result);
    wss.broadcast({ type: 'session-added', session: result.session });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  } finally {
    // clean up temp file
    fs.unlink(req.file.path).catch(() => {});
  }
});

export default router;
