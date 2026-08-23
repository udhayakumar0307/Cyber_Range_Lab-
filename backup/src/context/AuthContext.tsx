import React, {
  createContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

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

export interface AuthorizationInfo {
  user_id: number;
  legacy_role: string;
  roles: string[];
  capabilities: string[];
  scopes: Array<{
    binding_id: number;
    role: string;
    scope_type: 'GLOBAL' | 'ORGANIZATION' | 'COLLEGE' | 'UNSCOPED';
    organization_id?: number | null;
    college_id?: number | null;
  }>;
  professor_profile?: {
    id: number;
    department?: string | null;
    academic_title?: string | null;
    employee_id?: string | null;
    office?: string | null;
  } | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  authorization: AuthorizationInfo | null;
  hasCapability: (capability: string) => boolean;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean,
    portal?: 'student' | 'admin',
    otpCode?: string
  ) => Promise<{ role: string; user?: any; status?: string; message?: string }>;
  setSessionToken: (token: string, userData?: User) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [authorization, setAuthorization] = useState<AuthorizationInfo | null>(null);
  const tokenRef = useRef<string | null>(token);
  const API_BASE = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const loadAuthorization = useCallback(async (explicitToken?: string | null) => {
    const currentToken = explicitToken ?? tokenRef.current;
    if (!currentToken) {
      setAuthorization(null);
      return null;
    }
    try {
      const response = await fetch(`${API_BASE}/api/v1/rbac/me`, {
        headers: { Authorization: `Bearer ${currentToken}` },
        credentials: 'include',
      });
      if (!response.ok) {
        setAuthorization(null);
        return null;
      }
      const data = (await response.json()) as AuthorizationInfo;
      setAuthorization(data);
      return data;
    } catch {
      setAuthorization(null);
      return null;
    }
  }, [API_BASE]);

  const setSessionToken = useCallback(async (newToken: string, userData?: User) => {
    localStorage.setItem('token', newToken);
    tokenRef.current = newToken;
    setToken(newToken);
    if (userData) setUser(userData);
    await loadAuthorization(newToken);
  }, [loadAuthorization]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Logout errors are non-fatal.
    }
    localStorage.removeItem('token');
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax;';
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    setAuthorization(null);
    window.location.href = '/login';
  }, [API_BASE]);

  const apiFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const currentToken = tokenRef.current;
    const headers = new Headers(options.headers || {});
    if (currentToken) headers.set('Authorization', `Bearer ${currentToken}`);
    if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (response.status === 401 && url.includes('/auth/me')) {
      localStorage.removeItem('token');
      document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax;';
      tokenRef.current = null;
      setToken(null);
      setUser(null);
      setAuthorization(null);

      const publicPaths = [
        '/login', '/register', '/forgot-password', '/reset-password',
        '/admin/login', '/admin/register', '/admin/forgot-password', '/admin/reset-password',
        '/adminform', '/admin-login', '/system',
      ];
      const isPublicPath = publicPaths.some((path) =>
        window.location.pathname.toLowerCase().startsWith(path)
      );
      if (!isPublicPath && window.location.pathname !== '/') {
        window.location.href = '/login';
      }
    }
    return response;
  }, [API_BASE]);

  const login = useCallback(async (
    email: string,
    password: string,
    rememberMe: boolean = false,
    portal: 'student' | 'admin' = 'student',
    otpCode?: string
  ): Promise<{ role: string; user: any; status?: string; message?: string }> => {
    const endpoint = portal === 'admin' ? '/api/v1/auth/admin-login' : '/api/v1/auth/student-login';
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        remember_me: rememberMe,
        portal,
        otp_code: otpCode,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.detail || errData.message || 'Invalid Email or Password';
      throw new Error(typeof msg === 'string' ? msg : 'Invalid Email or Password');
    }

    const data = await response.json();
    if (data.status === 'otp_required') {
      return { role: '', user: null, status: 'otp_required', message: data.message };
    }
    if (!data.success) throw new Error(data.message || 'Invalid Email or Password');

    if (data.token) {
      localStorage.setItem('token', data.token);
      tokenRef.current = data.token;
      setToken(data.token);
    }
    setUser(data.user);
    await loadAuthorization(data.token || tokenRef.current);
    return { role: data.role, user: data.user, status: 'success' };
  }, [API_BASE, loadAuthorization]);

  const refreshUser = useCallback(async () => {
    try {
      const response = await apiFetch('/api/v1/auth/me');
      if (response.ok) {
        setUser(await response.json());
        await loadAuthorization();
      }
    } catch {
      // Non-fatal.
    }
  }, [apiFetch, loadAuthorization]);

  const hasCapability = useCallback((capability: string) =>
    Boolean(authorization?.capabilities?.includes(capability.toUpperCase())),
  [authorization]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await apiFetch('/api/v1/auth/me');
        if (response.ok) {
          setUser(await response.json());
          await loadAuthorization();
        } else {
          setUser(null);
          setAuthorization(null);
        }
      } catch {
        setUser(null);
        setAuthorization(null);
      } finally {
        setIsLoading(false);
      }
    };
    void checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      authorization,
      hasCapability,
      login,
      setSessionToken,
      logout,
      refreshUser,
      apiFetch,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
