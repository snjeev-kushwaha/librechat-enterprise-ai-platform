import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';

interface Props { onSuccess: () => void; }

export function Login({ onSuccess }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, register, loading, error } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = mode === 'login'
      ? await login(email, password)
      : await register(name, email, password);
    if (ok) {
      if (mode === 'register') { setMode('login'); return; }
      onSuccess();
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0f0f1a',
    }}>
      <div style={{
        width: '100%', maxWidth: '380px', padding: '32px',
        background: '#111827', borderRadius: '16px',
        border: '1px solid #1e1e2e', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🤖</div>
          <h1 style={{ color: '#e5e7eb', fontSize: '22px', fontWeight: 600, marginBottom: '4px' }}>
            AI Platform
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px' }}>
            {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'register' && (
            <div>
              <label style={labelStyle}>Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name" required style={inputStyle} />
            </div>
          )}

          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required style={inputStyle} />
          </div>

          {error && (
            <div style={{ background: '#2d1515', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '10px 12px', color: '#fca5a5', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              padding: '11px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
              background: loading ? '#374151' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all .15s',
            }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '13px', cursor: 'pointer' }}
          >
            {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', color: '#9ca3af',
  marginBottom: '5px', fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  background: '#1e1e2e', border: '1px solid #2d2d3f',
  color: '#e5e7eb', fontSize: '14px', outline: 'none',
  boxSizing: 'border-box',
};
