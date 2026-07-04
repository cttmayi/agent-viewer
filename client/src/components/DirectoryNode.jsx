import React, { useState } from 'react';
import SessionNode from './SessionNode.jsx';

export default function DirectoryNode({ node, filter, onSelect, selectedSessionId, depth = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const indent = depth * 16;

  return (
    <div>
      <div
        onClick={() => hasChildren && setExpanded(!expanded)}
        style={{
          padding: '4px 8px 4px ' + (12 + indent) + 'px',
          cursor: hasChildren ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '13px', color: 'var(--text-secondary)',
          userSelect: 'none'
        }}
      >
        {hasChildren ? (expanded ? '▼' : '▶') : ' '}
        <span>{node.name}</span>
      </div>
      {expanded && hasChildren && node.children.map(child =>
        child.type === 'directory' ? (
          <DirectoryNode
            key={child.name}
            node={child}
            filter={filter}
            onSelect={onSelect}
            selectedSessionId={selectedSessionId}
            depth={depth + 1}
          />
        ) : (
          <SessionNode
            key={child.name}
            node={child}
            onSelect={onSelect}
            isSelected={child.session?.id === selectedSessionId}
            depth={depth + 1}
          />
        )
      )}
    </div>
  );
}
