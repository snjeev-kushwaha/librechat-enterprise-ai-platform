import { useEffect, useRef } from 'react';
import { ChatMessage }       from './ChatMessage.js';
import type { Message }      from '../../types/index.js';

interface Props { messages: Message[]; isStreaming: boolean; }

export function ChatWindow({ messages, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#6b7280', textAlign: 'center', padding: '40px 20px',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
        <h2 style={{ color: '#e5e7eb', marginBottom: '8px', fontSize: '20px' }}>
          AI Platform
        </h2>
        <p style={{ fontSize: '14px', maxWidth: '400px', lineHeight: 1.6 }}>
          Select a model from the sidebar and start chatting. Switch between
          GPT-4o, Claude, Gemini, and local models at any time.
        </p>
        <div style={{ marginTop: '24px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {['What is MCP?', 'Calculate 18% GST on ₹50,000', 'Explain RAG in simple terms'].map(s => (
            <span key={s} style={{
              padding: '6px 14px', borderRadius: '99px', fontSize: '13px',
              border: '1px solid #374151', color: '#9ca3af', cursor: 'default',
            }}>{s}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
      {messages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
      {isStreaming && (
        <div style={{ fontSize: '12px', color: '#6b7280', padding: '4px 12px' }}>
          generating...
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
