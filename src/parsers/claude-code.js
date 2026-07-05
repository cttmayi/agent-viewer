/**
 * Claude Code JSONL 解析器
 * 输入: JSONL 文本，逐行解析
 * 输出: { session, messages: Message[], stats: SessionStats }
 */

export function detect(rawLines) {
  if (rawLines.length === 0) return false;
  try {
    const first = JSON.parse(rawLines[0]);
    return first.sessionId !== undefined;
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
      // 跳过损坏的行
    }
  }

  const sessionRecord = allRecords.find(r => r.sessionId) || {};
  const sessionId = sessionRecord.sessionId || 'unknown';

  const userMessages = allRecords.filter(r => r.type === 'user');
  const assistantMessages = allRecords.filter(r => r.type === 'assistant');
  const systemMessages = allRecords.filter(r => r.type === 'system');
  const attachmentRecords = allRecords.filter(r => r.type === 'attachment');

  // 构建消息树
  const messageMap = new Map();
  const rootMessages = [];
  const allMessageRecords = [...userMessages, ...assistantMessages, ...attachmentRecords];
  let msgCounter = 0;

  for (const rec of allMessageRecords) {
    const msgId = rec.uuid || rec.message?.id || rec.promptId || `msg-${++msgCounter}`;
    const msg = {
      id: msgId,
      sessionId,
      role: rec.type === 'attachment' ? 'user' : rec.type,
      content: normalizeContent(rec),
      timestamp: rec.timestamp,
      parentId: rec.parentUuid || null,
      isSidechain: rec.isSidechain || false,
      children: [],
      tokenUsage: rec.message?.usage ? {
        input: rec.message.usage.input_tokens || 0,
        output: rec.message.usage.output_tokens || 0,
        cacheCreate: rec.message.usage.cache_creation?.ephemeral_1h_input_tokens,
        cacheRead: rec.message.usage.cache_read_input_tokens
      } : undefined,
      toolCalls: extractToolCalls(rec),
      model: rec.message?.model || ''
    };
    messageMap.set(msg.id, msg);
  }

  for (const msg of messageMap.values()) {
    if (msg.parentId && messageMap.has(msg.parentId)) {
      messageMap.get(msg.parentId).children.push(msg);
    } else {
      rootMessages.push(msg);
    }
  }

  function sortByTimestamp(list) {
    list.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    for (const msg of list) {
      if (msg.children.length > 0) sortByTimestamp(msg.children);
    }
  }
  sortByTimestamp(rootMessages);

  // 分离侧链
  function extractSidechains(list) {
    for (const msg of list) {
      const sidechainChildren = msg.children.filter(c => c.isSidechain);
      if (sidechainChildren.length > 0) {
        msg.sidechainMessages = [];
        for (const sc of sidechainChildren) {
          function collect(m) {
            msg.sidechainMessages.push(m);
            if (m.children) m.children.forEach(collect);
          }
          collect(sc);
        }
        msg.sidechainMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        for (const scMsg of msg.sidechainMessages) {
          delete scMsg.children;
        }
      }
      msg.children = msg.children.filter(c => !c.isSidechain);
      if (msg.children.length > 0) extractSidechains(msg.children);
    }
  }
  extractSidechains(rootMessages);

  // 平铺主线对话
  const flatMessages = [];
  function flatten(list) {
    for (const msg of list) {
      flatMessages.push(msg);
      if (msg.children.length > 0) flatten(msg.children);
      delete msg.children;
    }
  }
  flatten(rootMessages);

  // 合并连续 assistant（Claude Code 将一次回复拆为 thinking/text/tool_use 多条记录）
  function mergeConsecutiveAssistants(messages) {
    const result = [];
    for (const msg of messages) {
      const prev = result[result.length - 1];
      if (prev && prev.role === 'assistant' && msg.role === 'assistant') {
        prev.content = [...(prev.content || []), ...(msg.content || [])];
        if (msg.toolCalls) {
          prev.toolCalls = [...(prev.toolCalls || []), ...msg.toolCalls];
        }
        if (msg.tokenUsage) {
          if (!prev.tokenUsage) prev.tokenUsage = { input: 0, output: 0 };
          prev.tokenUsage.input += msg.tokenUsage.input || 0;
          prev.tokenUsage.output += msg.tokenUsage.output || 0;
        }
        if (!prev.model && msg.model) prev.model = msg.model;
        continue;
      }
      result.push(msg);
    }
    return result;
  }
  const mergedMessages = mergeConsecutiveAssistants(flatMessages);

  const stats = computeStats(mergedMessages, allRecords, systemMessages);

  const rawFirstUser = userMessages[0];
  const lastAssistant = assistantMessages[assistantMessages.length - 1];
  const aiModel = assistantMessages.find(m => m.message?.model)?.message?.model || rawFirstUser?.version || '';

  // Extract text from a message's content (handles both array and string)
  function getMsgText(msg) {
    const c = msg.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map(x => x.text).filter(Boolean).join('');
    return '';
  }

  // Title: find first assistant message, then take the last user message BEFORE it
  let title = sessionId;
  const firstAsstIdx = mergedMessages.findIndex(m => m.role === 'assistant');
  if (firstAsstIdx >= 0) {
    for (let i = firstAsstIdx - 1; i >= 0; i--) {
      const text = getMsgText(mergedMessages[i]);
      if (text && !text.startsWith('<')) {
        title = text.slice(0, 60);
        break;
      }
    }
  }
  // fallback: no valid user before first assistant → walk backwards from end
  if (title === sessionId) {
    for (let i = mergedMessages.length - 1; i >= 0; i--) {
      if (mergedMessages[i].role === 'assistant' || (mergedMessages[i].toolCalls && mergedMessages[i].toolCalls.length > 0)) continue;
      const text = getMsgText(mergedMessages[i]);
      if (text && !text.startsWith('<')) { title = text.slice(0, 60); break; }
    }
  }
  // final fallback: last assistant text
  if (title === sessionId) {
    for (let i = mergedMessages.length - 1; i >= 0; i--) {
      if (mergedMessages[i].role === 'assistant') {
        const text = getMsgText(mergedMessages[i]);
        if (text) { title = text.slice(0, 60); break; }
      }
    }
  }

  const session = {
    id: sessionId,
    agentType: 'claude-code',
    title,
    startTime: rawFirstUser?.timestamp || '',
    endTime: lastAssistant?.timestamp || '',
    messageCount: mergedMessages.length,
    totalTokens: stats.totalOutputTokens + stats.totalInputTokens,
    model: aiModel,
    cwd: rawFirstUser?.cwd || '',
    gitBranch: rawFirstUser?.gitBranch || '',
    filePath: ''
  };

  return { session, messages: mergedMessages, stats };
}

