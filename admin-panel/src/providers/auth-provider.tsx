import { createContext, useEffect, useState, type ReactNode } from 'react';
import { api, type AuthUser } from '@/api';

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isClientAdmin: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.auth
      .me()
      .then(setUser)
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (loginValue: string, password: string) => {
    const res = await api.auth.login(loginValue, password);
    localStorage.setItem('token', res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isClientAdmin = user?.role === 'client_admin';

  return (
    <AuthContext.Provider value={{ user, loading, isSuperAdmin, isClientAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
