import React, { useState } from 'react';
import { MetricsCard } from '../../components/admin/MetricsCard';
import { 
  Users, 
  FlaskConical, 
  Trophy, 
  UsersRound, 
  UserPlus, 
  PlusCircle, 
  Store, 
  Sliders, 
  TrendingUp, 
  ArrowUpRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { OperationalActivity } from '../../types/admin';

export const AdminDashboard: React.FC = () => {
  const [activityFilter, setActivityFilter] = useState<'all' | 'success' | 'warning'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mock initial activities
  const [activities] = useState<OperationalActivity[]>([
    {
      id: 'act-1',
      timestamp: '2 mins ago',
      user: { name: 'Sarah Connor', email: 's.connor@cybersec.io' },
      action: 'Completed Lab Challenge 4/5',
      target: 'AWS Cloud Penetration Testing',
      status: 'success',
    },
    {
      id: 'act-2',
      timestamp: '12 mins ago',
      user: { name: 'Marcus Vance', email: 'm.vance@defense.org' },
      action: 'Allocated Lab to Group',
      target: 'Red Team Cohort 2026',
      status: 'info',
    },
    {
      id: 'act-3',
      timestamp: '25 mins ago',
      user: { name: 'Alex Mercer', email: 'alex@soc-team.com' },
      action: 'Failed Flag Submission Threshold',
      target: 'Network Packet Forensics Level 2',
      status: 'warning',
    },
    {
      id: 'act-4',
      timestamp: '1 hour ago',
      user: { name: 'Elena Rostova', email: 'elena@cyber-academy.edu' },
      action: 'Bulk Imported 25 Users',
      target: 'Group: Junior Analysts B',
      status: 'success',
    },
    {
      id: 'act-5',
      timestamp: '2 hours ago',
      user: { name: 'David Kim', email: 'dkim@enterprise.net' },
      action: 'Purchased Lab License',
      target: 'Kubernetes Exploitation Masterclass',
      status: 'success',
    },
  ]);

  const handleRefreshFeed = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const filteredActivities = activities.filter(
    (item) => activityFilter === 'all' || item.status === activityFilter
  );

  return (
    <div className="space-y-8">
      {/* Top Banner Greeting */}
      <div className="bg-gradient-to-r from-blue-900 via-[#0052CC] to-indigo-800 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <ShieldAlert className="w-80 h-80 text-white" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-blue-100 mb-3 border border-white/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Live Cyber Range Environment Active
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Security Admin Dashboard
          </h1>
          <p className="mt-2 text-sm sm:text-base text-blue-100/90 leading-relaxed font-normal">
            Manage training labs, assign security challenges to user groups, monitor live engagement, and manage procurement.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/admin/labs"
              className="bg-white text-[#0052CC] hover:bg-blue-50 font-bold px-4 py-2.5 rounded-lg text-sm transition-colors shadow-sm inline-flex items-center gap-2"
            >
              <Store className="w-4 h-4" />
              Browse Lab Marketplace
            </Link>
            <Link
              to="/admin/users"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/30 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Manage Users & Groups
            </Link>
          </div>
        </div>
      </div>

      {/* 2.1 Metric Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>Platform Overview Metrics</span>
          </h2>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            Real-Time Telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricsCard
            title="Total Platform Users"
            value="1,482"
            change="+12.4%"
            isPositive={true}
            period="vs last 30 days"
            icon={Users}
            colorTheme="blue"
          />
          <MetricsCard
            title="Active Security Labs"
            value="38 Labs"
            change="+4 Purchased"
            isPositive={true}
            period="Active in Inventory"
            icon={FlaskConical}
            colorTheme="green"
          />
          <MetricsCard
            title="Avg User Score"
            value="1,840 pts"
            change="+8.2%"
            isPositive={true}
            period="Overall completion rate"
            icon={Trophy}
            colorTheme="purple"
          />
          <MetricsCard
            title="Assigned Groups"
            value="24 Groups"
            change="100% Active"
            isPositive={true}
            period="Across all org units"
            icon={UsersRound}
            colorTheme="orange"
          />
        </div>
      </div>

      {/* 2.2 Quick Actions Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Quick Administrative Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/admin/users"
            className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-200 group transition-all"
          >
            <div className="p-2 rounded-lg bg-blue-100 text-[#0052CC] group-hover:scale-105 transition-transform">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 group-hover:text-[#0052CC]">Add / Import User</p>
              <p className="text-xs text-slate-500">Single or CSV batch</p>
            </div>
          </Link>

          <Link
            to="/admin/allocations"
            className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-200 group transition-all"
          >
            <div className="p-2 rounded-lg bg-emerald-100 text-[#28A745] group-hover:scale-105 transition-transform">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 group-hover:text-[#28A745]">Allocate Labs</p>
              <p className="text-xs text-slate-500">Assign labs to groups</p>
            </div>
          </Link>

          <Link
            to="/admin/labs"
            className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 hover:bg-purple-50/70 border border-slate-200 hover:border-purple-200 group transition-all"
          >
            <div className="p-2 rounded-lg bg-purple-100 text-[#6F42C1] group-hover:scale-105 transition-transform">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 group-hover:text-[#6F42C1]">Procure New Labs</p>
              <p className="text-xs text-slate-500">Marketplace catalog</p>
            </div>
          </Link>

          <Link
            to="/admin/labs/control"
            className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 hover:bg-amber-50/70 border border-slate-200 hover:border-amber-200 group transition-all"
          >
            <div className="p-2 rounded-lg bg-amber-100 text-[#FFA500] group-hover:scale-105 transition-transform">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 group-hover:text-[#FFA500]">Lab Control Panel</p>
              <p className="text-xs text-slate-500">Start / stop instances</p>
            </div>
          </Link>
        </div>
      </div>

      {/* 2.3 Interactive Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Growth & Lab Session Trajectory Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">
                User Platform Engagement & Active Sessions
              </h3>
              <p className="text-xs text-slate-500">Monthly training activity volume</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0052CC]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0052CC]"></span> Active Users
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#28A745]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#28A745]"></span> Completed Labs
              </span>
            </div>
          </div>

          {/* SVG Line & Bar Composite Visualization */}
          <div className="h-64 w-full relative pt-4 pb-2">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200">
              {/* Background Horizontal Gridlines */}
              <line x1="0" y1="40" x2="500" y2="40" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="160" x2="500" y2="160" stroke="#f1f5f9" strokeWidth="1" />

              {/* Bar Chart Graphics (Completed Labs) */}
              <rect x="30" y="100" width="24" height="60" fill="#28A745" rx="4" opacity="0.85" />
              <rect x="110" y="80" width="24" height="80" fill="#28A745" rx="4" opacity="0.85" />
              <rect x="190" y="50" width="24" height="110" fill="#28A745" rx="4" opacity="0.85" />
              <rect x="270" y="65" width="24" height="95" fill="#28A745" rx="4" opacity="0.85" />
              <rect x="350" y="40" width="24" height="120" fill="#28A745" rx="4" opacity="0.85" />
              <rect x="430" y="25" width="24" height="135" fill="#28A745" rx="4" opacity="0.85" />

              {/* Smooth Curved Line (Active Users) */}
              <path
                d="M 42 120 Q 120 70 202 55 T 362 35 T 442 20"
                fill="none"
                stroke="#0052CC"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Data points */}
              <circle cx="42" cy="120" r="4.5" fill="#0052CC" stroke="#ffffff" strokeWidth="2" />
              <circle cx="122" cy="85" r="4.5" fill="#0052CC" stroke="#ffffff" strokeWidth="2" />
              <circle cx="202" cy="55" r="4.5" fill="#0052CC" stroke="#ffffff" strokeWidth="2" />
              <circle cx="282" cy="68" r="4.5" fill="#0052CC" stroke="#ffffff" strokeWidth="2" />
              <circle cx="362" cy="35" r="4.5" fill="#0052CC" stroke="#ffffff" strokeWidth="2" />
              <circle cx="442" cy="20" r="4.5" fill="#0052CC" stroke="#ffffff" strokeWidth="2" />
            </svg>

            {/* X-Axis Labels */}
            <div className="flex justify-between text-xs font-semibold text-slate-400 mt-2 px-2">
              <span>Feb</span>
              <span>Mar</span>
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
              <span>Jul</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1 text-[#28A745] font-semibold">
              <TrendingUp className="w-4 h-4" /> 18% growth over target threshold
            </span>
            <Link to="/admin/monitoring" className="text-[#0052CC] hover:underline font-bold inline-flex items-center gap-1">
              Full Analytics Report <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Category Completion Distribution Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Lab Category Performance
            </h3>
            <p className="text-xs text-slate-500">Completion rate across domains</p>
          </div>

          <div className="space-y-4 my-6">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-700">Web Application Security</span>
                <span className="text-[#0052CC]">88%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#0052CC] rounded-full" style={{ width: '88%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-700">Cloud Infrastructure Security</span>
                <span className="text-[#28A745]">74%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#28A745] rounded-full" style={{ width: '74%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-700">Network Forensics & SOC</span>
                <span className="text-[#6F42C1]">62%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#6F42C1] rounded-full" style={{ width: '62%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-700">Reverse Engineering & Malware</span>
                <span className="text-[#FFA500]">45%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#FFA500] rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-[#0052CC] font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>Highest user engagement in Web Security domain.</span>
          </div>
        </div>
      </div>

      {/* 2.4 Operational Real-Time Activity Log Feed */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#0052CC]" />
              Real-Time Security Activity Feed
            </h3>
            <p className="text-xs text-slate-500">Live operational events across all user sessions</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setActivityFilter('all')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activityFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All Events
              </button>
              <button
                onClick={() => setActivityFilter('success')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activityFilter === 'success'
                    ? 'bg-white text-[#28A745] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Success
              </button>
              <button
                onClick={() => setActivityFilter('warning')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activityFilter === 'warning'
                    ? 'bg-white text-amber-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Alerts
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefreshFeed}
              className="p-2 text-slate-500 hover:text-[#0052CC] hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors"
              title="Refresh log feed"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#0052CC]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Activity Items List */}
        <div className="divide-y divide-slate-100 mt-2">
          {filteredActivities.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No events match the selected status filter.
            </div>
          ) : (
            filteredActivities.map((act) => (
              <div
                key={act.id}
                className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xs ${
                      act.status === 'success'
                        ? 'bg-[#28A745]'
                        : act.status === 'warning'
                        ? 'bg-[#FFA500]'
                        : 'bg-[#0052CC]'
                    }`}
                  >
                    {act.user.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{act.user.name}</span>
                      <span className="text-xs text-slate-400">({act.user.email})</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      <span className="font-semibold text-slate-700">{act.action}</span> —{' '}
                      <span className="text-slate-500">{act.target}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      act.status === 'success'
                        ? 'bg-emerald-50 text-[#28A745] border border-emerald-200'
                        : act.status === 'warning'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-blue-50 text-[#0052CC] border border-blue-200'
                    }`}
                  >
                    {act.status === 'success' && <CheckCircle2 className="w-3 h-3" />}
                    {act.status === 'warning' && <AlertTriangle className="w-3 h-3" />}
                    {act.status === 'info' && <Clock className="w-3 h-3" />}
                    {act.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-400 font-medium hidden sm:inline-block">
                    {act.timestamp}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
