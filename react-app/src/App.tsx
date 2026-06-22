import { useState } from 'react';
import { Login } from './components/Login.js';
import { Sidebar } from './components/Sidebar.js';
import { ChatWindow } from './components/Chat/ChatWindow.js';
import { ChatInput } from './components/Chat/ChatInput.js';
import { useAuth } from './hooks/useAuth.js';
import { useChat } from './hooks/useChat.js';
import { useConversations } from './hooks/useConversations.js';

export default function App() {
  const [model, setModel] = useState('claude-sonnet-4-20250514');
  const [agentId, setAgentId] = useState<string | undefined>();

  const { user, logout, isAuthenticated } = useAuth();
  const { messages, isStreaming, error, conversationId, sendMessage, stopStreaming, clearMessages, loadConversation } = useChat();
  const { conversations, refresh, deleteConversation } = useConversations();

  // Show login if not authenticated
  if (!isAuthenticated || !user) {
    return <Login onSuccess={() => window.location.reload()} />;
  }

  const handleNewChat = () => {
    clearMessages();
    refresh();
  };

  const handleSelectConv = (_id: string) => {
    loadConversation(_id);
    const selected = conversations.find(c => c.conversationId === _id);
    if (selected) {
      setModel(selected.model);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f0f1a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Sidebar */}
      <Sidebar
        user={user}
        selectedModel={model}
        onModelChange={setModel}
        selectedAgent={agentId}
        onAgentChange={setAgentId}
        conversations={conversations}
        activeConvId={conversationId}
        onNewChat={handleNewChat}
        onSelectConv={handleSelectConv}
        onDeleteConv={deleteConversation}
        onLogout={logout}
      />

      {/* Main chat area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{
          padding: '12px 20px', borderBottom: '1px solid #1e1e2e',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: '14px', color: '#9ca3af' }}>
            Using <span style={{ color: '#a78bfa', fontWeight: 500 }}>{model}</span>
            {agentId && <span> · Agent active 🔌</span>}
          </div>
          <div style={{ fontSize: '12px', color: '#4b5563' }}>
            LibreChat + MCP
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            margin: '12px 20px 0', padding: '10px 14px',
            background: '#2d1515', border: '1px solid #7f1d1d',
            borderRadius: '8px', color: '#fca5a5', fontSize: '13px',
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Messages */}
        <ChatWindow messages={messages} isStreaming={isStreaming} />

        {/* Input */}
        <ChatInput
          onSend={(text) => sendMessage(text, model, agentId)}
          onStop={stopStreaming}
          isStreaming={isStreaming}
          disabled={false}
        />
      </main>
    </div>
  );
}
