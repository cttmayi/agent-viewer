import { describe, it, expect } from 'vitest';
import * as parser from '../../src/parsers/claude-code.js';

function makeLine(obj) {
  return JSON.stringify(obj);
}

const SID = 'test-sid-123';

function userMsg(overrides = {}) {
  return {
    type: 'user',
    sessionId: SID,
    uuid: overrides.uuid || 'u1',
    parentUuid: overrides.parentUuid ?? null,
    isSidechain: overrides.isSidechain || false,
    timestamp: overrides.timestamp || '2026-01-01T00:00:00.000Z',
    message: { role: 'user', content: overrides.content || [{ type: 'text', text: 'hello' }] },
    cwd: '/test',
    version: '2.1.0',
    gitBranch: 'main',
    ...overrides
  };
}

function assistantMsg(overrides = {}) {
  return {
    type: 'assistant',
    sessionId: SID,
    uuid: overrides.uuid || 'a1',
    parentUuid: overrides.parentUuid ?? null,
    isSidechain: overrides.isSidechain || false,
    timestamp: overrides.timestamp || '2026-01-01T00:00:01.000Z',
    message: {
      role: 'assistant',
      model: 'claude-opus-4',
      content: overrides.content || [{ type: 'text', text: 'hi there' }],
      usage: overrides.usage || { input_tokens: 10, output_tokens: 20, cache_creation: { ephemeral_1h_input_tokens: 0 }, cache_read_input_tokens: 0 }
    },
    ...overrides
  };
}

function attachmentMsg(overrides = {}) {
  return {
    type: 'attachment',
    sessionId: SID,
    uuid: overrides.uuid || 'att1',
    parentUuid: overrides.parentUuid ?? null,
    isSidechain: false,
    timestamp: overrides.timestamp || '2026-01-01T00:00:00.100Z',
    attachment: { content: 'file content', type: 'text' },
    ...overrides
  };
}

function systemRecord(overrides = {}) {
  return {
    type: 'system',
    sessionId: SID,
    uuid: overrides.uuid || 'sys1',
    subtype: overrides.subtype || 'turn_duration',
    durationMs: overrides.durationMs || 1000,
    ...overrides
  };
}

function buildJSONL(...records) {
  return records.map(r => JSON.stringify(r)).join('\n');
}

