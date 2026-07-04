import { useState, useEffect, useCallback } from 'react';

export default function useSettings() {
  const [settings, setSettings] = useState(null);
  const [modelPrices, setModelPrices] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        setSettings(data.settings);
        setModelPrices(data.modelPrices || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const update = useCallback(async (partial) => {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: partial })
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
    }
  }, []);

  const updateModelPrices = useCallback(async (prices) => {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelPrices: prices })
    });
    if (res.ok) {
      const data = await res.json();
      setModelPrices(data.modelPrices || {});
    }
  }, []);

  return { settings, modelPrices, loading, update, updateModelPrices };
}
