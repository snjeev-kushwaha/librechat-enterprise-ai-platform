import { useState, useCallback, useRef } from 'react';
import type { Message } from '../types/index.js';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

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
      const res = await fetch(`${API_BASE}/chat`, {
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
          if (line.trim()) console.log('[SSE raw]', line);
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]' || !raw) continue;

          try {
            const data = JSON.parse(raw);

            let chunk =
              data.text
              ?? data.delta?.content
              ?? data.choices?.[0]?.delta?.content
              ?? data.message?.content
              ?? data.data?.delta?.content
              ?? null;

            if (Array.isArray(chunk)) {
              chunk = chunk.map((c: any) => typeof c === 'string' ? c : (c?.text || '')).join('');
            } else if (chunk && typeof chunk === 'object') {
              chunk = (chunk as any).text || null;
            }

            if (typeof chunk === 'string' && chunk) {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + chunk } : m
              ));
            }

            const nextConvoId =
              data.conversationId
              ?? data.conversation?.conversationId
              ?? data.data?.conversationId
              ?? data.message?.conversationId
              ?? data.streamId
              ?? null;

            if (nextConvoId) setConversationId(nextConvoId);
          } catch {
            // Vercel AI SDK format: 0:"text chunk"
            if (raw.startsWith('0:"') || raw.startsWith("0:'")) {
              try {
                const chunk = JSON.parse(raw.slice(2));
                if (chunk) {
                  setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, content: m.content + chunk } : m
                  ));
                }
              } catch { /* truly malformed */ }
            }
          }
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

  const loadConversation = useCallback(async (convId: string) => {
    setError(null);
    setConversationId(convId);
    setMessages([]);
    try {
      const token = localStorage.getItem('gateway_token');
      const res = await fetch(`${API_BASE}/conversations/${convId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to load messages: HTTP ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        const mapped = data.map((msg: any) => {
          let content = msg.text || '';
          if (!content && Array.isArray(msg.content)) {
            content = msg.content
              .map((c: any) => typeof c === 'string' ? c : (c?.text || ''))
              .join('');
          }
          return {
            id: msg.messageId || crypto.randomUUID(),
            role: (msg.isCreatedByUser ? 'user' : 'assistant') as 'user' | 'assistant',
            content,
            model: msg.model || undefined,
            createdAt: new Date(msg.createdAt),
          };
        });
        setMessages(mapped);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  return { messages, isStreaming, error, conversationId, sendMessage, stopStreaming, clearMessages, loadConversation };
}
