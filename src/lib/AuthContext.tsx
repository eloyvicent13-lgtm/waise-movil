import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { clearToken, getToken, login as loginApi, register as registerApi } from "./auth";

interface AuthState {
  loading: boolean;
  username: string | null;
  login: (u: string, p: string) => Promise<void>;
  register: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    getToken().then((t) => {
      // We don't store the username separately on mobile; if a token exists,
      // treat the session as logged in and let API calls prove it's valid.
      setUsername(t ? "tú" : null);
      setLoading(false);
    });
  }, []);

  async function login(u: string, p: string) {
    const r = await loginApi(u, p);
    setUsername(r.username);
  }
  async function register(u: string, p: string) {
    const r = await registerApi(u, p);
    setUsername(r.username);
  }
  async function logout() {
    await clearToken();
    setUsername(null);
  }

  return <Ctx.Provider value={{ loading, username, login, register, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
