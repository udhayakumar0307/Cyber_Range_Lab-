import React, { useState } from 'react';
import { 
  Activity, 
  Trophy, 
  Download, 
  BarChart3, 
  Flame,
  Users
} from 'lucide-react';

export const MonitoringAnalytics: React.FC = () => {
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchLeaderboard = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('/api/v1/reporting/leaderboard?type=global&page=1&limit=5', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.ranks)) {
            setTopPerformers(data.ranks.map((r: any, idx: number) => ({
              rank: idx + 1,
              name: r.name || r.email || `User #${r.user_id}`,
              group: r.college || 'Enterprise Cohort',
              score: r.score || 0,
              labsCompleted: r.labs_completed || 0,
              badge: idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : ''
            })));
          }
        }
      } catch (err) {
        console.error('Error fetching leaderboard analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#0052CC] dark:text-blue-400" />
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Platform Monitoring & Analytics</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time telemetry on student lab engagement, cohort completion trajectory, and score rankings.
          </p>
        </div>

        <button
          onClick={() => alert('Exporting platform telemetry performance report...')}
          className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#0052CC] dark:text-blue-400" />
          Export Analytics CSV Report
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 dark:text-slate-300">Cohort Filter:</span>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-semibold focus:outline-none"
            >
              <option value="All">All User Cohorts</option>
              <option value="Red Team Cohort 2026">Red Team Cohort 2026</option>
              <option value="Blue Team Defense Alpha">Blue Team Defense Alpha</option>
              <option value="SOC Analysts Batch B">SOC Analysts Batch B</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 dark:text-slate-300">Time Window:</span>
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-semibold focus:outline-none"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last Quarter</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 font-bold text-slate-500 dark:text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
          Runtime telemetry unavailable
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Real-Time Leaderboard Widget */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Live User Leaderboard Standings
            </h3>
            <span className="text-xs text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 font-bold px-2.5 py-0.5 rounded-full border border-purple-100 dark:border-purple-800">
              Real-Time Point Ranking
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {topPerformers.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-medium">
                No leaderboard standings data available.
              </div>
            ) : (
              topPerformers.map((user) => (
                <div
                  key={user.rank}
                  className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-black flex items-center justify-center text-xs">
                      {user.badge ? user.badge : `#${user.rank}`}
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-tight">{user.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{user.group}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">{user.labsCompleted} labs</span>
                    <span className="font-black text-[#0052CC] dark:text-blue-400 text-sm bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-lg border border-blue-100 dark:border-blue-800">
                      {user.score.toLocaleString()} pts
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Cohort Completion Distribution */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#0052CC] dark:text-blue-400" />
              Cohort Completion Progress
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Average lab module completion rate</p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-extrabold mb-1">
                <span className="text-slate-800 dark:text-slate-200">Red Team Cohort 2026</span>
                <span className="text-[#0052CC] dark:text-blue-400">84%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#0052CC] rounded-full" style={{ width: '84%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-extrabold mb-1">
                <span className="text-slate-800 dark:text-slate-200">Blue Team Defense Alpha</span>
                <span className="text-[#28A745] dark:text-emerald-400">72%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#28A745] rounded-full" style={{ width: '72%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-extrabold mb-1">
                <span className="text-slate-800 dark:text-slate-200">SOC Analysts Batch B</span>
                <span className="text-[#6F42C1] dark:text-purple-400">59%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#6F42C1] rounded-full" style={{ width: '59%' }}></div>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-200 space-y-1">
            <span className="font-bold flex items-center gap-1">
              <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400" /> High Activity Peak Detected
            </span>
            <p className="text-[11px] leading-tight text-amber-700 dark:text-amber-400/80">
              Red Team Cohort 2026 has solved 45 security challenges in the last 2 hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
