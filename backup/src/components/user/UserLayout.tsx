import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { UserSidebar } from './UserSidebar';
import { useAuth } from '../../context';
import { useTheme } from '../../context/ThemeContext';
import { 
  fetchNotifications, 
  markNotificationAsRead, 
  clearAllNotifications, 
  setupNotificationWebSocket, 
  type NotificationItem 
} from '../../services/notificationService';
import { 
  Bell, 
  Search, 
  Menu, 
  HelpCircle,
  User,
  BarChart2,
  Award,
  Settings,
  Moon,
  Sun,
  ShieldCheck,
  LogOut,
  ChevronDown,
  ShoppingCart
} from 'lucide-react';

interface UserLayoutProps {
  children?: React.ReactNode;
}

// OPTIMIZATION 3: React.memo prevents re-render when parent re-renders with same props.
export const UserLayout: React.FC<UserLayoutProps> = memo(({ children }) => {
  const { user, logout, apiFetch } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cartItemCount, setCartItemCount] = useState(0);

  const fetchCartCount = useCallback(async () => {
    try {
      if (user?.auth_type === 'SSO') {
        setCartItemCount(0);
        return;
      }
      const res = await apiFetch('/api/v1/cart');
      if (res.ok) {
        const data = await res.json();
        setCartItemCount(data.item_count || 0);
      }
    } catch (e) {
      console.error(e);
    }
  }, [user, apiFetch]);

  useEffect(() => {
    fetchCartCount();
    window.addEventListener('cart-updated', fetchCartCount);
    return () => {
      window.removeEventListener('cart-updated', fetchCartCount);
    };
  }, [fetchCartCount]);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await fetchNotifications({ limit: 10 });
      setNotifications(data.items || []);
      setUnreadCount(data.unread_count || 0);
    } catch (e) {
      console.error('Failed to load user notifications', e);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const cleanupWs = setupNotificationWebSocket((newNotif) => {
      setNotifications(prev => [newNotif, ...prev]);
      setUnreadCount(prev => prev + 1);
    });
    return () => cleanupWs();
  }, [loadNotifications]);

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.read) {
      await markNotificationAsRead(item.id);
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setIsNotificationMenuOpen(false);
    if (item.action_url) {
      navigate(item.action_url);
    }
  };

  const handleClearAll = async () => {
    await clearAllNotifications();
    setNotifications([]);
    setUnreadCount(0);
    setIsNotificationMenuOpen(false);
  };

  // useCallback: stable reference — avoids re-creating on every render
  const getInitials = useCallback((name: string) => {
    if (!name) return '';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, []);

  // useCallback: stable handler passed to UserSidebar — prevents sidebar re-render
  const handleSidebarClose = useCallback(() => setIsSidebarOpen(false), []);

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const globalSearchQuery = searchParams.get('search') || searchParams.get('q') || '';

  const handleGlobalSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (location.pathname !== '/labs') {
      if (val.trim()) {
        navigate(`/labs?search=${encodeURIComponent(val)}`);
      } else {
        navigate('/labs');
      }
    } else {
      if (val.trim()) {
        setSearchParams({ search: val });
      } else {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('search');
        newParams.delete('q');
        setSearchParams(newParams);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-[#0F172A] dark:text-white flex transition-colors duration-200">
      {/* Sidebar Navigation */}
      <UserSidebar
        isOpen={isSidebarOpen}
        onClose={handleSidebarClose}
      />

      {/* Backdrop for Mobile Sidebar */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Main Execution Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-white dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs transition-colors">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick Global Search Bar */}
            <div className="relative hidden md:block w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input 
                type="text" 
                placeholder="Search labs, challenges, docs..." 
                value={globalSearchQuery}
                onChange={handleGlobalSearchChange}
                className="w-full pl-9 pr-8 py-1.5 bg-slate-50 dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-lg text-sm text-[#0F172A] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
              />
              {globalSearchQuery && (
                <button
                  onClick={() => {
                    if (location.pathname === '/labs') {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.delete('search');
                      newParams.delete('q');
                      setSearchParams(newParams);
                    } else {
                      navigate('/labs');
                    }
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold p-0.5 rounded"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Documentation Quick Link */}
            <a
              href="#help"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:block"
              title="Documentation & Guide"
            >
              <HelpCircle className="w-5 h-5" />
            </a>


            {/* Notifications Dropdown */}
            <div className="relative">
              <button 
                onClick={() => {
                  setIsNotificationMenuOpen(!isNotificationMenuOpen);
                  setIsUserDropdownOpen(false);
                }}
                className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="View notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-4 px-1 bg-rose-500 text-white text-[10px] font-extrabold border-2 border-white dark:border-[#111827] rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotificationMenuOpen && (
                <div className="absolute right-0 mt-2 w-88 bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2.5 border-b border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between">
                    <span className="font-bold text-sm text-[#0F172A] dark:text-white">Notifications</span>
                    {notifications.length > 0 && (
                      <button 
                        onClick={handleClearAll}
                        className="text-xs text-[#2563EB] hover:underline font-bold cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-slate-400 font-medium">
                        No active notifications.
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((item) => (
                        <div 
                          key={item.id}
                          onClick={() => handleNotificationClick(item)}
                          className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${!item.read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-[#0F172A] dark:text-white">{item.title}</p>
                            {!item.read && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1"></span>}
                          </div>
                          <p className="text-[11px] text-[#64748B] dark:text-[#CBD5E1] mt-0.5 line-clamp-2 leading-relaxed">{item.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1.5 inline-block font-medium">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="px-4 py-2 text-center border-t border-[#E2E8F0] dark:border-[#334155]">
                    <button 
                      onClick={() => {
                        setIsNotificationMenuOpen(false);
                        navigate('/notifications');
                      }}
                      className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer w-full text-center block"
                    >
                      View all alerts
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* USER AVATAR DROPDOWN MENU */}
            <div className="relative border-l border-[#E2E8F0] dark:border-[#334155] pl-3 sm:pl-4">
              <button
                onClick={() => {
                  setIsUserDropdownOpen(!isUserDropdownOpen);
                  setIsNotificationMenuOpen(false);
                }}
                className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
              >
                <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {getInitials(user?.name ?? '')}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="font-bold text-xs text-[#0F172A] dark:text-white leading-tight">
                    {user?.name ?? ''}
                  </span>
                  <span className="text-[10px] text-[#64748B] dark:text-[#CBD5E1] font-semibold uppercase tracking-wider">
                    {user?.account_type || 'STUDENT'}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
              </button>

              {/* Dropdown Box */}
              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2.5 border-b border-[#E2E8F0] dark:border-[#334155]">
                    <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate">{user?.name ?? ''}</p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#CBD5E1] truncate">{user?.email || 'student@cyberrange.in'}</p>
                  </div>

                  <div className="py-1 text-xs">
                    <button
                      onClick={() => { setIsUserDropdownOpen(false); navigate('/profile'); }}
                      className="w-full px-4 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>My Profile</span>
                    </button>

                    <button
                      onClick={() => { setIsUserDropdownOpen(false); navigate('/statistics'); }}
                      className="w-full px-4 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors"
                    >
                      <BarChart2 className="w-4 h-4 text-slate-400" />
                      <span>My Statistics</span>
                    </button>

                    <button
                      onClick={() => { setIsUserDropdownOpen(false); navigate('/settings'); }}
                      className="w-full px-4 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Settings</span>
                    </button>

                    <button
                      onClick={async () => {
                        await toggleTheme();
                      }}
                      className="w-full px-4 py-2 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        {theme === 'dark' ? (
                          <>
                            <Sun className="w-4 h-4 text-amber-500" />
                            <span>Toggle Light Mode</span>
                          </>
                        ) : (
                          <>
                            <Moon className="w-4 h-4 text-indigo-500" />
                            <span>Toggle Dark Mode</span>
                          </>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={() => { setIsUserDropdownOpen(false); navigate('/settings?tab=security'); }}
                      className="w-full px-4 py-2 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                      <span>Security</span>
                    </button>
                  </div>

                  <div className="border-t border-[#E2E8F0] dark:border-[#334155] pt-1">
                    <button
                      onClick={() => { setIsUserDropdownOpen(false); logout(); }}
                      className="w-full px-4 py-2 flex items-center gap-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold text-xs transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Body Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* User Footer */}
        <footer className="mt-auto border-t border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#111827] py-4 px-6 text-center text-xs text-[#64748B] dark:text-[#CBD5E1] transition-colors">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 max-w-7xl mx-auto">
            <span>© 2026 CyberRange Platform. All rights reserved.</span>
            <div className="flex items-center gap-4 text-[#64748B] dark:text-[#CBD5E1] font-medium">
              <a href="#privacy" className="hover:text-[#2563EB]">Privacy Policy</a>
              <a href="#terms" className="hover:text-[#2563EB]">Terms of Service</a>
              <a href="#status" className="hover:text-[#2563EB] flex items-center gap-1">
                <span>System Status</span>
                <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
});

UserLayout.displayName = 'UserLayout';
