import { describe, it, expect } from 'vitest';
import * as parser from '../../src/parsers/codex.js';

function metaRecord(overrides = {}) {
  return {
    type: 'session_meta',
    payload: {
      id: 'codex-sid-1',
      timestamp: '2026-01-01T00:00:00.000Z',
      originator: 'codex-tui',
      cli_version: '0.133.0',
      model_provider: 'openai',
      cwd: '/test',
      ...overrides
    }
  };
}

function responseItem(overrides = {}) {
  return {
    type: 'response_item',
    timestamp: overrides.timestamp || '2026-01-01T00:00:01.000Z',
    payload: {
      type: 'message',
      role: overrides.role || 'user',
      content: overrides.content || [{ type: 'input_text', text: 'hello' }],
      ...overrides.payload
    },
    ...overrides
  };
}

function tokenCountEvent(timestamp, lastUsage) {
  return {
    type: 'event_msg',
    timestamp,
    payload: {
      type: 'token_count',
      info: {
        total_token_usage: { ...lastUsage },
        last_token_usage: { ...lastUsage },
        model_context_window: 258400
      },
      rate_limits: {}
    }
  };
}

function turnContext(timestamp, model) {
  return {
    type: 'turn_context',
    timestamp,
    payload: {
      turn_id: 'turn-1',
      model: model || 'codex',
      cwd: '/test'
    }
  };
}

function taskCompleteEvent(timestamp, durationMs) {
  return {
    type: 'event_msg',
    timestamp,
    payload: {
      type: 'task_complete',
      turn_id: 'turn-1',
      completed_at: new Date(timestamp).getTime(),
      duration_ms: durationMs || 1000,
      time_to_first_token_ms: 200
    }
  };
}

function buildJSONL(...records) {
  return records.map(r => JSON.stringify(r)).join('\n');
}

