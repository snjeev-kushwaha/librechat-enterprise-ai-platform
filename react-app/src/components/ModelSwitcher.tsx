import { useModels } from '../hooks/useModels.js';

interface Props { selectedModel: string; onChange: (model: string) => void; }

export function ModelSwitcher({ selectedModel, onChange }: Props) {
  const { grouped, loading } = useModels();

  if (loading) return (
    <div style={{ fontSize: '12px', color: '#6b7280', padding: '8px' }}>
      Loading models...
    </div>
  );

  // Find info for selected model
  const allModels = Object.values(grouped).flat();
  const selected = allModels.find(m => m.id === selectedModel);

  return (
    <div>
      <label style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: '6px' }}>
        Model
      </label>

      <select
        value={selectedModel}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: '8px',
          background: '#1e1e2e', border: '1px solid #2d2d3f',
          color: '#e5e7eb', fontSize: '13px', cursor: 'pointer', outline: 'none',
        }}
      >
        {Object.entries(grouped).map(([provider, models]) => (
          <optgroup key={provider} label={provider}>
            {models.map(m => (
              <option key={m.id} value={m.id}>
                {m.displayName}{m.isFree ? ' (FREE)' : ` ~$${m.costPer1kIn}/1k`}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Selected model info */}
      {selected && (
        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          <span style={{
            fontSize: '11px', padding: '2px 8px', borderRadius: '99px',
            background: '#1e3a5f', color: '#60a5fa', border: '1px solid #1d4ed8',
          }}>
            {(selected.contextWindow / 1000).toFixed(0)}k ctx
          </span>
          {selected.capabilities.slice(0, 2).map(c => (
            <span key={c} style={{
              fontSize: '11px', padding: '2px 8px', borderRadius: '99px',
              background: '#1a2e1a', color: '#4ade80', border: '1px solid #166534',
            }}>{c}</span>
          ))}
          {selected.isFree && (
            <span style={{
              fontSize: '11px', padding: '2px 8px', borderRadius: '99px',
              background: '#1a2e1a', color: '#4ade80', border: '1px solid #166534',
            }}>FREE</span>
          )}
        </div>
      )}
    </div>
  );
}
