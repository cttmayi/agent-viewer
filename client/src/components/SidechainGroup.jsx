import React, { useState } from 'react';
import MessageList from './MessageList.jsx';
import { useSettingsContext } from '../hooks/SettingsContext.jsx';

export default function SidechainGroup({ messages }) {
  const { settings } = useSettingsContext();
  const showSetting = settings?.showSidechains || 'fold';

  if (!messages || messages.length === 0 || showSetting === 'hide') return null;

  const [expanded, setExpanded] = useState(showSetting === 'unfold');

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded(!expanded);
    }
  }

  return (
    <div style={{
      margin: '8px 0', border: '1px dashed var(--border-color)',
      borderRadius: '8px', padding: '8px'
    }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        aria-controls="sidechain-content"
        style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)', userSelect: 'none' }}
      >
        {expanded ? '▼' : '▶'} 子 agent 会话 ({messages.length} 条消息)
      </div>
      <div id="sidechain-content">
        {expanded && (
          <div style={{ marginTop: '8px' }}>
            <MessageList messages={messages} />
          </div>
        )}
      </div>
    </div>
  );
}
