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
  const time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : '';

  useLayoutEffect(() => {
    const el = textRef.current;
    if (el && maxLines > 0) {
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    }
  }, [text, maxLines, expanded]);

  if (!text) return null;

  const textStyle = {
    background: 'var(--user-msg-bg)', borderRadius: '8px',
    padding: '10px 14px', maxWidth: '80%',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    fontSize: '14px', lineHeight: '1.5',
    position: 'relative'
  };
  if (maxLines > 0 && !expanded) {
    textStyle.WebkitLineClamp = maxLines;
    textStyle.display = '-webkit-box';
    textStyle.WebkitBoxOrient = 'vertical';
    textStyle.overflow = 'hidden';
  }

  const showButton = maxLines > 0 && (overflows || expanded);

  return (
    <div style={{
      marginBottom: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end'
    }}>
      <div ref={textRef} style={textStyle}>
        {text}
        {showButton && (
          <div
            onClick={() => setExpanded(!expanded)}
            style={{
              position: 'absolute', top: '6px', right: '8px', zIndex: 1,
              fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none',
              background: 'var(--user-msg-bg)', padding: '0 4px', borderRadius: '3px'
            }}
          >
            {expanded ? '收起' : '展开全部'}
          </div>
        )}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
        用户 · {time}
      </div>
    </div>
  );
}
