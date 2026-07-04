import { createContext, useContext, useMemo } from 'react';
import useSettings from './useSettings.js';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { settings, modelPrices, loading, update, updateModelPrices } = useSettings();
  const value = useMemo(
    () => ({ settings, modelPrices, loading, update, updateModelPrices }),
    [settings, modelPrices, loading, update, updateModelPrices]
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
