import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectParser, parseFile } from '../../src/parsers/registry.js';

// Mock the parsers
vi.mock('../../src/parsers/claude-code.js', () => {
  const mockDetect = vi.fn();
  const mockParse = vi.fn(() => ({
    session: { id: 'cc', agentType: 'claude-code', filePath: '' },
    messages: [],
    stats: {}
  }));
  return {
    detect: mockDetect,
    parse: mockParse
  };
});

vi.mock('../../src/parsers/codex.js', () => {
  const mockDetect = vi.fn();
  const mockParse = vi.fn(() => ({
    session: { id: 'cx', agentType: 'codex', filePath: '' },
    messages: [],
    stats: {}
  }));
  return {
    detect: mockDetect,
    parse: mockParse
  };
});

import * as ccParser from '../../src/parsers/claude-code.js';
import * as codexParser from '../../src/parsers/codex.js';

describe('parser registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectParser', () => {
    it('returns claude-code parser when it matches first', () => {
      ccParser.detect.mockReturnValue(true);
      codexParser.detect.mockReturnValue(false);

      const result = detectParser(['some line']);
      expect(result).toBe(ccParser);
    });

    it('returns codex parser when claude-code does not match', () => {
      ccParser.detect.mockReturnValue(false);
      codexParser.detect.mockReturnValue(true);

      const result = detectParser(['some line']);
      expect(result).toBe(codexParser);
    });

    it('returns null when no parser matches', () => {
      ccParser.detect.mockReturnValue(false);
      codexParser.detect.mockReturnValue(false);

      const result = detectParser(['some line']);
      expect(result).toBeNull();
    });

    it('returns claude-code parser over codex when both match (priority order)', () => {
      ccParser.detect.mockReturnValue(true);
      codexParser.detect.mockReturnValue(true);

      const result = detectParser(['some line']);
      expect(result).toBe(ccParser);
    });
  });

  describe('parseFile', () => {
    it('delegates to claude-code parser and sets filePath', () => {
      ccParser.detect.mockReturnValue(true);
      codexParser.detect.mockReturnValue(false);

      const result = parseFile('{"sessionId":"abc"}', '/path/to/file.jsonl');
      expect(result.session.filePath).toBe('/path/to/file.jsonl');
      expect(result.session.agentType).toBe('claude-code');
    });

    it('delegates to codex parser and sets filePath', () => {
      ccParser.detect.mockReturnValue(false);
      codexParser.detect.mockReturnValue(true);

      const result = parseFile('{"type":"session_meta","payload":{"originator":"codex-tui"}}', '/path/to/codex.jsonl');
      expect(result.session.filePath).toBe('/path/to/codex.jsonl');
      expect(result.session.agentType).toBe('codex');
    });

    it('throws error when no parser matches', () => {
      ccParser.detect.mockReturnValue(false);
      codexParser.detect.mockReturnValue(false);

      expect(() => parseFile('some data', '/path/to/unknown.jsonl')).toThrow('无法识别文件格式');
    });

    it('handles empty lines by filtering them before detection', () => {
      ccParser.detect.mockReturnValue(true);
      // The function filters empty lines, so this should be fine
      const result = parseFile('\n\n{"sessionId":"abc"}\n\n', '/path/to/file.jsonl');
      expect(result.session.agentType).toBe('claude-code');
    });
  });
});
