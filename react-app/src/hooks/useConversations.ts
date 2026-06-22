import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client.js';
import type { Conversation } from '../types/index.js';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    const token = localStorage.getItem('gateway_token');
    if (!token) {
      setConversations([]);
      setLoading(false);
      return; // not logged in — don't call the API at all
    }
    setLoading(true);
    apiClient.get('/conversations')
      .then(r => setConversations(r.data.conversations || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const deleteConversation = async (id: string) => {
    await apiClient.delete(`/conversations/${id}`);
    setConversations(prev => prev.filter(c => c.conversationId !== id));
  };

  return { conversations, loading, refresh, deleteConversation };
}