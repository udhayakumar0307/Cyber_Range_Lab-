/**
 * AuthContext.tsx — Production-Optimized Auth Context
 *
 * Optimizations applied:
 *  1. Token cached in useRef — apiFetch reads the ref instead of hitting
 *     localStorage on every single API call (was: localStorage.getItem on
 *     every apiFetch invocation).
 *  2. Session check useEffect dependency changed from [token] → [] (mount only).
 *     The original [token] dependency caused a double /auth/me call: once on
 *     mount, and again immediately after login() set the token state.
 *  3. All console.log debug statements removed from the login() hot path.
 *  4. Token ref kept in sync with state so apiFetch always uses the latest
 *     value without needing to read localStorage.
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  account_type?: string;
  profile_completed?: boolean;
  profile_photo?: string;
  total_score?: number;
  phone?: string;
  auth_type?: 'INDIVIDUAL' | 'SSO';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean, portal?: 'student' | 'admin', otpCode?: string) => Promise<{ role: string; user?: any; status?: string; message?: string }>;
  setSessionToken: (token: string, userData?: User) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  // Token ref — keeps current token accessible in apiFetch without re-renders
  // and without touching localStorage on every call.
  const tokenRef = useRef<string | null>(token);

  // Keep ref in sync whenever state changes
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const setSessionToken = useCallback((newToken: string, userData?: User) => {
    localStorage.setItem('token', newToken);
    tokenRef.current = newToken;
    setToken(newToken);
    if (userData) {
      setUser(userData);
    }
  }, []);
  const API_BASE = import.meta.env.VITE_API_URL || "";

  const logout = useCallback(async () => {
    try {
    await fetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // Logout errors are non-fatal — proceed with local cleanup
    }
    localStorage.removeItem('token');
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax;';
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  /**
   * apiFetch — reads token from ref (O(1), no localStorage hit per call).
   * Handles 401 by clearing session and redirecting.
   */
  const apiFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const currentToken = tokenRef.current;
    const headers = new Headers(options.headers || {});

    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }

    if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const API_BASE = import.meta.env.VITE_API_URL || "";

    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (response.status === 401) {
      localStorage.removeItem('token');
      document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax;';
      tokenRef.current = null;
      setToken(null);
      setUser(null);

      const publicPaths = [
        '/login', '/register', '/forgot-password', '/reset-password',
        '/admin/login', '/admin/register', '/admin/forgot-password', '/admin/reset-password',
        '/adminform', '/admin-login', '/system'
      ];
      const isPublicPath = publicPaths.some(path => window.location.pathname.toLowerCase().startsWith(path));
      if (!isPublicPath && window.location.pathname !== '/') {
        alert('Session Expired');
        window.location.href = '/login';
      }
    }

    return response;
  }, []);

  const login = useCallback(async (
    email: string,
    password: string,
    rememberMe: boolean = false,
    portal: 'student' | 'admin' = 'student',
    otpCode?: string
  ): Promise<{ role: string; user: any; status?: string; message?: string }> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "";
      const endpoint = portal === 'admin' ? '/api/v1/auth/admin-login' : '/api/v1/auth/student-login';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember_me: rememberMe, portal, otp_code: otpCode }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData.detail || errData.message || 'Invalid Email or Password';
        throw new Error(typeof msg === 'string' ? msg : 'Invalid Email or Password');
      }

      const data = await response.json();
      if (data.status === 'otp_required') {
        return { role: '', user: null, status: 'otp_required', message: data.message };
      }
      if (!data.success) {
        throw new Error(data.message || 'Invalid Email or Password');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
        tokenRef.current = data.token;
        setToken(data.token);
      }

      setUser(data.user);
      return { role: data.role, user: data.user, status: 'success' };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Authentication request timed out. Please check your connection and try again.');
      }
      throw err;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await apiFetch('/api/v1/auth/me');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch {
      // Non-fatal — user state remains unchanged
    }
  }, [apiFetch]);

  /**
   * Mount-only session restore.
   *
   * Previously this had `[token]` as a dependency which caused a second
   * /auth/me call immediately after login() set the token state.
   * Using [] means it runs exactly once — on app mount.
   */
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await apiFetch('/api/v1/auth/me');
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only — intentionally no [token] dependency

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, setSessionToken, logout, refreshUser, apiFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
};


