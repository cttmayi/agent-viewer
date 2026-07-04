import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('chokidar', () => {
  const mockWatcher = {
    on: vi.fn(),
    close: vi.fn().mockResolvedValue()
  };
  const watch = vi.fn(() => mockWatcher);
  return { default: { watch }, mockWatcher, watch };
});

vi.mock('fs/promises');
import fs from 'fs/promises';
import chokidar from 'chokidar';
import { initWatcher } from '../src/watcher.js';

function makeConfig(dirs) {
  return { directories: dirs || ['/test/dir'] };
}

function makeStore() {
  const map = new Map();
  const sidechainMap = new Map();
  return {
    set: vi.fn((k, v) => map.set(k, v)),
    get: vi.fn(k => map.get(k)),
    remove: vi.fn(k => map.delete(k)),
    has: vi.fn(k => map.has(k)),
    clear: vi.fn(() => map.clear()),
    getAll: vi.fn(() => Array.from(map.values()).map(e => e.session)),
    buildDirectoryTree: vi.fn(() => ({ name: 'root' })),
    addSidechain: vi.fn((sessionId, messages) => {
      if (!sidechainMap.has(sessionId)) sidechainMap.set(sessionId, []);
      sidechainMap.get(sessionId).push(...messages);
    }),
    getSidechainsForSession: vi.fn(sessionId => sidechainMap.get(sessionId) || [])
  };
}

function makeWss() {
  return { broadcast: vi.fn() };
}

