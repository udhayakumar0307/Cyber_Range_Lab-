import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('cyberrange-theme') || localStorage.getItem('theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  // Helper to check if current URL is an auth route
  const isAuthRoute = () => {
    const path = window.location.pathname.toLowerCase();
    return (
      path === '/' ||
      path.includes('/login') ||
      path.includes('/register') ||
      path.includes('/forgot-password') ||
      path.includes('/reset-password') ||
      path.includes('/verify-otp') ||
      path.includes('/onboarding') ||
      path.includes('/adminform') ||
      path.includes('/admin/login') ||
      path.includes('/admin/register') ||
      path.includes('/admin/forgot-password')
    );
  };

  // Apply root DOM class on theme state change or route navigation
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');

      const token = localStorage.getItem('token');
      // Auth pages must ALWAYS open in Light Theme
      if (!token || isAuthRoute()) {
        root.classList.add('light');
      } else {
        root.classList.add(theme);
      }
    };

    applyTheme();
    window.addEventListener('popstate', applyTheme);
    return () => window.removeEventListener('popstate', applyTheme);
  }, [theme]);

  // Fetch initial theme preference from database when token exists
  useEffect(() => {
    const fetchUserTheme = async () => {
      const token = localStorage.getItem('token');
      if (!token || isAuthRoute()) return;

      try {
        const res = await fetch('/api/v1/user/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.theme && (data.theme === 'dark' || data.theme === 'light')) {
            setThemeState(data.theme as ThemeMode);
            localStorage.setItem('cyberrange-theme', data.theme);
            localStorage.setItem('theme', data.theme);
          }
        }
      } catch (err) {
        console.error('Error fetching theme from database:', err);
      }
    };

    fetchUserTheme();
  }, []);

  const setTheme = async (newTheme: ThemeMode) => {
    const validTheme: ThemeMode = newTheme === 'dark' ? 'dark' : 'light';
    setThemeState(validTheme);
    localStorage.setItem('cyberrange-theme', validTheme);
    localStorage.setItem('theme', validTheme);

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await fetch('/api/v1/user/appearance', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ theme: validTheme })
      });
    } catch (err) {
      console.error('Error saving theme to database:', err);
    }
  };

  const toggleTheme = async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    await setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

