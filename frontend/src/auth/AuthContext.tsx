import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type AuthState = {
  authenticated: boolean;
  username: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status', { credentials: 'include' });
      const data = await res.json();
      setAuthenticated(!!data.authenticated);
      setUsername(data.username ?? null);
    } catch (e) {
      setAuthenticated(false);
      setUsername(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const login = useCallback(async (usernameInput: string, password: string) => {
    try {
      console.log('[AuthContext] Sending login request to /api/auth/login');
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: usernameInput, password }),
      });
      console.log('[AuthContext] Response status:', res.status, res.statusText);

      if (!res.ok) {
        let reason: string | undefined;
        try {
          const errorData = await res.json();
          reason = errorData?.error || JSON.stringify(errorData);
        } catch (_) {
          reason = 'Unexpected error';
        }
        console.error('[AuthContext] Login failed:', reason);
        return false;
      }

      const data = await res.json();
      console.log('[AuthContext] Response data:', data);

      if (data.success) {
        // Refresh status to ensure we have server-provided username (in case backend sets a canonical form)
        await refreshStatus();
        return true;
      }
      return false;
    } catch (e) {
      console.error('[AuthContext] Login exception:', e);
      return false;
    }
  }, [refreshStatus]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setAuthenticated(false);
      setUsername(null);
    }
  }, []);

  const value = useMemo(
    () => ({ authenticated, username, loading, login, logout, refreshStatus }),
    [authenticated, username, loading, login, logout, refreshStatus]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
