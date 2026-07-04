import React, { useState, useRef, useLayoutEffect } from 'react';
import ThinkingBlock from './ThinkingBlock.jsx';
import ToolCallBlock from './ToolCallBlock.jsx';
import { useSettingsContext } from '../hooks/SettingsContext.jsx';

function formatTokenBreakdown(msg) {
  const parts = [];
  if (msg.tokenUsage?.input) parts.push(`↑${msg.tokenUsage.input}`);
  if (msg.tokenUsage?.output) parts.push(`↓${msg.tokenUsage.output}`);
  if (msg.tokenUsage?.cacheRead) parts.push(`⊙${msg.tokenUsage.cacheRead}`);
  if (msg.tokenUsage?.cacheCreate) parts.push(`◎${msg.tokenUsage.cacheCreate}`);
  return parts.join(' ');
}

function formatMsgCost(cost) {
  if (!cost || cost.total <= 0) return '';
  const symbol = cost.currency === 'CNY' ? '¥' : '$';
  if (cost.total < 0.0001) return '<' + symbol + '0.0001';
  return symbol + cost.total.toFixed(4);
}

export default function AssistantMessage({ message }) {
  const { settings } = useSettingsContext();
  const maxLines = settings?.messageMaxLines || 0;
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef(null);

  const content = Array.isArray(message.content) ? message.content
    : [{ type: 'text', text: String(message.content ?? '') }];
  const textParts = content.filter(c => c.type === 'text' || c.type === undefined);
  let text = textParts.map(c => (typeof c.text === 'string' ? c.text : JSON.stringify(c.text))).filter(Boolean).join('\n') || '';
  const thinkingText = content.filter(c => c.type === 'thinking').map(c => {
    const t = c.thinking || c.text;
    return typeof t === 'string' ? t : JSON.stringify(t);
  }).join('\n');
  const time = message.timestamp ? new Date(message.timestamp).toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  const duration = message.duration ? `${(message.duration / 1000).toFixed(1)}s` : '';
  const tokenBreakdown = formatTokenBreakdown(message);
  const msgCost = formatMsgCost(message.cost);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (el && maxLines > 0) {
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    }
  }, [text, maxLines, expanded]);

  const textClamp = maxLines > 0 && !expanded ? {
    display: '-webkit-box',
    WebkitLineClamp: maxLines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  } : {};

  const showButton = maxLines > 0 && text && (overflows || expanded);

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{
        background: 'var(--assistant-msg-bg)', borderRadius: '8px',
        padding: '10px 14px', maxWidth: '85%',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontSize: '14px', lineHeight: '1.5',
        position: 'relative'
      }}>
        <div style={{ fontSize: '11px', marginBottom: '6px', fontWeight: 500, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--accent-color)' }}>AI</span>
          {message.model && <span style={{ color: '#4fc3f7' }}>{message.model}</span>}
          {time && <span style={{ color: 'var(--text-secondary)' }}>{time}</span>}
          {duration && <span style={{ color: 'var(--text-muted)' }}>{duration}</span>}
          {tokenBreakdown && <span style={{ color: 'var(--text-secondary)' }}>{tokenBreakdown}</span>}
          {msgCost && <span style={{ color: '#e6a817' }}>{msgCost}</span>}
        </div>
        <ThinkingBlock thinking={thinkingText} />
        {text && <div ref={textRef} style={textClamp}>{text}</div>}
        {showButton && (
          <div
            onClick={() => setExpanded(!expanded)}
            style={{
              fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none',
              textAlign: 'right', marginTop: '4px'
            }}
          >
            {expanded ? '收起' : '展开全部'}
          </div>
        )}
        <ToolCallBlock toolCalls={message.toolCalls} />
      </div>
    </div>
  );
}
