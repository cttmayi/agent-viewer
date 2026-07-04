import React from 'react';

export default function SystemMessage({ message }) {
  const content = Array.isArray(message.content) ? message.content
    : [{ type: 'text', text: String(message.content ?? '') }];
  const text = content.map(c => c.text).filter(Boolean).join('\n') || '';
  if (!text) return null;

  return (
    <div style={{
      marginBottom: '12px', display: 'flex', justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--system-msg-bg)',
        borderRadius: '4px', padding: '4px 12px',
        fontSize: '12px', color: 'var(--text-secondary)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word'
      }}>
        {text}
      </div>
    </div>
  );
}
