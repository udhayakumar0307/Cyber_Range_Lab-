import React, { useState } from 'react';
import { UserSidebar } from './UserSidebar';
import { 
  Bell, 
  Search, 
  Menu, 
  ShieldAlert, 
  HelpCircle 
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface UserLayoutProps {
  children?: React.ReactNode;
}

export const UserLayout: React.FC<UserLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(2);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#2D3436] flex">
      {/* Sidebar Navigation */}
      <UserSidebar 
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
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick Global Search Bar */}
            <div className="relative hidden md:block w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search labs, challenges, docs..." 
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20 focus:border-[#0052CC] transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Direct Switch to Admin View */}
            <Link
              to="/admin/dashboard"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-[#0052CC] bg-slate-100 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Switch to Admin View</span>
            </Link>

            {/* Documentation Quick Link */}
            <a
              href="#help"
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors hidden sm:block"
              title="Documentation & Guide"
            >
              <HelpCircle className="w-5 h-5" />
            </a>

            {/* Notifications Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationMenuOpen(!isNotificationMenuOpen)}
                className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="View notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full"></span>
                )}
              </button>

              {isNotificationMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-800">Notifications</span>
                    <button 
                      onClick={() => setUnreadNotifications(0)}
                      className="text-xs text-[#0052CC] hover:underline font-medium"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="px-4 py-3 hover:bg-slate-50 border-b border-slate-50 cursor-pointer">
                      <p className="text-xs font-semibold text-slate-800">New Lab Challenge Assigned</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">"AI Prompt Injection Basics" has been allocated to your cohort.</p>
                      <span className="text-[10px] text-slate-400 mt-1 inline-block">10 mins ago</span>
                    </div>
                    <div className="px-4 py-3 hover:bg-slate-50 border-b border-slate-50 cursor-pointer">
                      <p className="text-xs font-semibold text-slate-800">Weekly Score Standings Ready</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Your cohort's weekly standings have been updated on the leaderboard.</p>
                      <span className="text-[10px] text-slate-400 mt-1 inline-block">2 hours ago</span>
                    </div>
                  </div>
                  <div className="px-4 py-2 text-center border-t border-slate-100">
                    <span className="text-xs font-semibold text-[#0052CC] cursor-pointer">View all alerts</span>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar Badge */}
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3 sm:pl-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                AO
              </div>
              <span className="hidden md:inline-block font-semibold text-sm text-slate-700">
                Alex Operator
              </span>
            </div>
          </div>
        </header>

        {/* Content Body Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* User Footer */}
        <footer className="mt-auto border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 max-w-7xl mx-auto">
            <span>© 2026 CyberRange Platform. Student Console.</span>
            <div className="flex items-center gap-4 text-slate-500 font-medium">
              <a href="#privacy" className="hover:text-[#0052CC]">Privacy Policy</a>
              <a href="#terms" className="hover:text-[#0052CC]">Terms of Service</a>
              <a href="#status" className="hover:text-[#0052CC] flex items-center gap-1">
                <span>System Status</span>
                <span className="w-2 h-2 rounded-full bg-[#28A745]"></span>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
