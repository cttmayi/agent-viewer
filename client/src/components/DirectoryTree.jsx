import React from 'react';
import DirectoryNode from './DirectoryNode.jsx';
import SessionNode from './SessionNode.jsx';

export default function DirectoryTree({ node, filter, onSelect, selectedSessionId }) {
  if (!node || !node.children || node.children.length === 0) {
    return (
      <div style={{ padding: '16px', color: 'var(--text-muted)', textAlign: 'center' }}>
        没有找到会话
      </div>
    );
  }

  return (
    <div>
      {node.children.map(child =>
        child.type === 'directory' ? (
          <DirectoryNode
            key={child.name}
            node={child}
            filter={filter}
            onSelect={onSelect}
            selectedSessionId={selectedSessionId}
          />
        ) : (
          <SessionNode
            key={child.name}
            node={child}
            onSelect={onSelect}
            isSelected={child.session?.id === selectedSessionId}
          />
        )
      )}
    </div>
  );
}
