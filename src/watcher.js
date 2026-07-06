import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { parseFile } from './parsers/registry.js';

function normalizeContent(msg) {
  if (msg.content && !Array.isArray(msg.content)) {
    msg.content = [{ type: 'text', text: String(msg.content) }];
  }
  return msg;
}

export function initWatcher(config, store, wss) {
  let watcher = null;

  async function scanDirectory(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          await processFile(fullPath);
        } else if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        }
      }
    } catch (err) {
      console.warn(`无法扫描目录 ${dir}: ${err.message}`);
    }
  }

  async function processFile(filePath) {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const lines = raw.trim().split('\n').filter(Boolean);
      if (lines.length === 0) return;

      // check first line for sidechain detection before full parse
      let isSidechain = false;
      let sidechainSessionId = '';
      try {
        const first = JSON.parse(lines[0]);
        isSidechain = !!first.isSidechain;
        sidechainSessionId = first.sessionId || '';
      } catch (e) { /* not valid JSON, will fail parseFile later */ }

      const result = parseFile(raw, filePath);

      if (isSidechain && sidechainSessionId) {
        // parser nests all messages into sidechainMessages (all have isSidechain=true).
        // Flatten: keep root user message + all assistant + user messages from sidechain.
        // (Tool_result user messages are kept so mergeToolMessages can pair them with tool_uses.)
        const flatMessages = (result.messages[0]?.sidechainMessages?.length
          ? [
              result.messages[0],
              ...result.messages[0].sidechainMessages
            ]
          : result.messages
        ).map(normalizeContent);
        store.addSidechainGroup(sidechainSessionId, flatMessages);
        return;
      }

      // Codex subagent linking
      if (result.subagentRefs) {
        for (const ref of result.subagentRefs) {
          store.registerCodexSubagentLink(ref.agentThreadId, result.session.id, filePath, ref.taskName);
        }
      }
      // Check if this session is a subagent of another Codex session
      const codexParent = store.lookupCodexSubagentLink(result.session.id);
      if (codexParent) {
        store.addCodexSidechainGroup(codexParent.parentSessionId, result.session.id, result.messages.map(normalizeContent), filePath);
        return; // subagent file: don't add to main session list
      }

      store.set(filePath, result);
      wss.broadcast({ type: 'session-added', session: result.session });
    } catch (err) {
      // 无法识别的格式静默跳过（如 file-history-snapshot 等非会话文件）
      if (!err.message.includes('无法识别文件格式')) {
        console.warn(`解析失败 ${filePath}: ${err.message}`);
      }
    }
  }

  async function startWatching(config) {
    if (watcher) await watcher.close();
    const dirs = config.directories.filter(d => d);
    if (dirs.length === 0) return;

    watcher = chokidar.watch(dirs.map(d => path.join(d, '**', '*.jsonl')), {
      ignoreInitial: true,
      persistent: true
    });

    watcher.on('add', filePath => processFile(filePath));
    watcher.on('change', filePath => processFile(filePath));
    watcher.on('unlink', filePath => {
      store.remove(filePath);
      wss.broadcast({ type: 'session-removed', filePath });
    });
  }

  return {
    scanAll: async () => {
      const dirs = config.directories.filter(d => d);
      for (const dir of dirs) {
        await scanDirectory(dir);
      }
      // Second pass: link any Codex subagents whose parent was loaded before child
      store.linkCodexSubagents();
    },
    processFile,
    startWatching,
    stop: async () => { if (watcher) await watcher.close(); }
  };
}
