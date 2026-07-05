import React from 'react';
import DirectoryTree from './DirectoryTree.jsx';
import SearchBar from './SearchBar.jsx';
import SettingsPanel from './SettingsPanel.jsx';

export default function Sidebar({ directoryTree, onSelectSession, selectedSessionId }) {
  const [filter, setFilter] = React.useState('');
  const [showSettings, setShowSettings] = React.useState(false);
  const [contentMatches, setContentMatches] = React.useState(null);

  // Build filePath → messageIds map from search results
  const searchMatchMap = React.useMemo(() => {
    if (!contentMatches) return null;
    const m = new Map();
    for (const r of contentMatches) {
      if (r.messageIds) m.set(r.filePath, r.messageIds);
    }
    return m;
  }, [contentMatches]);

  const handleSelect = React.useCallback((node) => {
    const messageIds = searchMatchMap?.get(node.session?.filePath);
    onSelectSession(node, messageIds, filter || undefined);
  }, [onSelectSession, searchMatchMap, filter]);

  React.useEffect(() => {
    if (!filter) {
      setContentMatches(null);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/sessions/search?q=${encodeURIComponent(filter)}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => setContentMatches(data))
      .catch(() => {});
    return () => controller.abort();
  }, [filter]);

  return (
    <div style={{
      width: 'var(--sidebar-width)',
      minWidth: 'var(--sidebar-width)',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--border-color)',
      background: 'var(--bg-secondary)'
    }}>
      <SearchBar value={filter} onChange={setFilter} />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DirectoryTree
          node={directoryTree}
          filter={filter}
          contentMatches={contentMatches}
          onSelect={handleSelect}
          selectedSessionId={selectedSessionId}
        />
      </div>
      <div style={{ padding: '8px', borderTop: '1px solid var(--border-color)' }}>
        <button onClick={() => setShowSettings(true)} style={{ fontSize: '18px' }}>
          ⚙️
        </button>
      </div>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
