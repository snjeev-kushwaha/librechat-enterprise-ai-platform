import { useState, useCallback } from 'react';
import { apiClient } from '../api/client.js';
import type { User } from '../types/index.js';

const BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem('gateway_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true); setError(null);
    try {
      // Auth endpoints are public, not under /api prefix
      const authPath = BASE_URL === '/api' ? '/auth' : `${BASE_URL.replace('/api', '')}/auth`;
      const res = await fetch(`${authPath}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }
      const { token, user: u } = await res.json();
      localStorage.setItem('gateway_token', token);
      localStorage.setItem('gateway_user', JSON.stringify(u));
      setUser(u);
      return true;
    } catch (e: any) {
      setError(e.message || 'Login failed');
      return false;
    } finally { setLoading(false); }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setLoading(true); setError(null);
    try {
      const authPath = BASE_URL === '/api' ? '/auth' : `${BASE_URL.replace('/api', '')}/auth`;
      const res = await fetch(`${authPath}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, confirm_password: password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Registration failed');
      }
      return true;
    } catch (e: any) {
      setError(e.message || 'Registration failed');
      return false;
    } finally { setLoading(false); }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('gateway_token');
    localStorage.removeItem('gateway_user');
    setUser(null);
  }, []);

  return { user, loading, error, login, register, logout, isAuthenticated: !!user };
}
