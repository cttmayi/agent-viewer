import React, { useState, useRef, useLayoutEffect } from 'react';
import ThinkingBlock from './ThinkingBlock.jsx';
import ToolCallBlock from './ToolCallBlock.jsx';
import { useSettingsContext } from '../hooks/SettingsContext.jsx';

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
  const time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : '';
  const tokens = message.tokenUsage?.output ? `${message.tokenUsage.output} tokens` : '';
  const duration = message.duration ? `${(message.duration / 1000).toFixed(1)}s` : '';

  useLayoutEffect(() => {
    const el = textRef.current;
    if (el && maxLines > 0) {
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    }
  }, [text, maxLines, expanded]);

  const textStyle = {};
  if (maxLines > 0 && !expanded) {
    textStyle.display = '-webkit-box';
    textStyle.WebkitLineClamp = maxLines;
    textStyle.WebkitBoxOrient = 'vertical';
    textStyle.overflow = 'hidden';
  }

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
        <ThinkingBlock thinking={thinkingText} />
        {text && <div ref={textRef} style={textStyle}>{text}</div>}
        {showButton && (
          <div
            onClick={() => setExpanded(!expanded)}
            style={{
              position: 'absolute', top: '8px', right: '12px', zIndex: 1,
              fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none',
              background: 'var(--assistant-msg-bg)', padding: '0 4px', borderRadius: '3px'
            }}
          >
            {expanded ? '收起' : '展开全部'}
          </div>
        )}
        <ToolCallBlock toolCalls={message.toolCalls} />
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
        AI{message.model ? ` · ${message.model}` : ''} · {[time, duration, tokens].filter(Boolean).join(' · ')}
      </div>
    </div>
  );
}
