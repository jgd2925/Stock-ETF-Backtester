import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/auth/me").then(({ ok, data }) => {
      if (ok) setUser(data as AuthUser);
      setLoading(false);
    });
  }, []);

  async function signIn(email: string, password: string) {
    const { ok, data } = await apiFetch("/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (ok) { setUser(data as AuthUser); return { error: null }; }
    return { error: (data as any).error ?? "로그인에 실패했습니다." };
  }

  async function signUp(email: string, password: string) {
    const { ok, data } = await apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (ok) { setUser(data as AuthUser); return { error: null }; }
    return { error: (data as any).error ?? "회원가입에 실패했습니다." };
  }

  async function signOut() {
    await apiFetch("/auth/signout", { method: "POST" });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
