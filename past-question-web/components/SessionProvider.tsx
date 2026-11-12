'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '@/lib/services';
import { clearSessionTokens, refreshAccessToken, setAccessToken } from '@/lib/api';
import { clearActivationTokens } from '@/lib/activation-store';
import type { User } from '@/lib/types';

type RegisterBody = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  whatsapp: string;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: RegisterBody) => Promise<{ user: User; verificationToken?: string }>;
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
    // On load, re-issue an access token from the HTTP-only cookie. With no cookie
    // the session route answers 401 without calling the backend.
    let active = true;
    const boot = async () => {
      try {
        const token = await refreshAccessToken();
        if (token && active) await refreshUser();
      } finally {
        if (active) setLoading(false);
      }
    };
    void boot();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login: async (email, password) => {
      const data = await authApi.login({ email, password });
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data.user;
    },
    register: authApi.register,
    logout: async () => {
      try {
        await authApi.logout();
      } catch {
        // If the request itself failed, the cookie may remain until it expires.
        // The in-memory session is still cleared below.
      } finally {
        clearSessionTokens();
        clearActivationTokens();
        setUser(null);
      }
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
