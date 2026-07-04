import * as claudeCodeParser from './claude-code.js';

let codexParser = null;
try {
  codexParser = await import('./codex.js');
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') {
    console.warn('codex parser load failed:', e.message);
  }
}

function getParsers() {
  const p = [claudeCodeParser];
  if (codexParser) p.push(codexParser);
  return p;
}

export function detectParser(rawLines) {
  for (const parser of getParsers()) {
    if (parser.detect(rawLines)) return parser;
  }
  return null;
}

export function parseFile(rawText, filePath) {
  const lines = rawText.trim().split('\n').filter(Boolean);
  const parser = detectParser(lines);
  if (!parser) throw new Error(`无法识别文件格式: ${filePath}`);
  const result = parser.parse(rawText);
  if (result.session) result.session.filePath = filePath;
  return result;
}
