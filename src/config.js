import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.join(os.homedir(), '.agent-viewer');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG = {
  directories: [
    path.join(os.homedir(), '.claude/projects'),
    path.join(os.homedir(), '.codex/sessions')
  ],
  settings: {
    messageMaxLines: 15,
    showThinking: 'fold',       // 'fold' | 'unfold' | 'hide'
    showToolCalls: 'fold',      // 'fold' | 'unfold' | 'hide'
    showSidechains: 'fold',     // 'fold' | 'unfold' | 'hide'
    theme: 'system'             // 'light' | 'dark' | 'system'
  },
  modelPrices: {
    "claude-sonnet-4-20250514": {
      "currency": "USD",
      "input": 3,
      "output": 15,
      "cacheWrite": 3.75,
      "cacheRead": 0.30
    },
    "claude-opus-4-20250514": {
      "currency": "USD",
      "input": 15,
      "output": 75,
      "cacheWrite": 7.50,
      "cacheRead": 1.50
    },
    "deepseek-chat": {
      "currency": "CNY",
      "input": 2,
      "output": 8,
      "cacheWrite": 0.50,
      "cacheRead": 0.125
    }
  }
};

export async function initConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const user = JSON.parse(raw);
    return {
      directories: user.directories || DEFAULT_CONFIG.directories,
      settings: { ...DEFAULT_CONFIG.settings, ...user.settings },
      modelPrices: user.modelPrices || DEFAULT_CONFIG.modelPrices
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.mkdir(CONFIG_DIR, { recursive: true });
      await fs.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
      return { ...DEFAULT_CONFIG, directories: [...DEFAULT_CONFIG.directories] };
    }
    // JSON parse error — back up corrupted file and reset
    const backupPath = CONFIG_PATH + '.bak';
    await fs.copyFile(CONFIG_PATH, backupPath).catch(() => {});
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    console.warn(`配置解析失败，已备份到 ${backupPath}，使用默认配置`);
    return { ...DEFAULT_CONFIG, directories: [...DEFAULT_CONFIG.directories] };
  }
}

export async function getConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT_CONFIG, directories: [...DEFAULT_CONFIG.directories] };
  }
}

export async function updateConfig(partial) {
  const current = await getConfig();
  const merged = {
    directories: partial.directories ?? current.directories,
    settings: { ...current.settings, ...partial.settings },
    modelPrices: partial.modelPrices !== undefined ? partial.modelPrices : (current.modelPrices || {})
  };
  await fs.writeFile(CONFIG_PATH, JSON.stringify(merged, null, 2));
  return merged;
}
