import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('chokidar', () => {
  const mockWatcher = { on: vi.fn(), close: vi.fn().mockResolvedValue() };
  return { default: { watch: vi.fn(() => mockWatcher) }, mockWatcher };
});

vi.mock('fs/promises');
import fs from 'fs/promises';
import { initWatcher } from '../src/watcher.js';

function makeStore() {
  const map = new Map();
  const sidechainMap = new Map();
  return {
    set: vi.fn((k, v) => map.set(k, v)),
    get: vi.fn(k => map.get(k)),
    remove: vi.fn(k => map.delete(k)),
    has: vi.fn(k => map.has(k)),
    clear: vi.fn(() => map.clear()),
    getAll: vi.fn(() => []),
    buildDirectoryTree: vi.fn(() => ({ name: 'root' })),
    addSidechain: vi.fn((sessionId, messages) => {
      if (!sidechainMap.has(sessionId)) sidechainMap.set(sessionId, []);
      sidechainMap.get(sessionId).push(...messages);
    }),
    getSidechainsForSession: vi.fn(sessionId => sidechainMap.get(sessionId) || [])
  };
}
function makeWss() { return { broadcast: vi.fn() }; }

describe('sidechain integration', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('flattens sidechain messages for display (user + assistant, no attachment)', async () => {
    // realistic sidechain JSONL: user prompt → attachment (skill listing) → assistant response
    const sidechainJsonl = [
      JSON.stringify({
        parentUuid: null, isSidechain: true,
        type: 'user', uuid: 'u1',
        message: { role: 'user', content: [{ type: 'text', text: 'analyze this design' }] },
        sessionId: 'parent-session-123', timestamp: '2025-01-01T00:00:00Z'
      }),
      JSON.stringify({
        parentUuid: 'u1', isSidechain: true,
        type: 'attachment', uuid: 'a1',
        attachment: { type: 'skill_listing', content: 'Available skills: ...' },
        sessionId: 'parent-session-123', timestamp: '2025-01-01T00:00:01Z'
      }),
      JSON.stringify({
        parentUuid: 'a1', isSidechain: true,
        type: 'assistant', uuid: 'a2',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Analysis complete' }] },
        sessionId: 'parent-session-123', timestamp: '2025-01-01T00:00:02Z'
      })
    ].join('\n');

    fs.readFile = vi.fn().mockResolvedValue(sidechainJsonl);
    const store = makeStore();
    const watcher = initWatcher({ directories: ['/test'] }, store, makeWss());
    await watcher.processFile('/test/subagents/agent-coder.jsonl');

    // should be stored via addSidechain, not store.set
    expect(store.set).not.toHaveBeenCalled();
    expect(store.addSidechain).toHaveBeenCalledWith('parent-session-123', expect.any(Array));

    // verify flattened messages: only user and assistant, no attachment
    const stored = store.getSidechainsForSession('parent-session-123');
    expect(stored.length).toBe(2);
    expect(stored[0].role).toBe('user');
    expect(stored[0].content[0].text).toBe('analyze this design');
    expect(stored[1].role).toBe('assistant');
    expect(stored[1].content[0].text).toBe('Analysis complete');
  });

  it('shows subagent block when viewport is open', async () => {
    // simulate what the frontend receives by checking message shape
    const sidechainJsonl = [
      JSON.stringify({
        parentUuid: null, isSidechain: true,
        type: 'user', uuid: 'u1',
        message: { role: 'user', content: [{ type: 'text', text: 'hello' }] },
        sessionId: 'sid-1', timestamp: '2025-01-01T00:00:00Z'
      }),
      JSON.stringify({
        parentUuid: 'u1', isSidechain: true,
        type: 'assistant', uuid: 'a1',
        message: { role: 'assistant', content: [{ type: 'text', text: 'response' }] },
        sessionId: 'sid-1', timestamp: '2025-01-01T00:00:01Z'
      })
    ].join('\n');

    fs.readFile = vi.fn().mockResolvedValue(sidechainJsonl);
    const store = makeStore();
    const watcher = initWatcher({ directories: ['/test'] }, store, makeWss());
    await watcher.processFile('/test/subagents/agent-x.jsonl');

    const msgs = store.getSidechainsForSession('sid-1');
    expect(msgs.length).toBe(2);

    // each message has the fields SidechainGroup/MessageList needs
    for (const m of msgs) {
      expect(m).toHaveProperty('role');
      expect(m).toHaveProperty('content');
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('timestamp');
    }
  });
});
