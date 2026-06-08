import { createContext, useContext, useState, type ReactNode } from "react";
import {
  signIn as localSignIn,
  signUp as localSignUp,
  signOut as localSignOut,
  getSession,
  type Session,
} from "@/lib/localAuth";

interface AuthContextValue {
  user: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Session | null>(() => getSession());

  async function signIn(email: string, password: string) {
    const { error, session } = await localSignIn(email, password);
    if (session) setUser(session);
    return { error };
  }

  async function signUp(email: string, password: string) {
    const { error, session } = await localSignUp(email, password);
    if (session) setUser(session);
    return { error };
  }

  function signOut() {
    localSignOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading: false, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
