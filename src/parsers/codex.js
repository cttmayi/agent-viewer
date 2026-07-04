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

  // Sort all response_items by timestamp
  const responseItems = allRecords
    .filter(r => r.type === 'response_item')
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Build call_id → output map for function_call_output records
  const outputMap = {};
  for (const item of responseItems) {
    if (item.payload.type === 'function_call_output') {
      outputMap[item.payload.call_id] = item.payload.output;
    }
  }

  // Collect function_calls by the assistant message index they belong to
  const messages = [];
  let userCount = 0, assistantCount = 0, msgCounter = 0;
  let lastAssistantIdx = -1;

  for (const item of responseItems) {
    const payload = item.payload;

    if (payload.type === 'message') {
      const role = payload.role || 'user';
      const mappedRole = role === 'developer' ? 'system' : role;

      const msg = {
        id: `codex-${msgCounter++}`,
        sessionId,
        role: mappedRole,
        content: payload.content?.map(c => ({
          type: (c.type === 'input_text' || c.type === 'output_text') ? 'text' : c.type,
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
      if (mappedRole === 'assistant') {
        assistantCount++;
        lastAssistantIdx = messages.length;
      }

      messages.push(msg);
    } else if (payload.type === 'function_call') {
      // Associate with the preceding assistant message
      if (lastAssistantIdx >= 0) {
        const target = messages[lastAssistantIdx];
        if (!target.toolCalls) target.toolCalls = [];
        let input = {};
        try { input = JSON.parse(payload.arguments); } catch {}
        target.toolCalls.push({
          name: payload.name,
          input,
          result: outputMap[payload.call_id] || null
        });
      }
    }
  }

  for (let i = 1; i < messages.length; i++) {
    messages[i].parentId = messages[i - 1].id;
  }

  const toolCallCount = messages.reduce((sum, m) => sum + (m.toolCalls?.length || 0), 0);
  const topUsedTools = getTopTools(messages);

  const stats = {
    totalTurns: Math.min(userCount, assistantCount),
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheCreateTokens: 0,
    totalCacheReadTokens: 0,
    totalDuration: 0,
    modelUsage: modelProvider ? { [modelProvider]: assistantCount } : {},
    toolCallCount,
    topUsedTools
  };

  const session = {
    id: sessionId,
    agentType: 'codex',
    // title: find first assistant message, then take the last user message BEFORE it
    title: (() => {
      function getText(m) {
        const c = m.content;
        if (Array.isArray(c)) return c.map(x => x.text).filter(Boolean).join('');
        return typeof c === 'string' ? c : '';
      }
      const firstAsst = messages.findIndex(m => m.role === 'assistant');
      if (firstAsst >= 0) {
        for (let i = firstAsst - 1; i >= 0; i--) {
          const text = getText(messages[i]);
          if (text && !text.startsWith('<')) return text.slice(0, 60);
        }
      }
      // fallback: walk backwards from end
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') continue;
        const text = getText(messages[i]);
        if (text && !text.startsWith('<')) return text.slice(0, 60);
      }
      // final fallback: last assistant text
      for (let i = messages.length - 1; i >= 0; i--) {
        const text = getText(messages[i]);
        if (text) return text.slice(0, 60);
      }
      return sessionId;
    })(),
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

function getTopTools(messages) {
  const counts = {};
  for (const m of messages) {
    for (const tc of m.toolCalls || []) {
      counts[tc.name] = (counts[tc.name] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));
}
