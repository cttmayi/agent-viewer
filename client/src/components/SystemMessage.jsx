import React from 'react';

export default function SystemMessage({ message }) {
  const content = Array.isArray(message.content) ? message.content
    : [{ type: 'text', text: String(message.content ?? '') }];
  const text = content.map(c => c.text).filter(Boolean).join('\n') || '';
  if (!text) return null;

  return (
    <div style={{
      marginBottom: '12px', textAlign: 'center'
    }}>
      <div style={{
        display: 'inline-block', background: 'var(--system-msg-bg)',
        borderRadius: '4px', padding: '4px 12px',
        fontSize: '12px', color: 'var(--text-secondary)',
        maxWidth: '90%', whiteSpace: 'pre-wrap'
      }}>
        {text}
      </div>
    </div>
  );
}
