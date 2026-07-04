import React from 'react';
import UserMessage from './UserMessage.jsx';
import AssistantMessage from './AssistantMessage.jsx';
import SystemMessage from './SystemMessage.jsx';

function hasToolResult(msg) {
  return msg.toolCalls?.some(tc => tc.type === 'tool_result');
}

function hasTextContent(msg) {
  if (!msg.content) return false;
  const arr = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: String(msg.content) }];
  return arr.some(c => (c.type === 'text' || c.type === undefined) && c.text);
}

/**
 * Merge tool_result user messages into preceding assistant messages,
 * and skip pure tool_result user messages (no user text).
 */
function mergeToolMessages(messages) {
  const result = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const next = messages[i + 1];

    // assistant with tool calls followed by a tool_result user message (no text) → pair them
    if (msg.role === 'assistant' && msg.toolCalls?.length > 0 && next && next.role === 'user' && hasToolResult(next) && !hasTextContent(next)) {
      const toolUses = msg.toolCalls.filter(tc => tc.type === 'tool_use');
      // extract result content directly from the next message's content blocks (not from toolCalls, which may lack 'output')
      const toolResults = (Array.isArray(next.content) ? next.content : [])
        .filter(c => c.type === 'tool_result')
        .map(c => c.content);
      const paired = toolUses.map((tc, idx) => ({ ...tc, result: toolResults[idx] || null }));
      result.push({ ...msg, toolCalls: paired });
      i++; // skip the tool_result message
      continue;
    }

    // skip standalone tool_result user messages (no text)
    if (msg.role === 'user' && hasToolResult(msg) && !hasTextContent(msg)) continue;

    result.push(msg);
  }
  return result;
}

function renderMessage(msg, i) {
  const key = msg.id || `msg-${i}`;
  switch (msg.role) {
    case 'assistant':
      return <AssistantMessage key={key} message={msg} />;
    case 'user':
    case 'attachment':
      return <UserMessage key={key} message={msg} />;
    case 'system':
      return <SystemMessage key={key} message={msg} />;
    default:
      return <SystemMessage key={key} message={msg} />;
  }
}

export default function MessageList({ messages }) {
  if (!messages || messages.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        无消息
      </div>
    );
  }

  const merged = mergeToolMessages(messages);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
      {merged.map((msg, i) => renderMessage(msg, i))}
    </div>
  );
}
