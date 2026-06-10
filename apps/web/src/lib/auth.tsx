import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User } from '@concierge-os/shared';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);
const AUTH_STORAGE_KEY = 'concierge-os.auth';

function readStoredAuth(): Pick<AuthState, 'user' | 'token'> {
  const fallback = { user: null, token: null };
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { user?: User; token?: string };
    return {
      user: parsed.user ?? null,
      token: parsed.token ?? null,
    };
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return fallback;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readStoredAuth().user);
  const [token, setToken] = useState<string | null>(() => readStoredAuth().token);

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ token: newToken, user: newUser })
    );
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
