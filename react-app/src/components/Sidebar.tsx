import { ModelSwitcher } from './ModelSwitcher.js';
import { AgentSelector } from './AgentSelector.js';
import type { Conversation, User } from '../types/index.js';

interface Props {
  user: User;
  selectedModel: string;
  onModelChange: (m: string) => void;
  selectedAgent?: string;
  onAgentChange: (id?: string) => void;
  conversations: Conversation[];
  activeConvId?: string | null;
  onNewChat: () => void;
  onSelectConv: (id: string) => void;
  onDeleteConv: (id: string) => void;
  onLogout: () => void;
}

export function Sidebar({
  user, selectedModel, onModelChange,
  selectedAgent, onAgentChange,
  conversations, activeConvId,
  onNewChat, onSelectConv, onDeleteConv, onLogout,
}: Props) {
  return (
    <aside style={{
      width: '260px', flexShrink: 0, background: '#111827',
      borderRight: '1px solid #1e1e2e', display: 'flex',
      flexDirection: 'column', height: '100vh', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #1e1e2e' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h1 style={{ color: '#e5e7eb', fontSize: '16px', fontWeight: 600 }}>🤖 AI Platform</h1>
          <button
            onClick={onNewChat}
            style={{
              padding: '5px 10px', borderRadius: '6px', fontSize: '12px',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500,
            }}
          >+ New</button>
        </div>

        {/* Model Switcher */}
        <div style={{ marginBottom: '12px' }}>
          <ModelSwitcher selectedModel={selectedModel} onChange={onModelChange} />
        </div>

        {/* Agent Selector */}
        <AgentSelector selectedAgent={selectedAgent} onChange={onAgentChange} />
      </div>

      {/* Conversation History */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        <div style={{ fontSize: '10.5px', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 8px 4px' }}>
          History
        </div>
        {conversations.length === 0 && (
          <div style={{ fontSize: '12px', color: '#4b5563', padding: '12px 8px' }}>
            No conversations yet
          </div>
        )}
        {conversations.map(conv => (
          <div
            key={conv.conversationId}
            onClick={() => onSelectConv(conv.conversationId)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
              background: activeConvId === conv.conversationId ? '#1e1e2e' : 'transparent',
              marginBottom: '2px', gap: '6px',
              transition: 'background .1s',
            }}
          >
            <span style={{ fontSize: '13px', color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {conv.title || 'New conversation'}
            </span>
            <button
              onClick={e => { e.stopPropagation(); onDeleteConv(conv.conversationId); }}
              style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: '13px', padding: '0 2px', flexShrink: 0 }}
              title="Delete"
            >✕</button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#e5e7eb', fontWeight: 500 }}>{user.email}</div>
          <div style={{ fontSize: '11px', color: '#4b5563' }}>{user.role}</div>
        </div>
        <button
          onClick={onLogout}
          style={{
            padding: '5px 10px', borderRadius: '6px', fontSize: '12px',
            background: '#1e1e2e', color: '#9ca3af', border: '1px solid #2d2d3f',
            cursor: 'pointer',
          }}
        >Logout</button>
      </div>
    </aside>
  );
}
