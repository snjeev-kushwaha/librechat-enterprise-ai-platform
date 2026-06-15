import type { Message } from '../../types/index.js';

interface Props { message: Message; }

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div style={{
      display:       'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom:  '16px',
      gap:           '10px',
      alignItems:    'flex-start',
    }}>
      {!isUser && (
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', flexShrink: 0, color: '#fff', fontWeight: 600,
        }}>AI</div>
      )}

      <div style={{ maxWidth: '75%' }}>
        {/* Model badge */}
        {!isUser && message.model && (
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', paddingLeft: '2px' }}>
            {message.model}
            {message.isStreaming && <span style={{ marginLeft: '6px', color: '#6366f1' }}>● streaming</span>}
          </div>
        )}

        {/* Bubble */}
        <div style={{
          padding:      '12px 16px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background:   isUser
            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
            : '#1e1e2e',
          color:    '#fff',
          fontSize: '14px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          border:    isUser ? 'none' : '1px solid #2d2d3f',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          {message.content || (message.isStreaming ? '▊' : '')}
        </div>

        {/* Timestamp */}
        <div style={{
          fontSize: '11px', color: '#6b7280', marginTop: '4px',
          textAlign: isUser ? 'right' : 'left', paddingLeft: isUser ? 0 : '2px',
        }}>
          {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {isUser && (
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: '#374151', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '14px', flexShrink: 0,
          color: '#9ca3af', fontWeight: 600,
        }}>U</div>
      )}
    </div>
  );
}
