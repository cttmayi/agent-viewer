import React, { useState, useRef, useLayoutEffect } from 'react';
import { useSettingsContext } from '../hooks/SettingsContext.jsx';
import MarkdownContent, { HighlightedText } from './MarkdownContent.jsx';

export default function UserMessage({ message, isHighlighted, highlightQuery }) {
  const { settings } = useSettingsContext();
  const maxLines = settings?.messageMaxLines || 0;
  const markdownEnabled = settings?.markdownEnabled !== false;
  const showHeader = settings?.showMessageHeader !== false;
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
  }, [text, maxLines, expanded, markdownEnabled]);

  if (!text) return null;

  const textStyle = {
    background: 'var(--user-msg-bg)', borderRadius: '8px',
    padding: '10px 14px',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    fontSize: '14px', lineHeight: '1.5',
    position: 'relative'
  };

  const collapsedStyle = markdownEnabled
    ? { maxHeight: `${maxLines * 1.6}em`, overflow: 'hidden' }
    : { WebkitLineClamp: maxLines, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' };

  const bodyEl = markdownEnabled ? (
    <div ref={textRef} style={maxLines > 0 && !expanded ? collapsedStyle : {}}>
      <MarkdownContent text={text} highlight={highlightQuery} />
    </div>
  ) : (
    <div ref={textRef} style={maxLines > 0 && !expanded ? collapsedStyle : {}}>
      {highlightQuery ? <HighlightedText text={text} query={highlightQuery} /> : text}
    </div>
  );

  const showButton = maxLines > 0 && (overflows || expanded);

  return (
    <div style={{
      marginBottom: '12px'
    }} data-msg-id={message.id}>
      <div style={{
        ...textStyle,
        ...(isHighlighted ? { outline: '2px solid var(--accent-color)', outlineOffset: '-1px' } : {})
      }}>
        {showHeader && (
          <div style={{ fontSize: '11px', marginBottom: '6px', fontWeight: 500, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--accent-color)' }}>用户</span>
            {time && <span style={{ color: 'var(--text-secondary)' }}>{time}</span>}
          </div>
        )}
        {bodyEl}
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
