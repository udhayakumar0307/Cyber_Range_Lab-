import React, { useState, useEffect } from 'react';
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

  const [totalUsers, setTotalUsers] = useState(0);
  const [totalLabs, setTotalLabs] = useState(0);
  const [totalGroups, setTotalGroups] = useState(0);
  const [purchasedLabsCount, setPurchasedLabsCount] = useState(0);
  const [activities, setActivities] = useState<OperationalActivity[]>([]);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('token');
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [statsRes, lRes] = await Promise.all([
        fetch('/api/v1/admin/stats', { headers }),
        fetch('/api/v1/labs')
      ]);

      if (statsRes && statsRes.ok) {
        const stats = await statsRes.json();
        setTotalUsers(stats.total_users || 0);
        setTotalGroups(stats.total_groups || 0);
        setPurchasedLabsCount(stats.purchased_labs || 0);
        if (stats.recent_activity && Array.isArray(stats.recent_activity)) {
          const mapped = stats.recent_activity.map((log: any) => ({
            id: `act-${log?.id || Math.random()}`,
            timestamp: log?.time || "Recently",
            user: { name: log?.user || "Admin", email: "admin@cyberrange.in" },
            action: log?.action || "System Event",
            target: "Platform",
            status: (log?.status?.toLowerCase() === 'failed' ? 'warning' : 'success') as any
          }));
          setActivities(mapped);
        }
      }

      if (lRes && lRes.ok) {
        const lData = await lRes.json();
        if (Array.isArray(lData)) setTotalLabs(lData.length);
      }
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefreshFeed = () => {
    setIsRefreshing(true);
    fetchDashboardData().then(() => {
      setTimeout(() => setIsRefreshing(false), 500);
    });
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
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>Platform Overview Metrics</span>
          </h2>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
            Real-Time Telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricsCard
            title="Total Platform Users"
            value={totalUsers > 0 ? `${totalUsers} Users` : "Active Users"}
            change="Live DB"
            isPositive={true}
            period="Registered Users"
            icon={Users}
            colorTheme="blue"
          />
          <MetricsCard
            title="Available Security Labs"
            value={totalLabs > 0 ? `${totalLabs} Labs` : "2 Labs"}
            change={`${purchasedLabsCount} Purchased`}
            isPositive={true}
            period="Active Catalog"
            icon={FlaskConical}
            colorTheme="green"
          />
          <MetricsCard
            title="Purchased Licenses"
            value={purchasedLabsCount > 0 ? `${purchasedLabsCount} Active` : "1 Active"}
            change="Enterprise"
            isPositive={true}
            period="Organization seat pool"
            icon={Trophy}
            colorTheme="purple"
          />
          <MetricsCard
            title="Assigned Groups"
            value={totalGroups > 0 ? `${totalGroups} Cohorts` : "Groups Active"}
            change="PostgreSQL"
            isPositive={true}
            period="Active user cohorts"
            icon={UsersRound}
            colorTheme="amber"
          />
        </div>
      </div>

      {/* 2.2 Quick Actions Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-3">
          Quick Administrative Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/admin/users"
            className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-200 group transition-all"
          >
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-[#0052CC] dark:text-blue-400 group-hover:scale-105 transition-transform">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-[#0052CC]">Add / Import User</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Single or CSV batch</p>
            </div>
          </Link>

          <Link
            to="/admin/allocations"
            className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-200 group transition-all"
          >
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-[#28A745] dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-[#28A745]">Allocate Labs</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Assign labs to groups</p>
            </div>
          </Link>

          <Link
            to="/admin/labs"
            className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-purple-50/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-200 group transition-all"
          >
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-[#6F42C1] dark:text-purple-400 group-hover:scale-105 transition-transform">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-[#6F42C1]">Procure New Labs</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Marketplace catalog</p>
            </div>
          </Link>

          <Link
            to="/admin/labs/control"
            className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-200 group transition-all"
          >
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-[#FFA500] dark:text-amber-400 group-hover:scale-105 transition-transform">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-[#FFA500]">Lab Control Panel</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Start / stop instances</p>
            </div>
          </Link>
        </div>
      </div>

      {/* 2.3 Interactive Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Growth & Lab Session Trajectory Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                User Platform Engagement & Active Sessions
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Monthly training activity volume</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0052CC] dark:text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0052CC]"></span> Active Users
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#28A745] dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-[#28A745]"></span> Completed Labs
              </span>
            </div>
          </div>

          {/* SVG Line & Bar Composite Visualization */}
          <div className="h-64 w-full relative pt-4 pb-2">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200">
              {/* Background Horizontal Gridlines */}
              <line x1="0" y1="40" x2="500" y2="40" stroke="#334155" strokeWidth="1" opacity="0.3" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="#334155" strokeWidth="1" opacity="0.3" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="#334155" strokeWidth="1" opacity="0.3" />
              <line x1="0" y1="160" x2="500" y2="160" stroke="#334155" strokeWidth="1" opacity="0.3" />

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
            <div className="flex justify-between text-xs font-semibold text-slate-400 dark:text-slate-400 mt-2 px-2">
              <span>Feb</span>
              <span>Mar</span>
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
              <span>Jul</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1 text-[#28A745] dark:text-emerald-400 font-semibold">
              <TrendingUp className="w-4 h-4" /> 18% growth over target threshold
            </span>
            <Link to="/admin/monitoring" className="text-[#0052CC] dark:text-blue-400 hover:underline font-bold inline-flex items-center gap-1">
              Full Analytics Report <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Category Completion Distribution Breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Lab Category Performance
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Completion rate across domains</p>
          </div>

          <div className="space-y-4 my-6">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-700 dark:text-slate-300">Web Application Security</span>
                <span className="text-[#0052CC] dark:text-blue-400">88%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#0052CC] rounded-full" style={{ width: '88%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-700 dark:text-slate-300">Cloud Infrastructure Security</span>
                <span className="text-[#28A745] dark:text-emerald-400">74%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#28A745] rounded-full" style={{ width: '74%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-700 dark:text-slate-300">Network Forensics & SOC</span>
                <span className="text-[#6F42C1] dark:text-purple-400">62%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#6F42C1] rounded-full" style={{ width: '62%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-700 dark:text-slate-300">Reverse Engineering & Malware</span>
                <span className="text-[#FFA500] dark:text-amber-400">45%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#FFA500] rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-800/60 rounded-lg text-xs text-[#0052CC] dark:text-blue-400 font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>Highest user engagement in Web Security domain.</span>
          </div>
        </div>
      </div>

      {/* 2.4 Operational Real-Time Activity Log Feed */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#0052CC] dark:text-blue-400" />
              Real-Time Security Activity Feed
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Live operational events across all user sessions</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setActivityFilter('all')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activityFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                All Events
              </button>
              <button
                onClick={() => setActivityFilter('success')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activityFilter === 'success'
                    ? 'bg-white dark:bg-slate-700 text-[#28A745] dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Success
              </button>
              <button
                onClick={() => setActivityFilter('warning')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activityFilter === 'warning'
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Alerts
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefreshFeed}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-[#0052CC] hover:bg-blue-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
              title="Refresh log feed"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#0052CC]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Activity Items List */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
          {filteredActivities.length === 0 ? (
            <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
              No events match the selected status filter.
            </div>
          ) : (
            filteredActivities.map((act) => (
              <div
                key={act.id}
                className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 px-2 rounded-lg transition-colors"
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
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{act.user.name}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-400">({act.user.email})</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{act.action}</span> —{' '}
                      <span className="text-slate-500 dark:text-slate-400">{act.target}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      act.status === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#28A745] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : act.status === 'warning'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                        : 'bg-blue-50 dark:bg-blue-950/40 text-[#0052CC] dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    {act.status === 'success' && <CheckCircle2 className="w-3 h-3" />}
                    {act.status === 'warning' && <AlertTriangle className="w-3 h-3" />}
                    {act.status === 'info' && <Clock className="w-3 h-3" />}
                    {act.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium hidden sm:inline-block">
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

export default AdminDashboard;
