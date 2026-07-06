import React, { createContext, useContext, useState, useCallback } from 'react';

const SubagentPanelContext = createContext(null);

export function SubagentPanelProvider({ children }) {
  const [subagent, setSubagent] = useState(null);
  const [subagentFilePath, setSubagentFilePath] = useState('');

  const selectSubagent = useCallback((messages, filePath) => {
    setSubagent(messages);
    setSubagentFilePath(filePath || '');
  }, []);

  const clearSubagent = useCallback(() => {
    setSubagent(null);
    setSubagentFilePath('');
  }, []);

  return (
    <SubagentPanelContext.Provider value={{ subagent, subagentFilePath, selectSubagent, clearSubagent }}>
      {children}
    </SubagentPanelContext.Provider>
  );
}

export function useSubagentPanel() {
  const ctx = useContext(SubagentPanelContext);
  if (!ctx) throw new Error('useSubagentPanel must be used within SubagentPanelProvider');
  return ctx;
}
