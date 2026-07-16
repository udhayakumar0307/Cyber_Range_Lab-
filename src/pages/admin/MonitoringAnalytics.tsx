import React, { useState } from 'react';
import { 
  Activity, 
  Trophy, 
  Download, 
  BarChart3, 
  Radio,
  Flame
} from 'lucide-react';

export const MonitoringAnalytics: React.FC = () => {
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');

  // Real-time Top Leaderboard Mock Data
  const topPerformers = [
    { rank: 1, name: 'Sarah Connor', group: 'Red Team Cohort 2026', score: 2450, labsCompleted: 8, badge: '🥇' },
    { rank: 2, name: 'Marcus Vance', group: 'Blue Team Defense Alpha', score: 1980, labsCompleted: 6, badge: '🥈' },
    { rank: 3, name: 'David Kim', group: 'SOC Analysts Batch B', score: 1650, labsCompleted: 5, badge: '🥉' },
    { rank: 4, name: 'Alex Mercer', group: 'SOC Analysts Batch B', score: 1120, labsCompleted: 4, badge: '' },
    { rank: 5, name: 'Elena Rostova', group: 'Red Team Cohort 2026', score: 840, labsCompleted: 3, badge: '' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0052CC] bg-blue-50 px-3 py-1 rounded-full mb-1 border border-blue-100">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            Live WebSocket Telemetry Stream Active
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-7 h-7 text-[#0052CC]" />
            Real-Time Platform Monitoring & Telemetry
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track user score leaderboards, cohort accuracy metrics, and live security lab active engagement.
          </p>
        </div>

        <button
          onClick={() => alert('Exporting platform telemetry performance report...')}
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-2"
        >
          <Download className="w-4 h-4 text-[#0052CC]" />
          Export Analytics CSV Report
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">Cohort Filter:</span>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none"
            >
              <option value="All">All User Cohorts</option>
              <option value="Red Team Cohort 2026">Red Team Cohort 2026</option>
              <option value="Blue Team Defense Alpha">Blue Team Defense Alpha</option>
              <option value="SOC Analysts Batch B">SOC Analysts Batch B</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">Time Window:</span>
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last Quarter</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 font-bold text-[#28A745]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#28A745] animate-ping"></span>
          42 Users Online in Active Sessions
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Real-Time Leaderboard Widget */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Live User Leaderboard Standings
            </h3>
            <span className="text-xs text-purple-600 bg-purple-50 font-bold px-2.5 py-0.5 rounded-full">
              Real-Time Point Ranking
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {topPerformers.map((user) => (
              <div
                key={user.rank}
                className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-800 font-black flex items-center justify-center text-xs">
                    {user.badge ? user.badge : `#${user.rank}`}
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-slate-900 leading-tight">{user.name}</p>
                    <p className="text-xs text-slate-500 font-medium">{user.group}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-500 font-semibold">{user.labsCompleted} labs</span>
                  <span className="font-black text-[#0052CC] text-sm bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                    {user.score.toLocaleString()} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Cohort Comparison & Heatmap Card */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#0052CC]" />
              Cohort Score Comparison
            </h3>
            <p className="text-xs text-slate-500">Average points per group cohort</p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Red Team Cohort 2026</span>
                <span className="text-[#0052CC]">2,150 avg pts</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#0052CC] rounded-full" style={{ width: '90%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Blue Team Defense Alpha</span>
                <span className="text-[#28A745]">1,840 avg pts</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#28A745] rounded-full" style={{ width: '75%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>SOC Analysts Batch B</span>
                <span className="text-[#6F42C1]">1,420 avg pts</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#6F42C1] rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
            <span className="font-bold flex items-center gap-1">
              <Flame className="w-4 h-4 text-amber-600" /> High Activity Peak Detected
            </span>
            <p className="text-[11px] leading-tight text-amber-700">
              Red Team Cohort 2026 has solved 45 security challenges in the last 2 hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
