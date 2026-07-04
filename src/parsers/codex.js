/**
 * Codex JSONL 解析器
 * Codex 格式包含 session_meta, response_item (含 user/developer/assistant 消息), turn_context 等
 */

export function detect(rawLines) {
  if (rawLines.length === 0) return false;
  try {
    const first = JSON.parse(rawLines[0]);
    return first.type === 'session_meta' && first.payload?.originator === 'codex-tui';
  } catch {
    return false;
  }
}

export function parse(rawText) {
  const lines = rawText.trim().split('\n').filter(Boolean);
  const allRecords = [];
  for (const line of lines) {
    try {
      allRecords.push(JSON.parse(line));
    } catch {
      // skip malformed lines
    }
  }

  const metaRecord = allRecords.find(r => r.type === 'session_meta')?.payload || {};
  const sessionId = metaRecord.id || 'unknown';
  const startTime = metaRecord.timestamp || '';
  const modelProvider = metaRecord.model_provider || '';
  const cliVersion = metaRecord.cli_version || '';
  const cwd = metaRecord.cwd || '';

  const responseItems = allRecords.filter(r => r.type === 'response_item');
  const messages = [];
  let userCount = 0, assistantCount = 0, msgCounter = 0;

  for (const item of responseItems) {
    const payload = item.payload;
    if (payload.type !== 'message') continue;

    const role = payload.role || 'user';
    const mappedRole = role === 'developer' ? 'system' : role;

    const msg = {
      id: `codex-${msgCounter++}`,
      sessionId,
      role: mappedRole,
      content: payload.content?.map(c => ({
        type: c.type === 'input_text' ? 'text' : c.type,
        text: c.text ?? ''
      })) || [],
      timestamp: item.timestamp,
      parentId: null,
      isSidechain: false,
      sidechainMessages: undefined,
      tokenUsage: undefined,
      toolCalls: undefined
    };

    if (mappedRole === 'user') userCount++;
    if (mappedRole === 'assistant') assistantCount++;

    messages.push(msg);
  }

  messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  for (let i = 1; i < messages.length; i++) {
    messages[i].parentId = messages[i - 1].id;
  }

  const stats = {
    totalTurns: Math.min(userCount, assistantCount),
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheCreateTokens: 0,
    totalCacheReadTokens: 0,
    totalDuration: 0,
    modelUsage: modelProvider ? { [modelProvider]: assistantCount } : {},
    toolCallCount: 0,
    topUsedTools: []
  };

  const session = {
    id: sessionId,
    agentType: 'codex',
    title: messages.find(m => m.role === 'user')?.content?.[0]?.text?.slice(0, 60) || sessionId,
    startTime,
    endTime: messages[messages.length - 1]?.timestamp || '',
    messageCount: messages.length,
    totalTokens: 0,
    model: modelProvider,
    cwd,
    gitBranch: '',
    filePath: ''
  };

  return { session, messages, stats };
}
