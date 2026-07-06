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
      store.set('/base/a/y.jsonl', { session: { id: 's2', agentType: 'cc', title: 't2', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      store.set('/base/rootfile.jsonl', { session: { id: 's3', agentType: 'cc', title: 't3', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      store.set('/other/b/z.jsonl', { session: { id: 's4', agentType: 'cc', title: 't4', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      store.set('/other/b/w.jsonl', { session: { id: 's5', agentType: 'cc', title: 't5', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      store.set('/other/rootfile.jsonl', { session: { id: 's6', agentType: 'cc', title: 't6', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });

      const tree = store.buildDirectoryTree(['/base', '/other']);
      expect(tree.children).toHaveLength(2);
      expect(tree.children[0].name).toBe('/base');
      expect(tree.children[0].children[0].name).toBe('a');
      expect(tree.children[1].name).toBe('/other');
      expect(tree.children[1].children[0].name).toBe('b');
    });

    it('flattens single-child directory chains under base dir', () => {
      store.set('/base1/a/b/file.jsonl', { session: { id: 's1', agentType: 'cc', title: 't1', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      store.set('/base2/x.jsonl', { session: { id: 's2', agentType: 'cc', title: 't2', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      const tree = store.buildDirectoryTree(['/base1', '/base2']);
      // a/b flattened: file.jsonl directly under /base1
      const base1 = tree.children.find(c => c.name === '/base1');
      expect(base1.children).toHaveLength(1);
      expect(base1.children[0].name).toBe('file.jsonl');
    });

    it('preserves multi-child directories from flattening', () => {
      store.set('/base1/a/b/file1.jsonl', { session: { id: 's1', agentType: 'cc', title: 't1', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      store.set('/base1/a/c/file2.jsonl', { session: { id: 's2', agentType: 'cc', title: 't2', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      store.set('/base1/extra.jsonl', { session: { id: 's3', agentType: 'cc', title: 't3', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      store.set('/base2/x.jsonl', { session: { id: 's4', agentType: 'cc', title: 't4', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      const tree = store.buildDirectoryTree(['/base1', '/base2']);
      const base1 = tree.children.find(c => c.name === '/base1');
      const aNode = base1.children.find(c => c.name === 'a');
      expect(aNode).toBeDefined();
      expect(aNode.children).toHaveLength(2);
    });

    it('uses full base directory path as root node name', () => {
      store.set('/home/user/.claude/projects/test/session.jsonl', { session: { id: 's1', agentType: 'cc', title: 't1', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      store.set('/other/x.jsonl', { session: { id: 's2', agentType: 'cc', title: 't2', startTime: '', endTime: '', messageCount: 0, totalTokens: 0, model: '', cwd: '', gitBranch: '', filePath: '' } });
      const tree = store.buildDirectoryTree(['/home/user/.claude/projects', '/other']);
      expect(tree.children[0].name).toBe('/home/user/.claude/projects');
      expect(tree.children[0].type).toBe('directory');
    });
  });

  describe('sidechain groups', () => {
    it('adds and retrieves sidechain groups', () => {
      const messages = [{ id: 'm1' }, { id: 'm2' }];
      store.addSidechainGroup('session-1', messages, '/path/to/file.jsonl');
      const groups = store.getSidechainGroups('session-1');
      expect(groups).toHaveLength(1);
      expect(groups[0].messages).toBe(messages);
      expect(groups[0].filePath).toBe('/path/to/file.jsonl');
    });

    it('returns empty array for unknown session', () => {
      expect(store.getSidechainGroups('nonexistent')).toEqual([]);
    });
  });
});
