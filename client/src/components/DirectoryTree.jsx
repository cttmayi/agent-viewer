import React from 'react';
import DirectoryNode from './DirectoryNode.jsx';
import SessionNode from './SessionNode.jsx';

function matchesFilter(node, filter, contentMatchPaths) {
  if (!filter) return true;
  const q = filter.toLowerCase();
  const title = node.session?.title || '';
  if (title.toLowerCase().includes(q)) return true;
  if (node.session?.agentType?.toLowerCase().includes(q)) return true;
  if (contentMatchPaths && contentMatchPaths.has(node.session?.filePath)) return true;
  return false;
}

export default function DirectoryTree({ node, filter, contentMatches, onSelect, selectedSessionId }) {
  const contentMatchPaths = React.useMemo(() => {
    if (!contentMatches) return null;
    return new Set(contentMatches.map(m => m.filePath));
  }, [contentMatches]);

  const matchCountMap = React.useMemo(() => {
    if (!contentMatches) return null;
    const m = {};
    for (const r of contentMatches) m[r.filePath] = r.matchCount;
    return m;
  }, [contentMatches]);

  if (!node || !node.children || node.children.length === 0) {
    return (
      <div style={{ padding: '16px', color: 'var(--text-muted)', textAlign: 'center' }}>
        没有找到会话
      </div>
    );
  }

  return (
    <div>
      {node.children
        .filter(child => {
          if (child.type === 'directory') return true;
          if (!filter) return true;
          return matchesFilter(child, filter, contentMatchPaths);
        })
        .map(child =>
        child.type === 'directory' ? (
          <DirectoryNode
            key={child.name}
            node={child}
            filter={filter}
            contentMatchPaths={contentMatchPaths}
            onSelect={onSelect}
            selectedSessionId={selectedSessionId}
          />
        ) : (
          <SessionNode
            key={child.name}
            node={child}
            onSelect={onSelect}
            isSelected={child.session?.id === selectedSessionId}
            matchCount={matchCountMap?.[child.session?.filePath]}
          />
        )
      )}
    </div>
  );
}
