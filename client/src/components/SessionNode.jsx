import React from 'react';

export default function SessionNode({ node, onSelect, isSelected, depth = 0 }) {
  const indent = depth * 16;
  const session = node.session;
  const date = session?.startTime ? new Date(session.startTime).toLocaleDateString() : '';
  const title = session?.title || node.name;

  return (
    <div
      onClick={() => onSelect && onSelect(node)}
      style={{
        padding: '6px 8px 6px ' + (28 + indent) + 'px',
        cursor: 'pointer',
        background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
        fontSize: '13px', lineHeight: '1.3',
        borderLeft: isSelected ? '3px solid var(--accent-color)' : '3px solid transparent'
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
        <span>{session?.agentType}</span>
        {date && <span>{date}</span>}
        {session?.model && <span>{session.model}</span>}
      </div>
    </div>
  );
}
