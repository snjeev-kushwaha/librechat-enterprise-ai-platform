import { useState, useRef, KeyboardEvent } from 'react';

interface Props {
  onSend:      (text: string) => void;
  onStop:      () => void;
  isStreaming: boolean;
  disabled:    boolean;
}

export function ChatInput({ onSend, onStop, isStreaming, disabled }: Props) {
  const [text, setText]   = useState('');
  const textareaRef       = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 180)}px`; }
  };

  return (
    <div style={{ padding: '16px 20px', borderTop: '1px solid #1e1e2e' }}>
      <div style={{
        display: 'flex', gap: '10px', alignItems: 'flex-end',
        background: '#1e1e2e', borderRadius: '14px',
        border: '1px solid #2d2d3f', padding: '10px 14px',
      }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => { setText(e.target.value); handleInput(); }}
          onKeyDown={handleKey}
          placeholder="Message... (Enter to send, Shift+Enter for new line)"
          disabled={disabled}
          rows={1}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#e5e7eb', fontSize: '14px', resize: 'none', lineHeight: '1.6',
            fontFamily: 'inherit', maxHeight: '180px', overflowY: 'auto',
          }}
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
              background: '#dc2626', color: '#fff', border: 'none',
              cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 500,
            }}
          >⬛ Stop</button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim() || disabled}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
              background: text.trim() ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#374151',
              color: '#fff', border: 'none',
              cursor: text.trim() ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap', fontWeight: 500, transition: 'all .15s',
            }}
          >➤ Send</button>
        )}
      </div>
      <p style={{ fontSize: '11px', color: '#4b5563', textAlign: 'center', marginTop: '8px' }}>
        Enter to send • Shift+Enter for new line • Switch models anytime
      </p>
    </div>
  );
}
