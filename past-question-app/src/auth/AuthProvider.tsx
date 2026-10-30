import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { nav } from "@/navigation";
import { auth, devices } from "@/api";
import { clearSession, saveSession } from "@/storage/secure";
import { identity } from "@/security/device";
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
  }) => Promise<void>;
  refresh: () => Promise<User | null>;
  logout: () => Promise<void>;
};

const C = createContext<AuthContext | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const { access } = await import("@/storage/secure");
        if (await access()) {
          const u = await auth.me();
          setUser(u);
          const d = await identity();
          await devices.register({
            deviceId: d.deviceId,
            platform: d.platform,
            appVersion: "1.0.0",
            publicKey: d.publicKeyPem,
          });
        }
      } catch {
        await clearSession();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(e: string, p: string) {
    const r = await auth.login(e.trim(), p);
    await saveSession(r.accessToken, r.refreshToken);
    setUser(r.user);
    const d = await identity();
    await devices.register({
      deviceId: d.deviceId,
      platform: d.platform,
      appVersion: "1.0.0",
      publicKey: d.publicKeyPem,
    });
    return r.user;
  }

  async function register(x: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    whatsapp: string;
  }) {
      await auth.register({
        firstName: x.firstName.trim(),
        lastName: x.lastName.trim(),
        email: x.email.trim(),
        password: x.password,
        whatsapp: x.whatsapp.trim(),
      });

  }

  async function refresh() {
    try {
      const u = await auth.me();
      setUser(u);
      return u;
    } catch  (error) {
      return null;
    }
  }
  async function logout() {
    try {
      await auth.logout();
    } finally {
      await clearSession();
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
