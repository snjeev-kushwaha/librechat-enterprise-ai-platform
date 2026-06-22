import { useState, useEffect } from 'react';
import { apiClient } from '../api/client.js';
import type { Agent } from '../types/index.js';

interface Props { selectedAgent?: string; onChange: (id?: string) => void; }

export function AgentSelector({ selectedAgent, onChange }: Props) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/agents')
      .then(r => setAgents(r.data.agents || []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (agents.length === 0) return (
    <div style={{ fontSize: '12px', color: '#4b5563', padding: '4px 0' }}>
      No agents configured. Create one in LibreChat.
    </div>
  );

  return (
    <div>
      <label style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: '6px' }}>
        Agent <span style={{ color: '#4b5563', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
      </label>
      <select
        value={selectedAgent || ''}
        onChange={e => onChange(e.target.value || undefined)}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: '8px',
          background: '#1e1e2e', border: '1px solid #2d2d3f',
          color: '#e5e7eb', fontSize: '13px', cursor: 'pointer', outline: 'none',
        }}
      >
        <option value="">None (direct model)</option>
        {agents.map(a => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      {selectedAgent && (
        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '5px' }}>
          Agent active — MCP tools enabled
        </div>
      )}
    </div>
  );
}
