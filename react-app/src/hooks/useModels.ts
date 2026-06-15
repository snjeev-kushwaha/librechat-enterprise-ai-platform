import { useState, useEffect } from 'react';
import { apiClient } from '../api/client.js';
import type { ModelInfo } from '../types/index.js';

export function useModels() {
  const [models, setModels] = useState<Record<string, ModelInfo>>({});
  const [grouped, setGrouped] = useState<Record<string, ModelInfo[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/api/models')
      .then(r => { setModels(r.data.models); setGrouped(r.data.grouped); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { models, grouped, loading, error };
}
