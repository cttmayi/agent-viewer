/**
 * Codex JSONL 解析器
 * Codex 格式包含 session_meta, response_item (含 user/developer/assistant 消息), turn_context 等
 *
 * 分组规则：以 token_count 事件为边界，每次 AI 调用(function_call + 可能的 text)独立成一个 assistant block。
 * 同一 token_count 段内的 function_call 归到该段的 assistant message 上。
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

function extractText(content) {
  if (!Array.isArray(content)) return '';
  return content.map(c => (c.type === 'text' && typeof c.text === 'string') ? c.text : '').join('\n');
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

  const allSorted = [...allRecords].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Build call_id → output map for function_call_output records
  const outputMap = {};
  for (const rec of allSorted) {
    if (rec.type === 'response_item' && rec.payload?.type === 'function_call_output') {
      outputMap[rec.payload.call_id] = rec.payload.output;
    }
  }

  // Track spawn_agent calls for sidechain linking
  const spawnRecords = [];

  const messages = [];
  let userCount = 0, msgCounter = 0;
  let assistantModel = modelProvider;
  let currentTurnId = '';

  // Current segment (one AI invocation, bounded by token_count events)
  let segment = { fcs: [], asstContent: null, timestamp: null };

  const durations = [];
  let completeIdx = 0;

  function flushSegment() {
    if (segment.fcs.length === 0 && !segment.asstContent) return;

    const toolCalls = segment.fcs.length > 0 ? segment.fcs.map(fc => ({
      name: fc.name,
      input: fc.input,
      result: outputMap[fc.callId] || null
    })) : undefined;

    const msg = {
      id: `codex-${msgCounter++}`,
      sessionId,
      role: 'assistant',
      content: segment.asstContent || [],
      timestamp: segment.timestamp || '',
      parentId: null,
      isSidechain: false,
      sidechainMessages: undefined,
      tokenUsage: segment.tokenUsage,
      model: assistantModel,
      duration: undefined,
      toolCalls,
      turnId: currentTurnId
    };

    // Link spawn_agent calls to this assistant message
    for (const fc of segment.fcs) {
      if (fc.name === 'spawn_agent') {
        const spawn = spawnRecords.find(s => s.callId === fc.callId);
        if (spawn && !spawn.msgId) {
          spawn.msgId = msg.id;
        }
      }
    }

    messages.push(msg);
    segment = { fcs: [], asstContent: null, timestamp: null };
  }

  for (const rec of allSorted) {
    const t = rec.type;
    const ts = rec.timestamp;

    if (t === 'turn_context') {
      const tid = rec.payload?.turn_id;
      if (tid && tid !== currentTurnId) {
        flushSegment();
        currentTurnId = tid;
      }
      if (rec.payload?.model) {
        assistantModel = rec.payload.model;
      }

    } else if (t === 'response_item') {
      const pt = rec.payload?.type;

      if (pt === 'message') {
        const role = rec.payload?.role || 'user';
        const mappedRole = role === 'developer' ? 'system' : role;

        if (mappedRole === 'user' || mappedRole === 'system') {
          flushSegment();
          messages.push({
            id: `codex-${msgCounter++}`,
            sessionId,
            role: mappedRole,
            content: rec.payload.content?.map(c => ({
              type: (c.type === 'input_text' || c.type === 'output_text') ? 'text' : c.type,
              text: c.text ?? ''
            })) || [],
            timestamp: ts,
            parentId: null,
            isSidechain: false,
            sidechainMessages: undefined,
            tokenUsage: undefined,
            model: '',
            duration: undefined,
            toolCalls: undefined,
            turnId: currentTurnId
          });
          userCount++;
        } else if (mappedRole === 'assistant') {
          // Assistant text belongs to the current segment
          segment.asstContent = rec.payload.content?.map(c => ({
            type: (c.type === 'output_text') ? 'text' : c.type,
            text: c.text ?? ''
          })) || [];
          segment.timestamp = ts;
        }

      } else if (pt === 'function_call') {
        const name = rec.payload.name;
        let input = {};
        try { input = JSON.parse(rec.payload.arguments); } catch {}

        segment.fcs.push({ name, input, callId: rec.payload.call_id });
        if (!segment.timestamp) segment.timestamp = ts;

        if (name === 'spawn_agent') {
          let taskName = '';
          try { taskName = JSON.parse(rec.payload.arguments).task_name || ''; } catch {}
          spawnRecords.push({
            callId: rec.payload.call_id,
            taskName,
            msgId: ''
          });
        }
      }
      // function_call_output is handled by outputMap above

    } else if (t === 'event_msg') {
      const etype = rec.payload?.type;

      if (etype === 'token_count') {
        const lastUsage = rec.payload.info?.last_token_usage;
        if (lastUsage) {
          // Attach token usage to the current segment before flushing
          segment.tokenUsage = {
            input: lastUsage.input_tokens || 0,
            output: lastUsage.output_tokens || 0,
            cacheCreate: 0,
            cacheRead: lastUsage.cached_input_tokens || 0,
          };
        }
        flushSegment();

      } else if (etype === 'sub_agent_activity') {
        const spawn = spawnRecords.find(s => s.callId === rec.payload.event_id);
        if (spawn) {
          spawn.agentThreadId = rec.payload.agent_thread_id;
          spawn.kind = rec.payload.kind;
        }

      } else if (etype === 'task_complete') {
        durations[completeIdx++] = rec.payload.duration_ms || 0;
      }
    }
  }

  // Flush any remaining segment at end of data
  flushSegment();

  // Apply durations to assistant messages (sequential matching)
  let durIdx = 0;
  for (const msg of messages) {
    if (msg.role === 'assistant' && durations[durIdx]) {
      msg.duration = durations[durIdx];
      durIdx++;
    }
  }

  // Link parentId chain
  for (let i = 1; i < messages.length; i++) {
    messages[i].parentId = messages[i - 1].id;
  }

  // Stats
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

  // Build subagent references for cross-file linking
  const subagentRefs = spawnRecords
    .filter(s => s.agentThreadId)
    .map(s => ({ agentThreadId: s.agentThreadId, taskName: s.taskName, msgId: s.msgId }));

  const stats = {
    totalTurns: 0, // recalculated based on user count
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalCacheCreateTokens: totalCacheCreate,
    totalCacheReadTokens: totalCacheRead,
    totalDuration,
    modelUsage: Object.keys(modelUsage).length > 0 ? modelUsage : (modelProvider ? { [modelProvider]: messages.filter(m => m.role === 'assistant').length } : {}),
    toolCallCount,
    topUsedTools
  };
  // Count turns: each user msg followed by at least one assistant msg
  let turns = 0;
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role === 'user' && messages[i + 1].role === 'assistant') turns++;
  }
  stats.totalTurns = turns || Math.min(userCount, messages.filter(m => m.role === 'assistant').length);

  const session = {
    id: sessionId,
    agentType: 'codex',
    title: (() => {
      function getText(m) {
        const c = m.content;
        if (Array.isArray(c)) return c.map(x => x.text).filter(Boolean).join('');
        return typeof c === 'string' ? c : '';
      }
      const firstAsst = messages.findIndex(m => m.role === 'assistant' && getText(m));
      if (firstAsst > 0) {
        for (let i = firstAsst - 1; i >= 0; i--) {
          const text = getText(messages[i]);
          if (text && !text.startsWith('<')) return text.slice(0, 60);
        }
      }
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') continue;
        const text = getText(messages[i]);
        if (text && !text.startsWith('<')) return text.slice(0, 60);
      }
      for (let i = messages.length - 1; i >= 0; i--) {
        const text = getText(messages[i]);
        if (text) return text.slice(0, 60);
      }
      return sessionId;
    })(),
    startTime,
    endTime: messages[messages.length - 1]?.timestamp || '',
    messageCount: messages.length,
    totalTokens: totalInput + totalOutput,
    model: modelProvider,
    cwd,
    gitBranch: '',
    filePath: ''
  };

  return { session, messages, stats, subagentRefs: subagentRefs.length > 0 ? subagentRefs : undefined };
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
