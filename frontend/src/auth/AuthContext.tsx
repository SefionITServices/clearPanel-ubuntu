import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type LoginResult = boolean | '2fa-required';

type AuthState = {
  authenticated: boolean;
  twoFactorPending: boolean;
  username: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  verify2FA: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status', { credentials: 'include' });
      const data = await res.json();
      setAuthenticated(!!data.authenticated);
      setTwoFactorPending(!!data.twoFactorPending);
      setUsername(data.username ?? null);
    } catch (e) {
      setAuthenticated(false);
      setTwoFactorPending(false);
      setUsername(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const login = useCallback(async (usernameInput: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: usernameInput, password }),
      });

      if (!res.ok) return false;

      const data = await res.json();

      if (data.success && data.twoFactorRequired) {
        setTwoFactorPending(true);
        setUsername(data.username ?? usernameInput);
        return '2fa-required';
      }

      if (data.success) {
        await refreshStatus();
        return true;
      }
      return false;
    } catch (e) {
      console.error('[AuthContext] Login exception:', e);
      return false;
    }
  }, [refreshStatus]);

  const verify2FA = useCallback(async (token: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/two-factor/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.success) {
        setTwoFactorPending(false);
        await refreshStatus();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [refreshStatus]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setAuthenticated(false);
      setTwoFactorPending(false);
      setUsername(null);
    }
  }, []);

  const value = useMemo(
    () => ({ authenticated, twoFactorPending, username, loading, login, verify2FA, logout, refreshStatus }),
    [authenticated, twoFactorPending, username, loading, login, verify2FA, logout, refreshStatus]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
