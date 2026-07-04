import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockStore } = vi.hoisted(() => ({ mockStore: { data: null } }));

// Mock fs/promises before importing config
vi.mock('fs/promises', () => {
  const mockFs = {
    readFile: vi.fn().mockImplementation(() => {
      if (mockStore.data !== null) {
        return Promise.resolve(mockStore.data);
      }
      const err = new Error('ENOENT');
      err.code = 'ENOENT';
      return Promise.reject(err);
    }),
    writeFile: vi.fn().mockImplementation((_path, data) => {
      mockStore.data = data;
      return Promise.resolve();
    }),
    copyFile: vi.fn().mockResolvedValue(),
    mkdir: vi.fn().mockResolvedValue(),
  };
  return { default: mockFs, ...mockFs };
});
import fs from 'fs/promises';

// Importing config triggers readFile via initConfig during module init,
// but config exports async functions, so we import the module directly.
// We need to reset mocks before each test.
import * as configModule from '../src/config.js';

function makeDefaultConfig() {
  return {
    directories: ['/Users/ling/.claude/projects', '/Users/ling/.codex/sessions'],
    settings: {
      messageMaxLines: 15,
      showThinking: 'fold',
      showToolCalls: 'fold',
      showSidechains: 'fold',
      theme: 'system'
    }
  };
}

describe('config module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.data = null;
  });

  // Mock helpers
  function mockConfigExists(data) {
    mockStore.data = JSON.stringify(data);
  }

  function mockConfigMissing() {
    mockStore.data = null;
  }

  function mockConfigCorrupted() {
    mockStore.data = 'not json{{{';
  }

  describe('initConfig', () => {
    it('reads and returns existing config', async () => {
      const existing = makeDefaultConfig();
      mockConfigExists(existing);

      const result = await configModule.initConfig();
      expect(result.directories).toEqual(existing.directories);
      expect(result.settings.messageMaxLines).toBe(15);
    });

    it('creates default config and returns it when file missing', async () => {
      mockConfigMissing();

      const result = await configModule.initConfig();
      expect(fs.writeFile).toHaveBeenCalledOnce();
      expect(result.directories).toHaveLength(2);
      expect(result.settings.messageMaxLines).toBe(15);
      expect(result.settings.theme).toBe('system');
    });

    it('backs up corrupted config and resets to default', async () => {
      mockConfigCorrupted();

      const result = await configModule.initConfig();
      expect(fs.copyFile).toHaveBeenCalledOnce();
      expect(fs.writeFile).toHaveBeenCalledOnce();
      expect(result.settings.messageMaxLines).toBe(15);
    });

    it('merges user settings with defaults', async () => {
      const user = {
        directories: ['/custom/path'],
        settings: { theme: 'dark' }
      };
      mockConfigExists(user);

      const result = await configModule.initConfig();
      expect(result.directories).toEqual(['/custom/path']);
      expect(result.settings.theme).toBe('dark');
      expect(result.settings.messageMaxLines).toBe(15); // default
    });
  });

  describe('getConfig', () => {
    it('returns parsed config', async () => {
      mockConfigExists({ directories: ['/x'], settings: { theme: 'dark' } });
      const result = await configModule.getConfig();
      expect(result.directories).toEqual(['/x']);
    });

    it('returns default config on read failure', async () => {
      mockConfigMissing();
      const result = await configModule.getConfig();
      expect(result.directories).toHaveLength(2);
    });
  });

  describe('updateConfig', () => {
    it('merges partial settings with existing config', async () => {
      mockConfigExists(makeDefaultConfig());

      const result = await configModule.updateConfig({ settings: { theme: 'dark', messageMaxLines: 30 } });
      expect(result.directories).toEqual(makeDefaultConfig().directories);
      expect(result.settings.theme).toBe('dark');
      expect(result.settings.messageMaxLines).toBe(30);
      expect(result.settings.showThinking).toBe('fold'); // unchanged
    });

    it('updates directories', async () => {
      mockConfigExists(makeDefaultConfig());

      const result = await configModule.updateConfig({ directories: ['/new/path'] });
      expect(result.directories).toEqual(['/new/path']);
      // settings should remain
      expect(result.settings.theme).toBe('system');
    });

    it('writes merged config to file', async () => {
      mockConfigExists(makeDefaultConfig());

      await configModule.updateConfig({ settings: { theme: 'dark' } });
      expect(fs.writeFile).toHaveBeenCalledOnce();
      const written = JSON.parse(fs.writeFile.mock.calls[0][1]);
      expect(written.settings.theme).toBe('dark');
      expect(written.settings.messageMaxLines).toBe(15);
    });
  });

  it('persists modelPrices config', async () => {
    mockConfigExists(makeDefaultConfig());
    const prices = { 'test-model': { currency: 'USD', input: 1, output: 2, cacheWrite: 0.5, cacheRead: 0.1 } };
    const config = await configModule.updateConfig({ modelPrices: prices });
    expect(config.modelPrices).toEqual(prices);

    const loaded = await configModule.getConfig();
    expect(loaded.modelPrices).toEqual(prices);
  });
});