describe('claude-code parser', () => {

  // --- detect() ---
  describe('detect', () => {
    it('returns true for first line with sessionId', () => {
      expect(parser.detect([makeLine({ sessionId: 'abc' })])).toBe(true);
    });

    it('returns false for empty lines', () => {
      expect(parser.detect([])).toBe(false);
    });

    it('returns false for non-sessionId first line', () => {
      expect(parser.detect([makeLine({ type: 'foo' })])).toBe(false);
    });

    it('returns false for malformed JSON', () => {
      expect(parser.detect(['not json'])).toBe(false);
    });
  });

  // --- parse() ---
  describe('parse', () => {
    it('parses a simple user→assistant exchange', () => {
      const u = userMsg({ uuid: 'u1', content: [{ type: 'text', text: 'hello' }] });
      const a = assistantMsg({ uuid: 'a1', parentUuid: 'u1', content: [{ type: 'text', text: 'hi' }] });
      const raw = buildJSONL(u, a);

      const result = parser.parse(raw);
      expect(result.session.agentType).toBe('claude-code');
      expect(result.session.id).toBe(SID);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content[0].text).toBe('hello');
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[1].content[0].text).toBe('hi');
      expect(result.messages[1].parentId).toBe(result.messages[0].id);
    });

    it('maps attachment type to user role', () => {
      const u = userMsg({ uuid: 'u1' });
      const att = attachmentMsg({ uuid: 'att1', parentUuid: 'u1' });
      const a = assistantMsg({ uuid: 'a1', parentUuid: 'att1' });
      const raw = buildJSONL(u, att, a);

      const result = parser.parse(raw);
      expect(result.messages).toHaveLength(3);
      expect(result.messages[1].role).toBe('user');
    });

    it('extracts sidechain messages into sidechainMessages', () => {
      const u = userMsg({ uuid: 'u1' });
      const side = assistantMsg({ uuid: 'sc1', parentUuid: 'u1', isSidechain: true });
      const a = assistantMsg({ uuid: 'a1', parentUuid: 'u1' });
      const raw = buildJSONL(u, side, a);

      const result = parser.parse(raw);
      const parent = result.messages.find(m => m.id === 'u1');
      expect(parent.sidechainMessages).toBeDefined();
      expect(parent.sidechainMessages).toHaveLength(1);
      expect(parent.sidechainMessages[0].id).toBe('sc1');
      // main chain should not include sidechain
      expect(result.messages.filter(m => m.role === 'assistant').length).toBe(1);
    });

    it('extracts nested sidechain messages', () => {
      const u = userMsg({ uuid: 'u1' });
      const sc1 = assistantMsg({ uuid: 'sc1', parentUuid: 'u1', isSidechain: true });
      const sc2 = assistantMsg({ uuid: 'sc2', parentUuid: 'sc1', isSidechain: true });
      const raw = buildJSONL(u, sc1, sc2);

      const result = parser.parse(raw);
      const parent = result.messages.find(m => m.id === 'u1');
      expect(parent.sidechainMessages).toHaveLength(2);
    });

    it('parses token usage correctly', () => {
      const u = userMsg({ uuid: 'u1', content: [{ type: 'text', text: 'hello' }] });
      const a = assistantMsg({
        uuid: 'a1', parentUuid: 'u1',
        usage: {
          input_tokens: 50,
          output_tokens: 100,
          cache_creation: { ephemeral_1h_input_tokens: 30 },
          cache_read_input_tokens: 20
        }
      });
      const raw = buildJSONL(u, a);

      const result = parser.parse(raw);
      expect(result.stats.totalInputTokens).toBe(50);
      expect(result.stats.totalOutputTokens).toBe(100);
      expect(result.stats.totalCacheCreateTokens).toBe(30);
      expect(result.stats.totalCacheReadTokens).toBe(20);
    });

    it('parses tool calls from content blocks', () => {
      const u = userMsg({ uuid: 'u1' });
      const a = assistantMsg({
        uuid: 'a1', parentUuid: 'u1',
        content: [
          { type: 'text', text: 'running tool' },
          { type: 'tool_use', name: 'bash', input: { cmd: 'ls' } },
          { type: 'tool_result', name: 'bash', input: { exit: 0 } }
        ]
      });
      const raw = buildJSONL(u, a);

      const result = parser.parse(raw);
      expect(result.stats.toolCallCount).toBe(2);
      expect(result.stats.topUsedTools).toHaveLength(1);
      expect(result.stats.topUsedTools[0].name).toBe('bash');
      expect(result.stats.topUsedTools[0].count).toBe(2);
    });

    it('computes duration from system turn_duration records', () => {
      const u = userMsg({ uuid: 'u1' });
      const a = assistantMsg({ uuid: 'a1', parentUuid: 'u1' });
      const s = systemRecord({ uuid: 'sys1', durationMs: 5000 });
      const raw = buildJSONL(u, a, s);

      const result = parser.parse(raw);
      expect(result.stats.totalDuration).toBe(5000);
    });

    it('tracks model usage', () => {
      const u = userMsg({ uuid: 'u1' });
      const a1 = assistantMsg({ uuid: 'a1', parentUuid: 'u1', message: { role: 'assistant', model: 'opus', content: [{ type: 'text', text: 'a' }] } });
      const a2 = assistantMsg({ uuid: 'a2', parentUuid: 'a1', message: { role: 'assistant', model: 'opus', content: [{ type: 'text', text: 'b' }] } });
      const raw = buildJSONL(u, a1, a2);

      const result = parser.parse(raw);
      expect(result.stats.modelUsage).toEqual({ opus: 2 });
    });

    it('handles empty input gracefully', () => {
      const result = parser.parse('');
      expect(result.session.id).toBe('unknown');
      expect(result.messages).toHaveLength(0);
    });

    it('skips malformed JSON lines', () => {
      const raw = '{valid}\nnot json\n{valid too}';
      // First line is valid JSON, so detect would pass, but second line is malformed
      // We need to build it properly
      const u = userMsg({ uuid: 'u1' });
      const raw2 = JSON.stringify(u) + '\nnot json\n';

      const result = parser.parse(raw2);
      expect(result.messages).toHaveLength(1);
    });

    it('synthesizes ID when uuid is missing', () => {
      const u = userMsg({ uuid: undefined });
      const raw = JSON.stringify(u);
      const result = parser.parse(raw);
      expect(result.messages[0].id).toBeTruthy();
    });

    it('sets session title from first user message content', () => {
      const u = userMsg({ uuid: 'u1', content: [{ type: 'text', text: 'my title text' }] });
      const raw = JSON.stringify(u);
      const result = parser.parse(raw);
      expect(result.session.title).toBe('my title text');
    });

    it('sets title from last user before first assistant', () => {
      const u1 = userMsg({ uuid: 'u1', content: [{ type: 'text', text: 'ignored' }], timestamp: '2026-01-01T00:00:00.000Z' });
      const u2 = userMsg({ uuid: 'u2', parentUuid: 'u1', content: [{ type: 'text', text: 'real question' }], timestamp: '2026-01-01T00:00:01.000Z' });
      const a = assistantMsg({ uuid: 'a1', parentUuid: 'u2', content: [{ type: 'text', text: 'answer' }], timestamp: '2026-01-01T00:00:02.000Z' });
      const raw = buildJSONL(u1, u2, a);
      const result = parser.parse(raw);
      expect(result.session.title).toBe('real question');
    });

    it('skips user messages starting with < for title', () => {
      const u1 = userMsg({ uuid: 'u1', content: [{ type: 'text', text: '<environment_context>' }], timestamp: '2026-01-01T00:00:00.000Z' });
      const u2 = userMsg({ uuid: 'u2', parentUuid: 'u1', content: [{ type: 'text', text: 'actual question' }], timestamp: '2026-01-01T00:00:01.000Z' });
      const a = assistantMsg({ uuid: 'a1', parentUuid: 'u2', content: [{ type: 'text', text: 'answer' }], timestamp: '2026-01-01T00:00:02.000Z' });
      const raw = buildJSONL(u1, u2, a);
      const result = parser.parse(raw);
      expect(result.session.title).toBe('actual question');
    });

    it('falls back to assistant text when all user messages start with <', () => {
      const u = userMsg({ uuid: 'u1', content: [{ type: 'text', text: '<system> message' }], timestamp: '2026-01-01T00:00:00.000Z' });
      const a = assistantMsg({ uuid: 'a1', parentUuid: 'u1', content: [{ type: 'text', text: 'useful response' }], timestamp: '2026-01-01T00:00:01.000Z' });
      const raw = buildJSONL(u, a);
      const result = parser.parse(raw);
      expect(result.session.title).toBe('useful response');
    });

    it('calculates totalTurns correctly', () => {
      const u1 = userMsg({ uuid: 'u1' });
      const a1 = assistantMsg({ uuid: 'a1', parentUuid: 'u1' });
      const u2 = userMsg({ uuid: 'u2', parentUuid: 'a1' });
      const a2 = assistantMsg({ uuid: 'a2', parentUuid: 'u2' });
      const raw = buildJSONL(u1, a1, u2, a2);

      const result = parser.parse(raw);
      expect(result.stats.totalTurns).toBe(2);
    });

  });
});