/**
 * Normalize content field from a JSONL record.
 * Handles attachment records where attachment.content may be an array or object.
 */
function normalizeContent(rec) {
  const msgContent = rec.message?.content;
  if (msgContent) return msgContent;

  // Fallback: attachment records may have content as string, array, or object
  const attachmentContent = rec.attachment?.content;
  if (attachmentContent == null) return [{ type: 'text', text: '' }];
  if (typeof attachmentContent === 'string') return [{ type: 'text', text: attachmentContent }];

  const text = Array.isArray(attachmentContent)
    ? attachmentContent.map(item => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n')
    : JSON.stringify(attachmentContent);
  return [{ type: 'text', text }];
}

function extractToolCalls(rec) {
  const content = rec.message?.content;
  if (!Array.isArray(content)) return undefined;
  const toolUses = content.filter(b => b.type === 'tool_use');
  if (toolUses.length === 0) return undefined;
  // Build tool_use_id → result content map
  const resultMap = {};
  for (const block of content) {
    if (block.type === 'tool_result') {
      resultMap[block.tool_use_id] = block.content;
    }
  }
  return toolUses.map(tc => ({
    name: tc.name,
    type: 'tool_use',
    input: tc.input,
    result: resultMap[tc.id] || undefined,
  }));
}

function extractTitle(userMsg) {
  const content = userMsg.message?.content;
  if (typeof content === 'string') return content.slice(0, 60);
  if (Array.isArray(content) && content[0]?.text) return content[0].text.slice(0, 60);
  return 'Untitled';
}

function computeStats(flatMessages, allRecords, systemRecords) {
  let totalInput = 0, totalOutput = 0, totalCacheCreate = 0, totalCacheRead = 0;
  let totalDuration = 0, toolCallCount = 0;
  const modelUsage = {};
  const toolCount = {};

  for (const msg of flatMessages) {
    if (msg.tokenUsage) {
      totalInput += msg.tokenUsage.input || 0;
      totalOutput += msg.tokenUsage.output || 0;
      totalCacheCreate += msg.tokenUsage.cacheCreate || 0;
      totalCacheRead += msg.tokenUsage.cacheRead || 0;
    }
    if (msg.toolCalls) {
      toolCallCount += msg.toolCalls.length;
      for (const tc of msg.toolCalls) {
        toolCount[tc.name] = (toolCount[tc.name] || 0) + 1;
      }
    }
    // Include sidechain/subagent messages in token stats
    for (const sc of msg.sidechainMessages || []) {
      if (sc.tokenUsage) {
        totalInput += sc.tokenUsage.input || 0;
        totalOutput += sc.tokenUsage.output || 0;
        totalCacheCreate += sc.tokenUsage.cacheCreate || 0;
        totalCacheRead += sc.tokenUsage.cacheRead || 0;
      }
    }
  }

  for (const rec of systemRecords) {
    if (rec.subtype === 'turn_duration' && rec.durationMs) {
      totalDuration += rec.durationMs;
    }
  }

  for (const rec of allRecords) {
    const model = rec.message?.model;
    if (model) modelUsage[model] = (modelUsage[model] || 0) + 1;
  }

  const topTools = Object.entries(toolCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return {
    totalTurns: Math.ceil(flatMessages.length / 2),
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalCacheCreateTokens: totalCacheCreate,
    totalCacheReadTokens: totalCacheRead,
    totalDuration,
    modelUsage,
    toolCallCount,
    topUsedTools: topTools
  };
}
