import { useState, useCallback, useRef } from 'react';
import type { Message } from '../types/index.js';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    text: string, model: string, agentId?: string
  ) => {
    if (!text.trim() || isStreaming) return;

    // Add user message immediately
    const userMsg: Message = {
      id: crypto.randomUUID(), role: 'user', content: text, createdAt: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    setError(null);

    // Placeholder for streaming assistant response
    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantId, role: 'assistant', content: '', model,
      createdAt: new Date(), isStreaming: true,
    }]);

    abortRef.current = new AbortController();

    try {
      const token = localStorage.getItem('gateway_token');
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ text, model, conversationId, agentId }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]' || !raw) continue;

          try {
            const data = JSON.parse(raw);
            if (data.text) {
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: m.content + data.text }
                  : m
              ));
            }
            if (data.conversationId) setConversationId(data.conversationId);
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        setMessages(prev => prev.filter(m => m.id !== assistantId));
      }
    } finally {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, isStreaming: false } : m
      ));
      setIsStreaming(false);
    }
  }, [isStreaming, conversationId]);

  const stopStreaming = () => abortRef.current?.abort();

  const clearMessages = () => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  };

  return { messages, isStreaming, error, conversationId, sendMessage, stopStreaming, clearMessages };
}