describe('codex parser', () => {

  // --- detect() ---
  describe('detect', () => {
    it('returns true for session_meta with codex-tui originator', () => {
      const lines = [JSON.stringify(metaRecord())];
      expect(parser.detect(lines)).toBe(true);
    });

    it('returns false for empty lines', () => {
      expect(parser.detect([])).toBe(false);
    });

    it('returns false for other originator', () => {
      const lines = [JSON.stringify(metaRecord({ originator: 'other' }))];
      expect(parser.detect(lines)).toBe(false);
    });

    it('returns false for malformed JSON', () => {
      expect(parser.detect(['not json'])).toBe(false);
    });

    it('returns false if first line is not session_meta', () => {
      const lines = [JSON.stringify({ type: 'response_item' })];
      expect(parser.detect(lines)).toBe(false);
    });
  });

  // --- parse() ---
  describe('parse', () => {
    it('parses a simple user→assistant exchange', () => {
      const meta = metaRecord();
      const u = responseItem({ role: 'user', content: [{ type: 'input_text', text: 'hello' }], timestamp: '2026-01-01T00:00:01.000Z' });
      const a = responseItem({ role: 'assistant', content: [{ type: 'input_text', text: 'hi there' }], timestamp: '2026-01-01T00:00:02.000Z' });
      const raw = buildJSONL(meta, u, a);

      const result = parser.parse(raw);
      expect(result.session.agentType).toBe('codex');
      expect(result.session.id).toBe('codex-sid-1');
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content[0].text).toBe('hello');
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[1].content[0].text).toBe('hi there');
    });

    it('maps developer role to system', () => {
      const meta = metaRecord();
      const dev = responseItem({ role: 'developer', timestamp: '2026-01-01T00:00:01.000Z' });
      const raw = buildJSONL(meta, dev);

      const result = parser.parse(raw);
      expect(result.messages[0].role).toBe('system');
    });

    it('falls back to user role when payload.role is missing', () => {
      const meta = metaRecord();
      const noRole = responseItem({ role: undefined, timestamp: '2026-01-01T00:00:01.000Z' });
      const raw = buildJSONL(meta, noRole);

      const result = parser.parse(raw);
      expect(result.messages[0].role).toBe('user');
    });

    it('sorts messages by timestamp chronologically', () => {
      const meta = metaRecord();
      const late = responseItem({ role: 'user', content: [{ type: 'input_text', text: 'second' }], timestamp: '2026-01-01T00:00:03.000Z' });
      const early = responseItem({ role: 'assistant', content: [{ type: 'input_text', text: 'first' }], timestamp: '2026-01-01T00:00:01.000Z' });
      const raw = buildJSONL(meta, late, early);

      const result = parser.parse(raw);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content[0].text).toBe('first');
      expect(result.messages[1].content[0].text).toBe('second');
    });

    it('chains parentId chronologically', () => {
      const meta = metaRecord();
      const u = responseItem({ role: 'user', timestamp: '2026-01-01T00:00:01.000Z' });
      const a = responseItem({ role: 'assistant', timestamp: '2026-01-01T00:00:02.000Z' });
      const u2 = responseItem({ role: 'user', timestamp: '2026-01-01T00:00:03.000Z' });
      const raw = buildJSONL(meta, u, a, u2);

      const result = parser.parse(raw);
      expect(result.messages[0].parentId).toBeNull();
      expect(result.messages[1].parentId).toBe(result.messages[0].id);
      expect(result.messages[2].parentId).toBe(result.messages[1].id);
    });

    it('maps input_text type to text', () => {
      const meta = metaRecord();
      const u = responseItem({ role: 'user', content: [{ type: 'input_text', text: 'hello' }] });
      const raw = buildJSONL(meta, u);

      const result = parser.parse(raw);
      expect(result.messages[0].content[0].type).toBe('text');
    });

    it('sets session title from first user message', () => {
      const meta = metaRecord();
      const u = responseItem({ role: 'user', content: [{ type: 'input_text', text: 'my question' }] });
      const raw = buildJSONL(meta, u);

      const result = parser.parse(raw);
      expect(result.session.title).toContain('my question');
    });

    it('skips user messages starting with < for title', () => {
      const meta = metaRecord();
      const u1 = responseItem({ role: 'user', content: [{ type: 'input_text', text: '<env> context' }], timestamp: '2026-01-01T00:00:01.000Z' });
      const u2 = responseItem({ role: 'user', content: [{ type: 'input_text', text: 'real question' }], timestamp: '2026-01-01T00:00:02.000Z' });
      const a = responseItem({ role: 'assistant', content: [{ type: 'input_text', text: 'answer' }], timestamp: '2026-01-01T00:00:03.000Z' });
      const raw = buildJSONL(meta, u1, u2, a);
      const result = parser.parse(raw);
      expect(result.session.title).toBe('real question');
    });

    it('falls back to sessionId for title when no user message', () => {
      const meta = metaRecord();
      const raw = JSON.stringify(meta);

      const result = parser.parse(raw);
      expect(result.session.title).toBe('codex-sid-1');
    });

    it('parses function_call into toolCalls on preceding assistant', () => {
      const meta = metaRecord();
      const a = responseItem({ role: 'assistant', content: [{ type: 'input_text', text: 'running' }], timestamp: '2026-01-01T00:00:01.000Z' });
      const fc = {
        type: 'response_item',
        timestamp: '2026-01-01T00:00:02.000Z',
        payload: { type: 'function_call', name: 'exec_command', call_id: 'call-1', arguments: '{"cmd": "ls -la"}' }
      };
      const raw = buildJSONL(meta, a, fc);
      const result = parser.parse(raw);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].toolCalls).toHaveLength(1);
      expect(result.messages[0].toolCalls[0].name).toBe('exec_command');
      expect(result.messages[0].toolCalls[0].input).toEqual({ cmd: 'ls -la' });
    });

    it('maps function_call_output to tool call result via call_id', () => {
      const meta = metaRecord();
      const a = responseItem({ role: 'assistant', content: [{ type: 'input_text', text: 'running' }], timestamp: '2026-01-01T00:00:01.000Z' });
      const output = {
        type: 'response_item',
        timestamp: '2026-01-01T00:00:01.500Z',
        payload: { type: 'function_call_output', call_id: 'call-1', output: 'file1.txt\nfile2.txt' }
      };
      const fc = {
        type: 'response_item',
        timestamp: '2026-01-01T00:00:02.000Z',
        payload: { type: 'function_call', name: 'exec_command', call_id: 'call-1', arguments: '{}' }
      };
      const raw = buildJSONL(meta, a, output, fc);
      const result = parser.parse(raw);
      expect(result.messages[0].toolCalls[0].result).toBe('file1.txt\nfile2.txt');
    });

    it('counts function_calls in tool stats', () => {
      const meta = metaRecord();
      const a = responseItem({ role: 'assistant', content: [{ type: 'input_text', text: 'running' }], timestamp: '2026-01-01T00:00:01.000Z' });
      const fc1 = { type: 'response_item', timestamp: '2026-01-01T00:00:02.000Z', payload: { type: 'function_call', name: 'exec_command', call_id: 'c1', arguments: '{}' } };
      const fc2 = { type: 'response_item', timestamp: '2026-01-01T00:00:03.000Z', payload: { type: 'function_call', name: 'write_stdin', call_id: 'c2', arguments: '{}' } };
      const raw = buildJSONL(meta, a, fc1, fc2);
      const result = parser.parse(raw);
      expect(result.messages[0].toolCalls).toHaveLength(2);
      expect(result.stats.toolCallCount).toBe(2);
      expect(result.stats.topUsedTools).toContainEqual({ name: 'exec_command', count: 1 });
      expect(result.stats.topUsedTools).toContainEqual({ name: 'write_stdin', count: 1 });
    });

    it('populates session metadata from meta record', () => {
      const meta = metaRecord({
        timestamp: '2026-01-01T00:30:00.000Z',
        model_provider: 'anthropic',
        cli_version: '1.0.0',
        cwd: '/my/project'
      });
      const u = responseItem({ role: 'user', timestamp: '2026-01-01T00:31:00.000Z' });
      const raw = buildJSONL(meta, u);

      const result = parser.parse(raw);
      expect(result.session.startTime).toBeTruthy();
      expect(result.session.model).toBe('anthropic');
      expect(result.session.cwd).toBe('/my/project');
    });

    it('handles empty input gracefully', () => {
      const result = parser.parse('');
      expect(result.session.id).toBe('unknown');
      expect(result.messages).toHaveLength(0);
    });

    it('skips malformed JSON lines', () => {
      const meta = metaRecord();
      const raw = JSON.stringify(meta) + '\nbad json\n' + JSON.stringify(responseItem({ role: 'user' }));

      const result = parser.parse(raw);
      expect(result.messages).toHaveLength(1);
    });

    it('counts user and assistant turns correctly', () => {
      const meta = metaRecord();
      const r1 = responseItem({ role: 'user', timestamp: 't1' });
      const r2 = responseItem({ role: 'assistant', timestamp: 't2' });
      const r3 = responseItem({ role: 'user', timestamp: 't3' });
      const r4 = responseItem({ role: 'assistant', timestamp: 't4' });
      const raw = buildJSONL(meta, r1, r2, r3, r4);

      const result = parser.parse(raw);
      expect(result.stats.totalTurns).toBe(2);
    });

    it('extracts token usage from token_count events', () => {
      const meta = metaRecord();
      const tc = turnContext('2026-01-01T00:00:00.500Z', 'gpt-4o');
      const u = responseItem({ role: 'user', timestamp: '2026-01-01T00:00:01.000Z' });
      const a = responseItem({ role: 'assistant', content: [{ type: 'input_text', text: 'hi' }], timestamp: '2026-01-01T00:00:02.000Z' });
      const tk = tokenCountEvent('2026-01-01T00:00:03.000Z', { input_tokens: 100, output_tokens: 20, cached_input_tokens: 10 });
      const raw = buildJSONL(meta, tc, u, a, tk);

      const result = parser.parse(raw);
      expect(result.messages).toHaveLength(2);
      const asst = result.messages[1];
      expect(asst.role).toBe('assistant');
      expect(asst.tokenUsage).toEqual({ input: 100, output: 20, cacheCreate: 0, cacheRead: 10 });
      expect(asst.model).toBe('gpt-4o');
    });

    it('updates stats with token totals from multiple turns', () => {
      const meta = metaRecord();
      const tc1 = turnContext('2026-01-01T00:00:00.500Z');
      const u1 = responseItem({ role: 'user', timestamp: 't1' });
      const a1 = responseItem({ role: 'assistant', timestamp: 't2' });
      const tk1 = tokenCountEvent('t3', { input_tokens: 100, output_tokens: 20, cached_input_tokens: 10 });
      const tc2 = turnContext('t4');
      const u2 = responseItem({ role: 'user', timestamp: 't5' });
      const a2 = responseItem({ role: 'assistant', timestamp: 't6' });
      const tk2 = tokenCountEvent('t7', { input_tokens: 200, output_tokens: 50, cached_input_tokens: 30 });
      const raw = buildJSONL(meta, tc1, u1, a1, tk1, tc2, u2, a2, tk2);

      const result = parser.parse(raw);
      expect(result.stats.totalInputTokens).toBe(300);
      expect(result.stats.totalOutputTokens).toBe(70);
      expect(result.stats.totalCacheReadTokens).toBe(40);
      expect(result.messages[1].tokenUsage.input).toBe(100);
      expect(result.messages[3].tokenUsage.input).toBe(200);
    });

    it('handles assistant messages without matching token_count', () => {
      const meta = metaRecord();
      const u = responseItem({ role: 'user', timestamp: '2026-01-01T00:00:01.000Z' });
      const a = responseItem({ role: 'assistant', content: [{ type: 'input_text', text: 'hi' }], timestamp: '2026-01-01T00:00:02.000Z' });
      const raw = buildJSONL(meta, u, a);

      const result = parser.parse(raw);
      expect(result.messages[1].tokenUsage).toBeUndefined();
      expect(result.stats.totalInputTokens).toBe(0);
    });

    it('extracts duration from task_complete events', () => {
      const meta = metaRecord();
      const u = responseItem({ role: 'user', timestamp: 't1' });
      const a = responseItem({ role: 'assistant', content: [{ type: 'input_text', text: 'hi' }], timestamp: 't2' });
      const tc = taskCompleteEvent('t3', 5678);
      const raw = buildJSONL(meta, u, a, tc);

      const result = parser.parse(raw);
      expect(result.messages[1].duration).toBe(5678);
      expect(result.stats.totalDuration).toBe(5678);
    });

    it('aggregates total duration across multiple turns', () => {
      const meta = metaRecord();
      const u1 = responseItem({ role: 'user', timestamp: 't1' });
      const a1 = responseItem({ role: 'assistant', timestamp: 't2' });
      const tc1 = taskCompleteEvent('t3', 1000);
      const tc2 = turnContext('t4');
      const u2 = responseItem({ role: 'user', timestamp: 't5' });
      const a2 = responseItem({ role: 'assistant', timestamp: 't6' });
      const tc3 = taskCompleteEvent('t7', 2000);
      const raw = buildJSONL(meta, tc2, u1, a1, tc1, u2, a2, tc3);

      const result = parser.parse(raw);
      expect(result.messages[1].duration).toBe(1000);
      expect(result.messages[3].duration).toBe(2000);
      expect(result.stats.totalDuration).toBe(3000);
    });
  });
});
