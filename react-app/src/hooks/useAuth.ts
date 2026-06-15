import { useState, useCallback } from 'react';
import { apiClient } from '../api/client.js';
import type { User } from '../types/index.js';

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
      const res = await apiClient.post('/auth/login', { email, password });
      const { token, user: u } = res.data;
      localStorage.setItem('gateway_token', token);
      localStorage.setItem('gateway_user', JSON.stringify(u));
      setUser(u);
      return true;
    } catch (e: any) {
      setError(e.response?.data?.error || 'Login failed');
      return false;
    } finally { setLoading(false); }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setLoading(true); setError(null);
    try {
      await apiClient.post('/auth/register', { name, email, password, confirm_password: password });
      return true;
    } catch (e: any) {
      setError(e.response?.data?.error || 'Registration failed');
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
