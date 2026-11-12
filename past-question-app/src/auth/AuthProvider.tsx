import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { nav } from "@/navigation";
import { auth, users } from "@/api";
import {
  access,
  cachedUser,
  clearCachedUser,
  clearSession,
  saveCachedUser,
  saveSession,
} from "@/storage/secure";
import { ApiError } from "@/api/client";
import { clearOfflineCache } from "@/storage/documents";
import type { User } from "@/types";

type AuthContext = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    whatsapp: string;
  }) => Promise<string | undefined>;
  refresh: () => Promise<User | null>;
  logout: () => Promise<void>;
};

const C = createContext<AuthContext | null>(null);

async function clearInvalidAccount() {
  await clearSession();
  await clearCachedUser();
  await clearOfflineCache();
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!(await access())) return;
        try {
          // /users/me is the authoritative mobile profile and includes whatsapp.
          const profile = await users.me();
          if (mounted) setUser(profile);
          await saveCachedUser(profile);
        } catch (error) {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            await clearInvalidAccount();
            if (mounted) setUser(null);
          } else {
            // A network/temporary failure must not destroy a still-stored session.
            const saved = await cachedUser<User>();
            if (mounted && saved) setUser(saved);
          }
        }
      } catch {
        // Secure storage failure is not a reason to fabricate an authenticated user.
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function login(email: string, password: string) {
    const result = await auth.login(email.trim(), password);
    await saveSession(result.accessToken, result.refreshToken);

    // Login returns the safe auth profile; fetch /users/me for the additional
    // server-owned WhatsApp field used by the document watermark.
    let profile = result.user;
    try {
      profile = await users.me();
    } catch {
      // Authentication succeeded. Profile enrichment can be retried later.
    }
    setUser(profile);
    await saveCachedUser(profile);
    return profile;
  }

  async function register(input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    whatsapp: string;
  }) {
    const response = await auth.register({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim(),
      password: input.password,
      whatsapp: input.whatsapp.trim(),
    });
    return response.verificationToken;
  }

  async function refresh() {
    try {
      const profile = await users.me();
      setUser(profile);
      await saveCachedUser(profile);
      return profile;
    } catch {
      return null;
    }
  }

  async function logout() {
    try {
      await auth.logout();
    } finally {
      await clearSession();
      await clearCachedUser();
      await clearOfflineCache();
      setUser(null);
      nav.replace("/onboarding");
    }
  }

  return (
    <C.Provider value={{ user, loading, login, register, refresh, logout }}>
      {children}
    </C.Provider>
  );
}

export function useAuth() {
  const value = useContext(C);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
