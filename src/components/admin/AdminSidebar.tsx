import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  Users, 
  UsersRound, 
  Layers, 
  Sliders, 
  Activity, 
  Settings,
  Shield,
  ChevronRight,
  LogOut,
  Calendar,
  Trophy
} from 'lucide-react';

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen = true, onClose }) => {
  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Lab Marketplace', path: '/admin/labs', icon: Store, badge: 'New' },
    { name: 'Lab Scheduler', path: '/admin/scheduler', icon: Calendar },
    { name: 'CTF Event Hub', path: '/admin/ctf', icon: Trophy, badge: 'CTF' },
    { name: 'User Management', path: '/admin/users', icon: Users },
    { name: 'Group Management', path: '/admin/groups', icon: UsersRound },
    { name: 'Lab Allocations', path: '/admin/allocations', icon: Layers },
    { name: 'Lab Control Panel', path: '/admin/labs/control', icon: Sliders },
    { name: 'Monitoring & Analytics', path: '/admin/monitoring', icon: Activity, pulse: true },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col justify-between shadow-sm`}>
      {/* Brand Header */}
      <div>
        <div className="h-16 flex items-center px-6 border-b border-slate-100 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0052CC] shadow-sm relative group">
              <Shield className="w-6 h-6 animate-shield" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#28A745]"></span>
              </span>
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-base leading-none">CyberRange</h1>
              <span className="text-xs font-semibold text-[#0052CC] bg-blue-50 px-2 py-0.5 rounded-full mt-1 inline-block">
                Admin Portal
              </span>
            </div>
          </div>

          {onClose && (
            <button 
              onClick={onClose}
              className="lg:hidden text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
          <div className="px-3 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Admin Management
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-50 text-[#0052CC] font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </div>

                <div className="flex items-center gap-1">
                  {item.pulse && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  )}
                  {item.badge && (
                    <span className="text-[10px] font-bold bg-purple-100 text-[#6F42C1] px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                </div>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Admin User Footer Profile */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#0052CC] text-white flex items-center justify-center font-bold text-sm shadow-sm">
              AD
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-800 truncate">Admin Lead</p>
              <p className="text-xs text-slate-500 truncate">admin@cyberrange.io</p>
            </div>
          </div>
          <button 
            title="Log out" 
            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
