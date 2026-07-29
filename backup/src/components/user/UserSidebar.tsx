import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  FlaskConical, 
  Activity, 
  Trophy, 
  Settings, 
  Shield,
  ChevronRight,
  LogOut,
  Flag,
  Puzzle
} from 'lucide-react';

interface UserSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const UserSidebar: React.FC<UserSidebarProps> = ({ isOpen = true, onClose }) => {
  const { user, logout } = useAuth();

  const getInitials = (name: string) => {
    if (!name) return '';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Available Labs', path: '/labs', icon: FlaskConical },
    { name: 'Puzzle', path: '/labs/puzzle-lab', icon: Puzzle },
    { name: 'CTF Competitions', path: '/ctf', icon: Flag },
    { name: 'Progress Tracking', path: '/progress', icon: Activity },
    { name: 'Leaderboards', path: '/leaderboards', icon: Trophy },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-[#111827] border-r border-[#E2E8F0] dark:border-[#334155] transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col justify-between shadow-xs`}>
      {/* Brand Header */}
      <div>
        <div className="h-16 flex items-center px-6 border-b border-[#E2E8F0] dark:border-[#334155] justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-[#2563EB] shadow-xs relative group">
              <Shield className="w-6 h-6 animate-shield" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#10B981]"></span>
              </span>
            </div>
            <div>
              <h1 className="font-bold text-[#0F172A] dark:text-white text-base leading-none">CyberRange</h1>
              <span className="text-[11px] font-semibold text-[#2563EB] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full mt-1 inline-block">
                Student Portal
              </span>
            </div>
          </div>

          {onClose && (
            <button 
              onClick={onClose}
              className="lg:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
          <div className="px-3 pb-2 text-[11px] font-bold text-[#64748B] dark:text-[#CBD5E1] uppercase tracking-wider">
            Student Training
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-50 dark:bg-[#2563EB] text-[#2563EB] dark:text-white font-bold shadow-xs'
                      : 'text-[#64748B] dark:text-[#CBD5E1] hover:bg-[#EFF6FF] dark:hover:bg-[#1E293B] hover:text-[#0F172A] dark:hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </div>

                <div className="flex items-center gap-1">
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                </div>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-[#E2E8F0] dark:border-[#334155] bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 font-medium">
            <div className="w-9 h-9 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {getInitials(user?.name ?? '')}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-[#0F172A] dark:text-white truncate">{user?.name ?? ''}</p>
              <p className="text-xs text-[#64748B] dark:text-[#CBD5E1] truncate">{user?.email ?? ''}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            title="Log out" 
            className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
