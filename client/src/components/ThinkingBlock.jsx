import React, { useState } from 'react';
import { useSettingsContext } from '../hooks/SettingsContext.jsx';

export default function ThinkingBlock({ thinking }) {
  const { settings } = useSettingsContext();
  const showSetting = settings?.showThinking || 'fold';

  if (!thinking || showSetting === 'hide') return null;

  const [expanded, setExpanded] = useState(showSetting === 'unfold');

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded(!expanded);
    }
  }

  return (
    <div style={{ margin: '8px 0' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        aria-controls="thinking-content"
        style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)', userSelect: 'none' }}
      >
        {expanded ? '▼' : '▶'} thinking {thinking.length} 字符
      </div>
      {expanded && (
        <pre id="thinking-content" style={{
          marginTop: '4px', padding: '8px', borderRadius: '4px',
          background: 'var(--bg-secondary)', fontSize: '12px',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          color: 'var(--text-secondary)', maxHeight: '400px', overflow: 'auto'
        }}>
          {thinking}
        </pre>
      )}
    </div>
  );
}
