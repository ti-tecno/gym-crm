import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { bootstrapSession, login as svcLogin, loginWithGoogle as svcLoginWithGoogle, logout as svcLogout, register as svcRegister } from '../services/auth.service.js';
import { tokenStore } from '../utils/tokenStore.js';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Intento de sesión al cargar (refresh por cookie httpOnly)
  useEffect(() => {
    (async () => {
      const u = await bootstrapSession();
      setUser(u);
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const u = await svcLogin(email, password);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (payload) => {
    const u = await svcRegister(payload);
    setUser(u);
    return u;
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const u = await svcLoginWithGoogle(credential);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await svcLogout();
    setUser(null);
  }, []);

  const hasRole = useCallback((...roles) => !!user && roles.includes(user.rol), [user]);

  /** Devuelve true si el access token está vigente (con margen de 10s). */
  const isAccessValid = useCallback(() => {
    const t = tokenStore.getAccess();
    if (!t) return false;
    try {
      const { exp } = jwtDecode(t);
      return exp * 1000 - 10_000 > Date.now();
    } catch { return false; }
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, loginWithGoogle, logout, hasRole, isAccessValid }),
    [user, loading, login, register, loginWithGoogle, logout, hasRole, isAccessValid]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}
