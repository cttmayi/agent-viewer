import { createContext, useContext, useMemo } from 'react';
import useSettings from './useSettings.js';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { settings, modelPrices, version, loading, update, updateModelPrices } = useSettings();
  const value = useMemo(
    () => ({ settings, modelPrices, version, loading, update, updateModelPrices }),
    [settings, modelPrices, version, loading, update, updateModelPrices]
  );
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
