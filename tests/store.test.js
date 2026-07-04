import { describe, it, expect, beforeEach } from 'vitest';
import { initStore } from '../src/store.js';

describe('store', () => {
  let store;

  beforeEach(() => {
    store = initStore();
  });

  describe('basic CRUD', () => {
    it('get returns null for unknown key', () => {
      expect(store.get('/nonexistent')).toBeNull();
    });

    it('set and get round-trips a value', () => {
      const data = { session: { id: 's1' }, messages: [], stats: {} };
      store.set('/path/to/file.jsonl', data);
      expect(store.get('/path/to/file.jsonl')).toBe(data);
    });

    it('has returns true/false', () => {
      expect(store.has('/path')).toBe(false);
      store.set('/path', { session: { id: 's1' }, messages: [], stats: {} });
      expect(store.has('/path')).toBe(true);
    });

    it('remove deletes a key', () => {
      store.set('/path', { session: { id: 's1' }, messages: [], stats: {} });
      store.remove('/path');
      expect(store.has('/path')).toBe(false);
    });

    it('getAll returns all sessions', () => {
      store.set('/a', { session: { id: 'a' }, messages: [], stats: {} });
      store.set('/b', { session: { id: 'b' }, messages: [], stats: {} });
      const all = store.getAll();
      expect(all).toHaveLength(2);
      expect(all.map(s => s.id)).toEqual(['a', 'b']);
    });

    it('clear removes all entries', () => {
      store.set('/a', { session: { id: 'a' }, messages: [], stats: {} });
      store.clear();
      expect(store.getAll()).toHaveLength(0);
    });
  });

  describe('buildDirectoryTree', () => {
    it('returns root with no children for empty store', () => {
      const tree = store.buildDirectoryTree(['/base']);
      expect(tree.name).toBe('root');
      expect(tree.type).toBe('directory');
      expect(tree.children).toBeUndefined();
    });

    it('builds flat tree for single file', () => {
      store.set('/base/file.jsonl', { session: { id: 's1', agentType: 'cc', title: 'test', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      const tree = store.buildDirectoryTree(['/base']);
      expect(tree.children).toHaveLength(1);
      expect(tree.children[0].name).toBe('file.jsonl');
      expect(tree.children[0].type).toBe('file');
      expect(tree.children[0].session.id).toBe('s1');
    });

    it('builds nested directory structure', () => {
      store.set('/base/dir1/file.jsonl', { session: { id: 's1', agentType: 'cc', title: 't1', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      store.set('/base/dir1/sub/file2.jsonl', { session: { id: 's2', agentType: 'cc', title: 't2', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      store.set('/base/dir2/file3.jsonl', { session: { id: 's3', agentType: 'cc', title: 't3', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });

      const tree = store.buildDirectoryTree(['/base']);
      expect(tree.children).toHaveLength(2);

      const dir1 = tree.children.find(c => c.name === 'dir1');
      expect(dir1).toBeDefined();
      expect(dir1.children).toHaveLength(2);
      // directories sort before files
      expect(dir1.children[0].name).toBe('sub');
      expect(dir1.children[0].type).toBe('directory');
      expect(dir1.children[1].name).toBe('file.jsonl');
      expect(dir1.children[1].type).toBe('file');

      const dir2 = tree.children.find(c => c.name === 'dir2');
      expect(dir2).toBeDefined();
      expect(dir2.children).toHaveLength(1);
    });

    it('sorts directories before files', () => {
      store.set('/base/a_file.jsonl', { session: { id: 's1', agentType: 'cc', title: 't1', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      store.set('/base/z_file.jsonl', { session: { id: 's2', agentType: 'cc', title: 't2', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      store.set('/base/adir/x.jsonl', { session: { id: 's3', agentType: 'cc', title: 't3', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });

      const tree = store.buildDirectoryTree(['/base']);
      expect(tree.children[0].type).toBe('directory');
      expect(tree.children[1].type).toBe('file');
      expect(tree.children[2].type).toBe('file');
    });

    it('strips base directory prefix from relative paths', () => {
      store.set('/home/user/.claude/projects/foo/session1.jsonl', {
        session: { id: 's1', agentType: 'cc', title: 't1', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' }
      });
      store.set('/home/user/.claude/projects/bar/session2.jsonl', {
        session: { id: 's2', agentType: 'cc', title: 't2', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' }
      });

      const tree = store.buildDirectoryTree(['/home/user/.claude/projects']);
      expect(tree.children).toHaveLength(2);
      expect(tree.children[0].name).toBe('bar');
      expect(tree.children[0].type).toBe('directory');
      expect(tree.children[1].name).toBe('foo');
      expect(tree.children[1].type).toBe('directory');
    });

    it('handles multiple base directories', () => {
      store.set('/base/a/x.jsonl', { session: { id: 's1', agentType: 'cc', title: 't1', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      store.set('/other/b/y.jsonl', { session: { id: 's2', agentType: 'cc', title: 't2', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });

      const tree = store.buildDirectoryTree(['/base', '/other']);
      expect(tree.children).toHaveLength(2);
      expect(tree.children[0].name).toBe('a');
      expect(tree.children[1].name).toBe('b');
    });
  });
});
