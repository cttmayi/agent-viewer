import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar.jsx';
import MainArea from './MainArea.jsx';
import DragDropOverlay from './DragDropOverlay.jsx';
import useWebSocket from '../hooks/useWebSocket.js';
import { SettingsProvider, useSettingsContext } from '../hooks/SettingsContext.jsx';
import { SubagentPanelProvider } from '../hooks/SubagentPanelContext.jsx';

function ThemeApplier() {
  const { settings, loading } = useSettingsContext();
  useEffect(() => {
    if (loading || !settings) return;
    const theme = settings.theme || 'system';
    if (theme === 'system') {
      document.documentElement.dataset.theme = '';
    } else {
      document.documentElement.dataset.theme = theme;
    }
  }, [settings, loading]);
  return null;
}

export default function Layout() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchMessageIds, setSearchMessageIds] = useState(null);
  const [searchQuery, setSearchQuery] = useState(null);
  const [directoryTree, setDirectoryTree] = useState({ name: 'root', children: [] });
  const [loading, setLoading] = useState(true);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions/directory-tree');
      const tree = await res.json();
      setDirectoryTree(tree);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  useWebSocket(useCallback((event) => {
    if (event.type === 'session-added' || event.type === 'session-removed') {
      fetchTree();
    }
  }, [fetchTree]));

  const handleSelectSession = useCallback((node, messageIds, query) => {
    setSelectedNode(node);
    setSearchMessageIds(messageIds || null);
    setSearchQuery(query || null);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedNode(null);
    setSearchMessageIds(null);
    setSearchQuery(null);
  }, []);

  const selectedSession = selectedNode ? { session: selectedNode.session } : null;

  return (
    <SettingsProvider>
      <ThemeApplier />
      <div style={{ display: 'flex', height: '100vh' }}>
        <DragDropOverlay />
        <Sidebar
          directoryTree={directoryTree}
          onSelectSession={handleSelectSession}
          selectedSessionId={selectedNode?.session?.id}
        />
        <SubagentPanelProvider>
          <MainArea
            selectedSession={selectedSession}
            onBack={handleBack}
            searchMessageIds={searchMessageIds}
            searchQuery={searchQuery}
          />
        </SubagentPanelProvider>
      </div>
    </SettingsProvider>
  );
}
