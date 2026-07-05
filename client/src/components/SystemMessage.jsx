import React from 'react';
import MarkdownContent from './MarkdownContent.jsx';
import { useSettingsContext } from '../hooks/SettingsContext.jsx';

export default function SystemMessage({ message }) {
  const { settings } = useSettingsContext();
  const markdownEnabled = settings?.markdownEnabled !== false;

  const content = Array.isArray(message.content) ? message.content
    : [{ type: 'text', text: String(message.content ?? '') }];
  const text = content.map(c => c.text).filter(Boolean).join('\n') || '';
  if (!text) return null;

  const style = {
    background: 'var(--system-msg-bg)',
    borderRadius: '4px', padding: '4px 12px',
    fontSize: '12px', color: 'var(--text-secondary)',
    whiteSpace: markdownEnabled ? 'normal' : 'pre-wrap',
    wordBreak: 'break-word'
  };

  return (
    <div style={{
      marginBottom: '12px', display: 'flex', justifyContent: 'center'
    }}>
      <div style={style}>
        {markdownEnabled ? <MarkdownContent text={text} /> : text}
      </div>
    </div>
  );
}
