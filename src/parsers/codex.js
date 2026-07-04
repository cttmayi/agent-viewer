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
  let assistantModel = modelProvider;

  // Process all record types chronologically to track model and token usage per turn
  const allSorted = [...allRecords].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  // Store per-assistant-message data collected from event records
  const tokenUsageForAssistant = [];
  const durationForAssistant = [];
  // Build message list first (existing logic)
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
        model: '',
        duration: undefined,
        toolCalls: undefined
      };

      messages.push(msg);
      if (mappedRole === 'user') userCount++;
      if (mappedRole === 'assistant') {
        assistantCount++;
        lastAssistantIdx = messages.length - 1;
      }
    } else if (payload.type === 'function_call') {
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

  // Second pass: chronological order to match model, token counts and duration to assistant messages
  let asstIdx = 0, completeIdx = 0;
  for (const rec of allSorted) {
    if (rec.type === 'turn_context' && rec.payload?.model) {
      assistantModel = rec.payload.model;
    } else if (rec.type === 'event_msg' && rec.payload?.type === 'token_count') {
      const lastUsage = rec.payload.info?.last_token_usage;
      if (lastUsage && asstIdx < assistantCount) {
        tokenUsageForAssistant[asstIdx] = {
          input: lastUsage.input_tokens || 0,
          output: lastUsage.output_tokens || 0,
          cacheCreate: 0,
          cacheRead: lastUsage.cached_input_tokens || 0,
        };
        asstIdx++;
      }
    } else if (rec.type === 'event_msg' && rec.payload?.type === 'task_complete') {
      if (completeIdx < assistantCount) {
        durationForAssistant[completeIdx] = rec.payload.duration_ms || 0;
        completeIdx++;
      }
    }
  }

  // Apply token usage, duration and model to assistant messages
  asstIdx = 0;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'assistant') {
      if (tokenUsageForAssistant[asstIdx]) {
        messages[i].tokenUsage = tokenUsageForAssistant[asstIdx];
      }
      if (durationForAssistant[asstIdx]) {
        messages[i].duration = durationForAssistant[asstIdx];
      }
      if (!messages[i].model) {
        messages[i].model = assistantModel;
      }
      asstIdx++;
    }
  }

  for (let i = 1; i < messages.length; i++) {
    messages[i].parentId = messages[i - 1].id;
  }

  let totalInput = 0, totalOutput = 0, totalCacheCreate = 0, totalCacheRead = 0, totalDuration = 0;
  const modelUsage = {};
  for (const msg of messages) {
    if (msg.tokenUsage) {
      totalInput += msg.tokenUsage.input || 0;
      totalOutput += msg.tokenUsage.output || 0;
      totalCacheCreate += msg.tokenUsage.cacheCreate || 0;
      totalCacheRead += msg.tokenUsage.cacheRead || 0;
    }
    if (msg.duration) {
      totalDuration += msg.duration;
    }
    if (msg.model) {
      modelUsage[msg.model] = (modelUsage[msg.model] || 0) + 1;
    }
  }

  const toolCallCount = messages.reduce((sum, m) => sum + (m.toolCalls?.length || 0), 0);
  const topUsedTools = getTopTools(messages);

  const stats = {
    totalTurns: Math.min(userCount, assistantCount),
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalCacheCreateTokens: totalCacheCreate,
    totalCacheReadTokens: totalCacheRead,
    totalDuration,
    modelUsage: Object.keys(modelUsage).length > 0 ? modelUsage : (modelProvider ? { [modelProvider]: assistantCount } : {}),
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
