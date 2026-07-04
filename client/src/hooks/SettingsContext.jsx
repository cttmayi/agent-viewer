import { createContext, useContext, useMemo } from 'react';
import useSettings from './useSettings.js';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { settings, loading, update } = useSettings();
  const value = useMemo(() => ({ settings, loading, update }), [settings, loading, update]);
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettingsContext must be used within SettingsProvider');
  return ctx;
}
