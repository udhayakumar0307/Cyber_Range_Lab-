import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  Bell, 
  Search, 
  Menu, 
  HelpCircle,
  ChevronDown,
  User as UserIcon,
  Building2,
  CreditCard,
  FlaskConical,
  Sun,
  Moon,
  Monitor,
  Shield,
  Settings,
  LogOut
} from 'lucide-react';

interface AdminLayoutProps {
  children?: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return 'AD';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  const [unreadNotifications, setUnreadNotifications] = useState(3);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-[#0F172A] dark:text-white flex transition-colors duration-200">
      {/* Sidebar Navigation */}
      <AdminSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
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
            <div className="relative hidden md:block w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input 
                type="text" 
                placeholder="Search labs, users, allocations..." 
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-lg text-sm text-[#0F172A] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
              />
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
                onClick={() => setIsNotificationMenuOpen(!isNotificationMenuOpen)}
                className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="View notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white dark:border-[#111827] rounded-full"></span>
                )}
              </button>

              {isNotificationMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-xl shadow-lg py-2 z-50">
                  <div className="px-4 py-2 border-b border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between">
                    <span className="font-bold text-sm text-[#0F172A] dark:text-white">Admin Notifications</span>
                    <button 
                      onClick={() => setUnreadNotifications(0)}
                      className="text-xs text-[#2563EB] hover:underline font-medium"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/50 cursor-pointer">
                      <p className="text-xs font-semibold text-[#0F172A] dark:text-white">New User CSV Batch Imported</p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#CBD5E1] mt-0.5">45 users successfully assigned to Group Cybersecurity Batch A.</p>
                      <span className="text-[10px] text-slate-400 mt-1 inline-block">10 mins ago</span>
                    </div>
                    <div className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/50 cursor-pointer">
                      <p className="text-xs font-semibold text-[#0F172A] dark:text-white">Lab Purchase Completed</p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#CBD5E1] mt-0.5">Purchased Enterprise 1-Year license for AWS Cloud Threat Analysis.</p>
                      <span className="text-[10px] text-slate-400 mt-1 inline-block">1 hour ago</span>
                    </div>
                  </div>
                  <div className="px-4 py-2 text-center border-t border-[#E2E8F0] dark:border-[#334155]">
                    <span className="text-xs font-semibold text-[#2563EB] cursor-pointer">View all alerts</span>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar & Dropdown */}
            <div className="relative border-l border-[#E2E8F0] dark:border-[#334155] pl-3 sm:pl-4">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none"
              >
                <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {getInitials(user?.name || 'Security Admin')}
                </div>
                <span className="hidden md:inline-block font-semibold text-sm text-[#0F172A] dark:text-white">
                  {user?.name || 'Security Admin'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-xl shadow-xl py-2 z-50 animate-in fade-in duration-150">
                  <div className="px-4 py-3 border-b border-[#E2E8F0] dark:border-[#334155]">
                    <p className="font-bold text-sm text-[#0F172A] dark:text-white truncate">{user?.name || 'Admin Lead'}</p>
                    <p className="text-xs text-[#64748B] dark:text-[#CBD5E1] truncate">{user?.email || 'admin@cyberrange.in'}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold text-[#2563EB] bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                      System Administrator
                    </span>
                  </div>

                  <div className="py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <button
                      onClick={() => { setIsProfileMenuOpen(false); navigate('/admin/profile'); }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      <span>My Profile</span>
                    </button>

                    <button
                      onClick={() => { setIsProfileMenuOpen(false); navigate('/admin/profile?tab=org'); }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                    >
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span>Organization Profile</span>
                    </button>

                    <button
                      onClick={() => { setIsProfileMenuOpen(false); navigate('/admin/payments'); }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                    >
                      <CreditCard className="w-4 h-4 text-slate-400" />
                      <span>Payment History</span>
                    </button>

                    <button
                      onClick={() => { setIsProfileMenuOpen(false); navigate('/admin/purchased-labs'); }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                    >
                      <FlaskConical className="w-4 h-4 text-slate-400" />
                      <span>Purchased Labs</span>
                    </button>

                    <button
                      onClick={() => { setIsProfileMenuOpen(false); setIsNotificationMenuOpen(true); }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                    >
                      <Bell className="w-4 h-4 text-slate-400" />
                      <span>Notifications</span>
                    </button>

                    {/* Single Clean Theme Toggle Action */}
                    <button
                      onClick={async () => {
                        await toggleTheme();
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                    >
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
                    </button>

                    <button
                      onClick={() => { setIsProfileMenuOpen(false); navigate('/admin/profile?tab=security'); }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                    >
                      <Shield className="w-4 h-4 text-slate-400" />
                      <span>Security</span>
                    </button>

                    <button
                      onClick={() => { setIsProfileMenuOpen(false); navigate('/admin/settings'); }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Settings</span>
                    </button>

                    <button
                      onClick={logout}
                      className="w-full px-4 py-2.5 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2.5 border-t border-slate-100 dark:border-slate-800 mt-1"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
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

        {/* Admin Footer */}
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
};
