'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '@/lib/services';
import { clearSessionTokens, getAccessToken, setAccessToken, storeRefreshToken } from '@/lib/api';
import type { User } from '@/lib/types';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: { email: string; password: string; firstName: string; lastName: string }) => Promise<{ user: User; verificationToken?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const next = await authApi.me();
      setUser(next);
      return next;
    } catch {
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    const boot = async () => {
      const refreshToken = window.localStorage.getItem('tpaths_refresh_token');
      if (!refreshToken && !getAccessToken()) {
        setLoading(false);
        return;
      }
      // apiFetch performs a single refresh when the access token is absent only if a request receives 401.
      // Seed the session by explicitly refreshing through the service client.
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: refreshToken }),
        });
        if (!response.ok) throw new Error('refresh failed');
        const data = await response.json() as { accessToken: string; refreshToken: string };
        setAccessToken(data.accessToken);
        storeRefreshToken(data.refreshToken);
        await refreshUser();
      } catch {
        clearSessionTokens();
      } finally {
        setLoading(false);
      }
    };
    void boot();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login: async (email, password) => {
      const data = await authApi.login({ email, password });
      setAccessToken(data.accessToken);
      storeRefreshToken(data.refreshToken);
      setUser(data.user);
      return data.user;
    },
    register: authApi.register,
    logout: async () => {
      try { if (user) await authApi.logout(); } finally { clearSessionTokens(); setUser(null); }
    },
    refreshUser,
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useSession must be used within SessionProvider');
  return value;
}
