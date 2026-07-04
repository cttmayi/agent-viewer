import React from 'react';
import DirectoryTree from './DirectoryTree.jsx';
import SearchBar from './SearchBar.jsx';
import SettingsPanel from './SettingsPanel.jsx';

export default function Sidebar({ directoryTree, onSelectSession, selectedSessionId }) {
  const [filter, setFilter] = React.useState('');
  const [showSettings, setShowSettings] = React.useState(false);

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
          onSelect={onSelectSession}
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
