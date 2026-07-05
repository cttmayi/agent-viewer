import React, { useRef, useEffect, useMemo } from 'react';
import UserMessage from './UserMessage.jsx';
import AssistantMessage from './AssistantMessage.jsx';
import SystemMessage from './SystemMessage.jsx';

function hasToolResult(msg) {
  if (msg.toolCalls?.some(tc => tc.type === 'tool_result')) return true;
  if (!msg.content) return false;
  const blocks = Array.isArray(msg.content) ? msg.content : [];
  return blocks.some(c => c.type === 'tool_result');
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

function renderMessage(msg, i, highlightSet, highlightQuery) {
  const key = msg.id || `msg-${i}`;
  const isHighlighted = highlightSet?.has(msg.id);
  switch (msg.role) {
    case 'assistant':
      return <AssistantMessage key={key} message={msg} isHighlighted={isHighlighted} highlightQuery={highlightQuery} />;
    case 'user':
    case 'attachment':
      return <UserMessage key={key} message={msg} isHighlighted={isHighlighted} highlightQuery={highlightQuery} />;
    case 'system':
      return <SystemMessage key={key} message={msg} isHighlighted={isHighlighted} highlightQuery={highlightQuery} />;
    default:
      return <SystemMessage key={key} message={msg} isHighlighted={isHighlighted} highlightQuery={highlightQuery} />;
  }
}

export default function MessageList({ messages, searchMessageIds, searchQuery }) {
  const containerRef = useRef(null);
  // stable key: first match ID + message count triggers re-scroll on data load or re-click
  const scrollKey = searchMessageIds?.length ? `${searchMessageIds[0]}-${messages?.length || 0}` : null;

  useEffect(() => {
    if (!scrollKey) return;
    const timer = setTimeout(() => {
      const firstId = searchMessageIds[0];
      const el = containerRef.current?.querySelector(`[data-msg-id="${firstId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [scrollKey]);

  const highlightSet = useMemo(() => {
    if (!searchMessageIds?.length) return null;
    return new Set(searchMessageIds);
  }, [searchMessageIds]);

  if (!messages || messages.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        无消息
      </div>
    );
  }

  const merged = mergeToolMessages(messages);

  return (
    <div ref={containerRef} style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
      {merged.map((msg, i) => renderMessage(msg, i, highlightSet, searchQuery))}
    </div>
  );
}
