import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  account_type?: string;
  profile_completed?: boolean;
  profile_photo?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ role: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  const logout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error('Logout request failed', e);
    }
    localStorage.removeItem('token');
    document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax;";
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const currentToken = localStorage.getItem('token');
    const headers = new Headers(options.headers || {});
    
    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }
    
    if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (response.status === 401) {
      localStorage.removeItem('token');
      document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax;";
      setToken(null);
      setUser(null);
      
      const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
      if (!publicPaths.includes(window.location.pathname) && window.location.pathname !== '/') {
        alert('Session Expired');
        window.location.href = '/login';
      }
    }

    return response;
  };

  const login = async (email: string, password: string): Promise<{ role: string }> => {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Invalid Email or Password');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Invalid Email or Password');
    }

    if (data.token) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
    }
    
    setUser(data.user);
    return { role: data.role };
  };

  const refreshUser = async () => {
    try {
      const response = await apiFetch('/api/v1/auth/me');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (e) {
      console.error('Failed to refresh user', e);
    }
  };

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
      } catch (e) {
        console.error('Session restore failed', e);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
