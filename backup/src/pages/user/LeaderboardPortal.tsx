import React, { useState } from 'react';
import { 
  Trophy, 
  Clock, 
  CheckCircle2, 
  User, 
  Crown,
  Medal,
  Users,
  LineChart,
  Activity,
  Flame
} from 'lucide-react';

interface SolvedHistoryItem {
  id: string;
  title: string;
  categoryLabel: string;
  timeTaken: string;
  scoreAwarded: string;
  percentile: number | null;
  completedAt: string;
}

interface GroupStandingItem {
  rank: number;
  name: string;
  email: string;
  solvedCount: number;
  score: number;
  isCurrentUser?: boolean;
}

interface ScoreboardTeam {
  rank: number;
  name: string;
  score: number;
  submissions: number;
  color: string;
  trendPath: string; // Sparkline SVG path
}

export const LeaderboardPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'personal' | 'group' | 'global' | 'scoreboard'>('personal');

  // Page 3.6: Mock Personal Solves Log
  const [personalHistory] = useState<SolvedHistoryItem[]>([
    {
      id: 'lab-3',
      title: 'Linux Privilege Escalation Tactics',
      categoryLabel: 'Linux Infrastructure',
      timeTaken: '2h 15m (vs 3h est)',
      scoreAwarded: '150 / 150 pts',
      percentile: 94,
      completedAt: '2 days ago'
    },
    {
      id: 'lab-1',
      title: 'Active Directory Security Basics',
      categoryLabel: 'Windows Domain Security',
      timeTaken: 'Active (1h 12m spent)',
      scoreAwarded: '50 pts',
      percentile: null,
      completedAt: 'Active'
    },
    {
      id: 'lab-4',
      title: 'SQL Injection Sandbox Range',
      categoryLabel: 'Web Application Security',
      timeTaken: '--',
      scoreAwarded: '0 / 100 pts',
      percentile: null,
      completedAt: 'Not Started'
    }
  ]);

  // Page 3.7: Mock Group Cohort Standings
  const [groupStandings] = useState<GroupStandingItem[]>([
    { rank: 1, name: 'Elena Rostova', email: 'elena@cyberrange.io', solvedCount: 18, score: 2650 },
    { rank: 2, name: 'Alex Operator', email: 'student@cyberrange.io', solvedCount: 16, score: 2450, isCurrentUser: true },
    { rank: 3, name: 'Sarah Connor', email: 's.connor@cyberrange.io', solvedCount: 15, score: 2200 },
    { rank: 4, name: 'Marcus Vance', email: 'm.vance@cyberrange.io', solvedCount: 12, score: 1800 },
    { rank: 5, name: 'David Kim', email: 'dkim@cyberrange.io', solvedCount: 9, score: 1250 }
  ]);

  // Page 3.8: Mock Global Leaderboard Standings
  const [globalStandings] = useState<GroupStandingItem[]>([
    { rank: 1, name: 'John Doe (Admin Target)', email: 'jdoe@enterprise.com', solvedCount: 22, score: 3200 },
    { rank: 2, name: 'Jane Miller', email: 'jmiller@secops.org', solvedCount: 20, score: 2950 },
    { rank: 3, name: 'Elena Rostova', email: 'elena@cyberrange.io', solvedCount: 18, score: 2650 },
    { rank: 4, name: 'Alex Operator', email: 'student@cyberrange.io', solvedCount: 16, score: 2450, isCurrentUser: true },
    { rank: 5, name: 'Viktor Reznov', email: 'reznov@novagroup.ru', solvedCount: 14, score: 2100 }
  ]);

  // Mock data for the new CTF Scoreboard Tab
  const [scoreboardTeams] = useState<ScoreboardTeam[]>([
    { rank: 1, name: 'Carl', score: 3700, submissions: 13, color: '#6F42C1', trendPath: 'M 5 12 L 20 10 L 35 6 L 55 2' },
    { rank: 2, name: 'Marie', score: 3400, submissions: 11, color: '#FFA500', trendPath: 'M 5 13 L 20 12 L 35 8 L 55 4' },
    { rank: 3, name: 'Stephen', score: 3300, submissions: 15, color: '#28A745', trendPath: 'M 5 14 L 20 11 L 35 9 L 55 5' },
    { rank: 4, name: 'Tiffany', score: 3150, submissions: 13, color: '#0052CC', trendPath: 'M 5 13 L 20 13 L 35 10 L 55 7' },
    { rank: 5, name: 'David', score: 3100, submissions: 12, color: '#8884d8', trendPath: 'M 5 14 L 20 12 L 35 11 L 55 8' },
    { rank: 6, name: 'Diane', score: 3000, submissions: 7, color: '#ea73ff', trendPath: 'M 5 15 L 20 13 L 35 12 L 55 8' },
    { rank: 7, name: 'Ralph', score: 3000, submissions: 15, color: '#ff6b6b', trendPath: 'M 5 15 L 20 14 L 35 12 L 55 9' }
  ]);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Training Leaderboards</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Review your solving accuracy history, group standings, and global rankings.
        </p>
      </div>

      {/* Tab Selectors */}
      <div className="flex bg-slate-100 p-1 rounded-xl text-xs sm:text-sm font-bold w-full md:w-max flex-wrap gap-1 md:gap-0">
        <button
          onClick={() => setActiveTab('personal')}
          className={`flex-1 md:flex-none px-4 py-2 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 ${
            activeTab === 'personal'
              ? 'bg-white text-[#0052CC] shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Personal Solves Log</span>
        </button>

        <button
          onClick={() => setActiveTab('group')}
          className={`flex-1 md:flex-none px-4 py-2 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 ${
            activeTab === 'group'
              ? 'bg-white text-[#0052CC] shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Group Standings</span>
        </button>

        <button
          onClick={() => setActiveTab('global')}
          className={`flex-1 md:flex-none px-4 py-2 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 ${
            activeTab === 'global'
              ? 'bg-white text-[#0052CC] shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Global Leaderboard</span>
        </button>

        <button
          onClick={() => setActiveTab('scoreboard')}
          className={`flex-1 md:flex-none px-4 py-2 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 ${
            activeTab === 'scoreboard'
              ? 'bg-white text-[#0052CC] shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LineChart className="w-4 h-4" />
          <span>Scoreboard</span>
        </button>
      </div>

      {/* RENDER VIEW ACCORDING TO ACTIVE TAB */}

      {/* TAB 1: PERSONAL LOG (Page 3.6) */}
      {activeTab === 'personal' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Solved Flags</span>
              <span className="text-lg font-black text-slate-800 mt-1 block">16 Solves</span>
              <span className="text-[9px] text-slate-400 block mt-1">Across all assigned scenarios</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Personal Best Speed</span>
              <span className="text-lg font-black text-slate-800 mt-1 block">24 Minutes</span>
              <span className="text-[9px] text-slate-400 block mt-1">On SQL Injection Sandbox</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Solve Time</span>
              <span className="text-lg font-black text-slate-800 mt-1 block">38 Mins / challenge</span>
              <span className="text-[9px] text-slate-400 block mt-1">Median completion speed</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">First-try Accuracy</span>
              <span className="text-lg font-black text-slate-800 mt-1 block">92% Correct</span>
              <span className="text-[9px] text-emerald-600 font-semibold block mt-1 flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Excellent accuracy rating
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm">Personal Scenario Solves History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 uppercase font-bold border-b border-slate-100">
                    <th className="px-5 py-3">Lab Name</th>
                    <th className="px-5 py-3">Domain Category</th>
                    <th className="px-5 py-3">Time Consumed</th>
                    <th className="px-5 py-3">Points Awarded</th>
                    <th className="px-5 py-3">Speed Percentile</th>
                    <th className="px-5 py-3">Completion Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {personalHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 font-bold text-slate-800">{item.title}</td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600 border-slate-200 font-semibold text-[10px]">
                          {item.categoryLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.timeTaken}</span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800">{item.scoreAwarded}</td>
                      <td className="px-5 py-3.5">
                        {item.percentile ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[10px]">
                            {item.percentile}th percentile (Top {100 - item.percentile}%)
                          </span>
                        ) : (
                          <span className="text-slate-400">--</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-500">{item.completedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GROUP COHORT STANDINGS (Page 3.7) */}
      {activeTab === 'group' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs animate-in fade-in duration-200">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Group Cohort Standings</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Training Cohort: Cybersecurity Batch A</p>
            </div>
            <span className="text-xs font-bold text-[#0052CC] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              Active Standings
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 uppercase font-bold border-b border-slate-100">
                  <th className="px-6 py-3 w-16 text-center">Rank</th>
                  <th className="px-6 py-3">Operator Name</th>
                  <th className="px-6 py-3">Email Address</th>
                  <th className="px-6 py-3 text-center">Flags Solved</th>
                  <th className="px-6 py-3 text-right">Points Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {groupStandings.map((row) => (
                  <tr 
                    key={row.rank} 
                    className={`hover:bg-slate-50/50 ${row.isCurrentUser ? 'bg-blue-50/30 font-bold' : ''}`}
                  >
                    <td className="px-6 py-4 text-center font-extrabold text-slate-800">
                      {row.rank === 1 ? (
                        <span className="text-amber-500">★ 1</span>
                      ) : row.rank === 2 ? (
                        <span className="text-slate-400">2</span>
                      ) : (
                        <span>{row.rank}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-xs ${row.isCurrentUser ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                        {row.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-slate-800 font-bold">{row.name}</span>
                      {row.isCurrentUser && (
                        <span className="text-[9px] font-bold text-[#0052CC] bg-blue-50 px-1.5 py-0.2 rounded-md">YOU</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{row.email}</td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-800">{row.solvedCount} Flags</td>
                    <td className="px-6 py-4 text-right font-extrabold text-[#0052CC]">{row.score} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: GLOBAL STANDINGS (Page 3.8 Podium & Standings) */}
      {activeTab === 'global' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs text-center flex flex-col items-center order-2 md:order-1 border-t-4 border-t-slate-300">
              <Medal className="w-8 h-8 text-slate-400 mb-2" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">2nd Place</span>
              <p className="font-extrabold text-slate-800 text-sm mt-1">Jane Miller</p>
              <span className="text-xs text-slate-500 mt-0.5">jmiller@secops.org</span>
              <span className="text-sm font-extrabold text-[#0052CC] mt-3">2,950 pts</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-300 p-6 shadow-md text-center flex flex-col items-center order-1 md:order-2 ring-2 ring-amber-500/10 border-t-4 border-t-amber-500 relative -translate-y-2">
              <Crown className="w-10 h-10 text-amber-500 mb-2 animate-bounce" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500">Global Champion</span>
              <p className="font-black text-slate-900 text-base mt-1">John Doe</p>
              <span className="text-xs text-slate-500 mt-0.5">jdoe@enterprise.com</span>
              <span className="text-base font-extrabold text-[#0052CC] mt-3">3,200 pts</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs text-center flex flex-col items-center order-3 border-t-4 border-t-amber-600">
              <Medal className="w-8 h-8 text-amber-700 mb-2" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">3rd Place</span>
              <p className="font-extrabold text-slate-800 text-sm mt-1">Elena Rostova</p>
              <span className="text-xs text-slate-500 mt-0.5">elena@cyberrange.io</span>
              <span className="text-sm font-extrabold text-[#0052CC] mt-3">2,650 pts</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm">Global Rankings Standings</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 uppercase font-bold border-b border-slate-100">
                    <th className="px-6 py-3 w-16 text-center">Rank</th>
                    <th className="px-6 py-3">Operator Name</th>
                    <th className="px-6 py-3">Email Address</th>
                    <th className="px-6 py-3 text-center">Flags Solved</th>
                    <th className="px-6 py-3 text-right">Points Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {globalStandings.map((row) => (
                    <tr 
                      key={row.rank} 
                      className={`hover:bg-slate-50/50 ${row.isCurrentUser ? 'bg-blue-50/30 font-bold' : ''}`}
                    >
                      <td className="px-6 py-4 text-center font-extrabold text-slate-800">
                        {row.rank === 1 ? (
                          <span className="text-amber-500">🏆 1</span>
                        ) : row.rank === 2 ? (
                          <span className="text-slate-400">🥈 2</span>
                        ) : row.rank === 3 ? (
                          <span className="text-amber-700">🥉 3</span>
                        ) : (
                          <span>{row.rank}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-xs ${row.isCurrentUser ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                          {row.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-slate-800 font-bold">{row.name}</span>
                        {row.isCurrentUser && (
                          <span className="text-[9px] font-bold text-[#0052CC] bg-blue-50 px-1.5 py-0.2 rounded-md">YOU</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{row.email}</td>
                      <td className="px-6 py-4 text-center font-semibold text-slate-800">{row.solvedCount} Flags</td>
                      <td className="px-6 py-4 text-right font-extrabold text-[#0052CC]">{row.score} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* NEW TAB 4: CTF SCOREBOARD (Side-by-side dashboard design requested by user) */}
      {activeTab === 'scoreboard' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top KPI Cards (Top Score, Leading Team, Total Submissions) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Score</p>
                <p className="text-2xl font-black text-slate-800 mt-1">3700 pts</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#0052CC] flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Leading Team</p>
                <p className="text-2xl font-black text-slate-800 mt-1">Carl</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-[#6F42C1] flex items-center justify-center">
                <Crown className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Submissions</p>
                <p className="text-2xl font-black text-slate-800 mt-1">121</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Flame className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Main Grid: Left Progression Chart / Right Standings Table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Score Progression Multi-line SVG chart */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#0052CC]" />
                    <span>Score Progression</span>
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">01:00 → 08:00 | Dec 26, 2017</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Top teams real-time solve trajectory</p>
              </div>

              {/* Multi-line SVG Chart */}
              <div className="h-64 w-full relative pt-4 pb-2 my-4">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200">
                  {/* Grid Lines */}
                  <line x1="0" y1="20" x2="500" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="60" x2="500" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="100" x2="500" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="140" x2="500" y2="140" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="180" x2="500" y2="180" stroke="#f1f5f9" strokeWidth="1" />

                  {/* Line 1: Carl (Purple) */}
                  <path d="M 40 180 L 100 160 L 160 140 L 220 120 L 280 90 L 340 70 L 400 40 L 460 30" fill="none" stroke="#6F42C1" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="460" cy="30" r="4.5" fill="#6F42C1" stroke="#ffffff" strokeWidth="1.5" />

                  {/* Line 2: Marie (Orange) */}
                  <path d="M 40 180 L 100 170 L 160 150 L 220 135 L 280 110 L 340 95 L 400 70 L 460 50" fill="none" stroke="#FFA500" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="460" cy="50" r="4" fill="#FFA500" stroke="#ffffff" strokeWidth="1.5" />

                  {/* Line 3: Stephen (Green) */}
                  <path d="M 40 180 L 100 172 L 160 155 L 220 130 L 280 115 L 340 90 L 400 82 L 460 55" fill="none" stroke="#28A745" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="460" cy="55" r="4" fill="#28A745" stroke="#ffffff" strokeWidth="1.5" />

                  {/* Line 4: Tiffany (Blue) */}
                  <path d="M 40 180 L 100 175 L 160 160 L 220 148 L 280 130 L 340 110 L 400 95 L 460 62" fill="none" stroke="#0052CC" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="460" cy="62" r="4" fill="#0052CC" stroke="#ffffff" strokeWidth="1.5" />
                </svg>

                {/* X-Axis labels */}
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2 px-1">
                  <span>01:00</span>
                  <span>02:00</span>
                  <span>03:00</span>
                  <span>04:00</span>
                  <span>05:00</span>
                  <span>06:00</span>
                  <span>07:00</span>
                  <span>08:00</span>
                </div>
              </div>

              {/* Legends Checklist Row */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-bold text-slate-500 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#6F42C1]"></span> Carl</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#FFA500]"></span> Marie</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#28A745]"></span> Stephen</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#0052CC]"></span> Tiffany</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#8884d8]"></span> David</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#ea73ff]"></span> Diane</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#ff6b6b]"></span> Ralph</span>
              </div>
            </div>

            {/* Right Column: Final Standings with sparkline trend */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                  <h3 className="font-bold text-slate-800 text-sm">Final Standings</h3>
                  <span className="text-[10px] font-semibold text-slate-400">Click row for details</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="text-slate-400 font-bold border-b border-slate-100 uppercase text-[10px]">
                        <th className="py-2.5 w-8">#</th>
                        <th className="py-2.5">Team</th>
                        <th className="py-2.5 text-center">Score</th>
                        <th className="py-2.5 text-center">Subs</th>
                        <th className="py-2.5 text-right">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {scoreboardTeams.map((team) => (
                        <tr key={team.rank} className="hover:bg-slate-50/50">
                          <td className="py-3 font-extrabold text-slate-800">{team.rank}</td>
                          <td className="py-3 flex items-center gap-2">
                            <span 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: team.color }}
                            ></span>
                            <span className="font-bold text-slate-800">{team.name}</span>
                          </td>
                          <td className="py-3 text-center font-extrabold text-slate-800">{team.score}</td>
                          <td className="py-3 text-center text-slate-500">{team.submissions}</td>
                          <td className="py-3 text-right">
                            {/* Sparkline trend graphic */}
                            <svg className="w-14 h-4 overflow-visible inline-block" viewBox="0 0 60 16">
                              <path 
                                d={team.trendPath} 
                                fill="none" 
                                stroke={team.color} 
                                strokeWidth="1.8" 
                                strokeLinecap="round" 
                              />
                            </svg>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