describe('watcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scanAll', () => {
    it('scans each configured directory', async () => {
      fs.readdir = vi.fn().mockResolvedValue([]);
      const config = makeConfig(['/dir1', '/dir2']);
      const watcher = initWatcher(config, makeStore(), makeWss());
      await watcher.scanAll();
      expect(fs.readdir).toHaveBeenCalledWith('/dir1', { withFileTypes: true });
      expect(fs.readdir).toHaveBeenCalledWith('/dir2', { withFileTypes: true });
    });

    it('parses .jsonl files found during scan', async () => {
      const dirent = (name, type) => ({ name, isFile: () => type === 'file', isDirectory: () => type === 'dir' });
      fs.readdir = vi.fn().mockResolvedValue([
        dirent('session.jsonl', 'file'),
        dirent('readme.txt', 'file'),
        dirent('data.json', 'file'),
      ]);
      fs.readFile = vi.fn().mockResolvedValue('{"sessionId":"test"}\n{"type":"user","uuid":"u1"}');

      const store = makeStore();
      const wss = makeWss();
      const watcher = initWatcher(makeConfig(), store, wss);
      await watcher.scanAll();

      // should only process .jsonl files
      expect(fs.readFile).toHaveBeenCalledTimes(1);
      expect(fs.readFile).toHaveBeenCalledWith(expect.stringContaining('session.jsonl'), 'utf-8');
      expect(store.set).toHaveBeenCalledTimes(1);
    });

    it('recursively scans subdirectories', async () => {
      const dirent = (name, type) => ({ name, isFile: () => type === 'file', isDirectory: () => type === 'dir' });
      fs.readdir = vi.fn()
        .mockResolvedValueOnce([
          dirent('project-alpha', 'dir'),
          dirent('notes.txt', 'file'),
        ])
        .mockResolvedValueOnce([
          dirent('session.jsonl', 'file'),
        ])
        .mockResolvedValue([]);
      fs.readFile = vi.fn().mockResolvedValue('{"sessionId":"test"}\n{"type":"user","uuid":"u1"}');

      const store = makeStore();
      const watcher = initWatcher(makeConfig(['/base']), store, makeWss());
      await watcher.scanAll();

      // scanned /base → found project-alpha (dir) → recursed into it → found session.jsonl
      expect(fs.readdir).toHaveBeenCalledWith('/base', { withFileTypes: true });
      expect(fs.readdir).toHaveBeenCalledWith('/base/project-alpha', { withFileTypes: true });
      expect(fs.readFile).toHaveBeenCalledWith(expect.stringContaining('project-alpha/session.jsonl'), 'utf-8');
      expect(store.set).toHaveBeenCalledTimes(1);
    });

    it('handles scan directory errors gracefully', async () => {
      fs.readdir = vi.fn().mockRejectedValue(new Error('permission denied'));
      const store = makeStore();
      const watcher = initWatcher(makeConfig(), store, makeWss());
      await expect(watcher.scanAll()).resolves.not.toThrow();
      expect(store.set).not.toHaveBeenCalled();
    });

    it('skips empty files', async () => {
      const dirent = (name) => ({ name, isFile: () => true, isDirectory: () => false });
      fs.readdir = vi.fn().mockResolvedValue([dirent('empty.jsonl')]);
      fs.readFile = vi.fn().mockResolvedValue('');

      const store = makeStore();
      const watcher = initWatcher(makeConfig(), store, makeWss());
      await watcher.scanAll();
      expect(store.set).not.toHaveBeenCalled();
    });

    it('scans into subagents directory but stores sidechain files separately', async () => {
      const dirent = (name, type) => ({ name, isFile: () => type === 'file', isDirectory: () => type === 'dir' });
      fs.readdir = vi.fn()
        .mockResolvedValueOnce([
          dirent('subagents', 'dir'),
          dirent('normal.jsonl', 'file'),
        ])
        .mockResolvedValueOnce([]);
      fs.readFile = vi.fn().mockResolvedValue('{"sessionId":"test"}\n{"type":"user","uuid":"u1"}');

      const store = makeStore();
      const wss = makeWss();
      const watcher = initWatcher(makeConfig(), store, wss);
      await watcher.scanAll();

      // subagents dir is now recursed into, normal.jsonl processed as regular session
      expect(fs.readdir).toHaveBeenCalledTimes(2);
      expect(fs.readdir).toHaveBeenCalledWith('/test/dir', { withFileTypes: true });
      expect(fs.readdir).toHaveBeenCalledWith(expect.stringContaining('subagents'), { withFileTypes: true });
      expect(store.set).toHaveBeenCalledTimes(1);
    });

    it('handles parse errors gracefully', async () => {
      const dirent = (name) => ({ name, isFile: () => true, isDirectory: () => false });
      fs.readdir = vi.fn().mockResolvedValue([dirent('bad.jsonl')]);
      fs.readFile = vi.fn().mockResolvedValue('{"sessionId":"test"}');

      const store = makeStore();
      const watcher = initWatcher(makeConfig(), store, makeWss());
      await watcher.scanAll();
      expect(fs.readFile).toHaveBeenCalled();
    });
  });

  describe('processFile', () => {
    it('parses file and stores result', async () => {
      fs.readFile = vi.fn().mockResolvedValue('{"sessionId":"abc"}\n{"type":"user","uuid":"u1"}');
      const store = makeStore();
      const wss = makeWss();
      const watcher = initWatcher(makeConfig(), store, wss);
      await watcher.processFile('/path/to/session.jsonl');
      expect(store.set).toHaveBeenCalled();
      expect(wss.broadcast).toHaveBeenCalledWith({
        type: 'session-added',
        session: expect.any(Object)
      });
    });

    it('handles read errors gracefully', async () => {
      fs.readFile = vi.fn().mockRejectedValue(new Error('read failed'));
      const store = makeStore();
      const watcher = initWatcher(makeConfig(), store, makeWss());
      await expect(watcher.processFile('/path/to/bad.jsonl')).resolves.not.toThrow();
      expect(store.set).not.toHaveBeenCalled();
    });

    it('stores sidechain files via addSidechain instead of main store', async () => {
      const sidechainContent = '{"sessionId":"parent-uuid","isSidechain":true}\n{"type":"user","uuid":"u1","content":"hi"}';
      fs.readFile = vi.fn().mockResolvedValue(sidechainContent);

      const store = makeStore();
      const watcher = initWatcher(makeConfig(), store, makeWss());
      await watcher.processFile('/base/session-uuid/subagents/agent-xxx.jsonl');

      expect(fs.readFile).toHaveBeenCalledTimes(1);
      expect(store.addSidechain).toHaveBeenCalledWith('parent-uuid', expect.any(Array));
      expect(store.set).not.toHaveBeenCalled();
    });

    it('handles sidechain files found during scan', async () => {
      const dirent = (name, type) => ({ name, isFile: () => type === 'file', isDirectory: () => type === 'dir' });
      const sidechainContent = '{"sessionId":"parent-uuid","isSidechain":true}\n{"type":"user","uuid":"u1","content":"hi"}';
      fs.readdir = vi.fn()
        .mockResolvedValueOnce([
          dirent('subagents', 'dir'),
        ])
        .mockResolvedValueOnce([
          dirent('agent-coder.jsonl', 'file'),
        ]);
      fs.readFile = vi.fn().mockResolvedValue(sidechainContent);

      const store = makeStore();
      const wss = makeWss();
      const watcher = initWatcher(makeConfig(['/base']), store, wss);
      await watcher.scanAll();

      // scanned /base → recursed into subagents/ → found sidechain file
      expect(store.addSidechain).toHaveBeenCalledWith('parent-uuid', expect.any(Array));
      expect(store.set).not.toHaveBeenCalled();
    });
  });

  describe('startWatching', () => {
    it('starts chokidar watcher on configured directories', async () => {
      const config = makeConfig(['/test/dir']);
      const watcher = initWatcher(config, makeStore(), makeWss());
      await watcher.startWatching(config);

      expect(chokidar.watch).toHaveBeenCalledWith(
        [expect.stringContaining('/test/dir')],
        expect.objectContaining({ ignoreInitial: true, persistent: true })
      );
    });

    it('does nothing when directories are empty', async () => {
      const config = makeConfig([]);
      const watcher = initWatcher(config, makeStore(), makeWss());
      await watcher.startWatching(config);
      expect(chokidar.watch).not.toHaveBeenCalled();
    });

    it('registers add, change, unlink handlers', async () => {
      const watcher = initWatcher(makeConfig(), makeStore(), makeWss());
      await watcher.startWatching(makeConfig());

      const mockWatcherInstance = chokidar.watch();
      expect(mockWatcherInstance.on).toHaveBeenCalledWith('add', expect.any(Function));
      expect(mockWatcherInstance.on).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockWatcherInstance.on).toHaveBeenCalledWith('unlink', expect.any(Function));
    });

    it('stop closes the watcher', async () => {
      const watcher = initWatcher(makeConfig(), makeStore(), makeWss());
      await watcher.startWatching(makeConfig());
      await watcher.stop();
      const mockWatcherInstance = chokidar.watch();
      expect(mockWatcherInstance.close).toHaveBeenCalled();
    });
  });
});
