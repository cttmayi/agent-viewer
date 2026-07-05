import React, { useState } from 'react';
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

function hasVisibleChildren(node, filter, contentMatchPaths) {
  if (!node.children) return false;
  return node.children.some(child => {
    if (child.type === 'directory') return hasVisibleChildren(child, filter, contentMatchPaths);
    return matchesFilter(child, filter, contentMatchPaths);
  });
}

export default function DirectoryNode({ node, filter, contentMatchPaths, onSelect, selectedSessionId, matchCountMap, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth === 0);
  const visible = filter ? hasVisibleChildren(node, filter, contentMatchPaths) : true;
  const indent = depth * 16;

  if (!visible) return null;

  const isFiltering = !!filter;
  const filteredChildren = (isFiltering || expanded) && node.children
    .map(child => {
      if (child.type === 'file' && child.session?.startTime) {
        return { ...child, _sortTime: new Date(child.session.startTime).getTime() };
      }
      return { ...child, _sortTime: 0 };
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      if (a.type === 'file') return b._sortTime - a._sortTime;
      return a.name.localeCompare(b.name);
    })
    .filter(child => {
      if (child.type === 'directory') return hasVisibleChildren(child, filter, contentMatchPaths);
      return matchesFilter(child, filter, contentMatchPaths);
    });

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '4px 8px 4px ' + (12 + indent) + 'px',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '13px', color: 'var(--text-secondary)',
          userSelect: 'none'
        }}
      >
        {expanded ? '▼' : '▶'}
        <span>{node.name}</span>
      </div>
      {(isFiltering || expanded) && filteredChildren.map(child =>
        child.type === 'directory' ? (
          <DirectoryNode
            key={child.name}
            node={child}
            filter={filter}
            contentMatchPaths={contentMatchPaths}
            onSelect={onSelect}
            selectedSessionId={selectedSessionId}
            matchCountMap={matchCountMap}
            depth={depth + 1}
          />
        ) : (
          <SessionNode
            key={child.name}
            node={child}
            onSelect={onSelect}
            isSelected={child.session?.id === selectedSessionId}
            matchCount={matchCountMap?.[child.session?.filePath]}
            depth={depth + 1}
          />
        )
      )}
    </div>
  );
}
