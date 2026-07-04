import React, { useState, useRef, useLayoutEffect } from 'react';
import { useSettingsContext } from '../hooks/SettingsContext.jsx';

export default function UserMessage({ message }) {
  const { settings } = useSettingsContext();
  const maxLines = settings?.messageMaxLines || 0;
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef(null);

  const content = Array.isArray(message.content) ? message.content
    : [{ type: 'text', text: String(message.content ?? '') }];
  let text = content.map(c => {
    const t = typeof c === 'string' ? c : c.text;
    return (typeof t === 'string' ? t : JSON.stringify(t)) ?? '';
  }).filter(Boolean).join('\n') || '';
  const time = message.timestamp ? new Date(message.timestamp).toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

  useLayoutEffect(() => {
    const el = textRef.current;
    if (el && maxLines > 0) {
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    }
  }, [text, maxLines, expanded]);

  if (!text) return null;

  const textStyle = {
    background: 'var(--user-msg-bg)', borderRadius: '8px',
    padding: '10px 14px', maxWidth: '85%',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    fontSize: '14px', lineHeight: '1.5',
    position: 'relative'
  };
  const textClamp = maxLines > 0 && !expanded ? {
    WebkitLineClamp: maxLines,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  } : {};

  const showButton = maxLines > 0 && (overflows || expanded);

  return (
    <div style={{
      marginBottom: '12px'
    }}>
      <div style={textStyle}>
        <div style={{ fontSize: '11px', marginBottom: '6px', fontWeight: 500, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--accent-color)' }}>用户</span>
          {time && <span style={{ color: 'var(--text-secondary)' }}>{time}</span>}
        </div>
        <div ref={textRef} style={textClamp}>
          {text}
        </div>
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
      </div>
    </div>
  );
}
