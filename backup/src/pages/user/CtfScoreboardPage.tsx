import React, { useState } from 'react';
import { UserLayout } from '../../components/user/UserLayout';
import type { CtfScoreboardEntry } from '../../types/ctf';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Award, 
  Snowflake, 
  ArrowLeft, 
  TrendingUp 
} from 'lucide-react';

const MOCK_SCOREBOARD: CtfScoreboardEntry[] = [
  {
    rank: 1,
    name: 'Binary Hunters',
    teamId: 't-1',
    isUserTeam: false,
    totalPoints: 1840,
    lastSolveTime: '10 mins ago',
    solvesByCategory: { Web: 2, Pwn: 2, Crypto: 1, Forensics: 1 },
    solveHistory: [
      { timestamp: '12:00', points: 0 },
      { timestamp: '12:30', points: 340 },
      { timestamp: '13:00', points: 800 },
      { timestamp: '13:30', points: 1260 },
      { timestamp: '14:00', points: 1840 },
    ],
  },
  {
    rank: 2,
    name: 'Cyber Squad 7',
    teamId: 't-2',
    isUserTeam: false,
    totalPoints: 1420,
    lastSolveTime: '18 mins ago',
    solvesByCategory: { Web: 2, Crypto: 1, OSINT: 2 },
    solveHistory: [
      { timestamp: '12:00', points: 0 },
      { timestamp: '12:30', points: 220 },
      { timestamp: '13:00', points: 600 },
      { timestamp: '13:30', points: 1040 },
      { timestamp: '14:00', points: 1420 },
    ],
  },
  {
    rank: 3,
    name: 'Team ZeroDay (Your Team)',
    teamId: 't-3',
    isUserTeam: true,
    totalPoints: 1280,
    lastSolveTime: '3 mins ago',
    solvesByCategory: { Web: 1, Forensics: 1, Pwn: 1 },
    solveHistory: [
      { timestamp: '12:00', points: 0 },
      { timestamp: '12:30', points: 340 },
      { timestamp: '13:00', points: 560 },
      { timestamp: '13:30', points: 940 },
      { timestamp: '14:00', points: 1280 },
    ],
  },
  {
    rank: 4,
    name: 'Root Cause Security',
    teamId: 't-4',
    isUserTeam: false,
    totalPoints: 910,
    lastSolveTime: '45 mins ago',
    solvesByCategory: { Web: 1, Reverse: 1 },
    solveHistory: [
      { timestamp: '12:00', points: 0 },
      { timestamp: '12:30', points: 180 },
      { timestamp: '13:00', points: 410 },
      { timestamp: '13:30', points: 690 },
      { timestamp: '14:00', points: 910 },
    ],
  },
  {
    rank: 5,
    name: 'Pwnable Knights',
    teamId: 't-5',
    isUserTeam: false,
    totalPoints: 680,
    lastSolveTime: '1 hr ago',
    solvesByCategory: { Crypto: 1, OSINT: 1 },
    solveHistory: [
      { timestamp: '12:00', points: 0 },
      { timestamp: '12:30', points: 180 },
      { timestamp: '13:00', points: 380 },
      { timestamp: '13:30', points: 520 },
      { timestamp: '14:00', points: 680 },
    ],
  }
];

export const CtfScoreboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [scoreboard] = useState<CtfScoreboardEntry[]>(MOCK_SCOREBOARD);
  const [isFrozen] = useState(false); // Mock frozen status flag

  const topThree = scoreboard.slice(0, 3);

  return (
    <UserLayout>
      <div className="space-y-6">
        {/* Navigation Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="space-y-1">
            <button
              onClick={() => navigate(`/ctf/events/${eventId || 'ctf-1'}`)}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Return to Challenge Arena
            </button>
            <div className="flex items-center space-x-3">
              <span className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                <Award className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">
                  CTF Standings & Solve Progress
                </h1>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Event: CyberRange National Championship • Live Leaderboard
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-purple-50 text-purple-700 px-4 py-2 rounded-xl border border-purple-200 text-xs font-mono font-bold">
              Total Solves: 184 Flags
            </div>
          </div>
        </div>

        {/* Freeze Notification Banner */}
        {isFrozen && (
          <div className="p-4 bg-cyan-900 text-white rounded-2xl shadow-md flex items-center space-x-3 border border-cyan-700">
            <Snowflake className="w-6 h-6 text-cyan-300 animate-spin shrink-0" />
            <div>
              <h4 className="font-extrabold text-sm text-cyan-200 uppercase tracking-wider">
                Scoreboard Frozen by Competition Admins
              </h4>
              <p className="text-xs text-cyan-100 mt-0.5">
                Public standings have been frozen during the final hour of the competition to preserve final placement suspense! Submissions remain active.
              </p>
            </div>
          </div>
        )}

        {/* Top 3 Champion Podium Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Rank 2 - Silver */}
          {topThree[1] && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-3 relative overflow-hidden order-2 md:order-1">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-black text-lg border border-slate-300">
                2nd
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">{topThree[1].name}</h3>
                <p className="text-xs font-mono text-purple-600 font-bold mt-1">
                  {topThree[1].totalPoints} Points
                </p>
              </div>
              <span className="text-[11px] font-mono text-gray-400">Last solve: {topThree[1].lastSolveTime}</span>
            </div>
          )}

          {/* Rank 1 - Gold Champion */}
          {topThree[0] && (
            <div className="bg-gradient-to-b from-amber-500/10 via-white to-white p-6 rounded-2xl border-2 border-amber-400 shadow-md flex flex-col items-center text-center space-y-3 relative overflow-hidden order-1 md:order-2">
              <div className="w-14 h-14 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-xl shadow-md border-2 border-amber-300">
                1st
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 mb-1 inline-block">
                  Champion Lead
                </span>
                <h3 className="font-extrabold text-gray-900 text-lg">{topThree[0].name}</h3>
                <p className="text-sm font-mono text-amber-600 font-extrabold mt-1">
                  {topThree[0].totalPoints} Points
                </p>
              </div>
              <span className="text-[11px] font-mono text-gray-500">Last solve: {topThree[0].lastSolveTime}</span>
            </div>
          )}

          {/* Rank 3 - Bronze */}
          {topThree[2] && (
            <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm flex flex-col items-center text-center space-y-3 relative overflow-hidden order-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-black text-lg border border-amber-300">
                3rd
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">{topThree[2].name}</h3>
                <p className="text-xs font-mono text-purple-600 font-bold mt-1">
                  {topThree[2].totalPoints} Points
                </p>
              </div>
              <span className="text-[11px] font-mono text-gray-400">Last solve: {topThree[2].lastSolveTime}</span>
            </div>
          )}
        </div>

        {/* Interactive Multi-Line SVG Score Progression Trajectory Graph */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-purple-600" /> Score Progression Trajectory (Top Teams)
            </h3>
            <span className="text-xs font-mono text-gray-400">Timeline: 12:00 → 14:00 UTC</span>
          </div>

          <div className="h-64 w-full pt-4">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200">
              {/* Grid Lines */}
              <line x1="0" y1="40" x2="500" y2="40" stroke="#E5E7EB" strokeDasharray="4 4" />
              <line x1="0" y1="90" x2="500" y2="90" stroke="#E5E7EB" strokeDasharray="4 4" />
              <line x1="0" y1="140" x2="500" y2="140" stroke="#E5E7EB" strokeDasharray="4 4" />
              <line x1="0" y1="190" x2="500" y2="190" stroke="#E5E7EB" />

              {/* Line 1 - Binary Hunters (Gold #6F42C1) */}
              <path
                d="M 0 190 L 125 156 L 250 110 L 375 64 L 500 6"
                fill="none"
                stroke="#6F42C1"
                strokeWidth="3.5"
              />

              {/* Line 2 - Cyber Squad 7 (Emerald #28A745) */}
              <path
                d="M 0 190 L 125 168 L 250 130 L 375 86 L 500 48"
                fill="none"
                stroke="#28A745"
                strokeWidth="2.5"
              />

              {/* Line 3 - Team ZeroDay (Blue #0052CC) */}
              <path
                d="M 0 190 L 125 156 L 250 134 L 375 96 L 500 62"
                fill="none"
                stroke="#0052CC"
                strokeWidth="3"
                strokeDasharray="6 2"
              />

              {/* Data points */}
              <circle cx="500" cy="6" r="5" fill="#6F42C1" />
              <circle cx="500" cy="48" r="5" fill="#28A745" />
              <circle cx="500" cy="62" r="5" fill="#0052CC" />
            </svg>
          </div>

          <div className="flex items-center justify-center space-x-6 text-xs font-semibold pt-2">
            <span className="flex items-center text-purple-700">
              <span className="w-3 h-3 rounded-full bg-purple-600 mr-1.5"></span> Binary Hunters
            </span>
            <span className="flex items-center text-emerald-700">
              <span className="w-3 h-3 rounded-full bg-emerald-600 mr-1.5"></span> Cyber Squad 7
            </span>
            <span className="flex items-center text-blue-700">
              <span className="w-3 h-3 rounded-full bg-blue-600 mr-1.5"></span> Team ZeroDay (Your Team)
            </span>
          </div>
        </div>

        {/* Full Scoreboard Standings Roster Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Leaderboard Standings Roster</h3>
            <span className="text-xs text-gray-500 font-mono">Updated real-time via WebSockets</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-200 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                  <th className="py-3.5 px-4">Participant / Team Name</th>
                  <th className="py-3.5 px-4">Solves Breakdown</th>
                  <th className="py-3.5 px-4 text-right">Total Score</th>
                  <th className="py-3.5 px-4 text-right">Last Solve</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {scoreboard.map((row) => (
                  <tr
                    key={row.rank}
                    className={`transition-colors ${
                      row.isUserTeam ? 'bg-purple-50/70 hover:bg-purple-100/60' : 'hover:bg-gray-50/80'
                    }`}
                  >
                    <td className="py-4 px-4 text-center font-bold text-gray-900 font-mono">
                      #{row.rank}
                    </td>
                    <td className="py-4 px-4 font-bold text-gray-900 flex items-center space-x-2">
                      <span>{row.name}</span>
                      {row.isUserTeam && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-600 text-white">
                          YOUR TEAM
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(row.solvesByCategory).map(([cat, count]) => (
                          <span
                            key={cat}
                            className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-white text-gray-700 border border-gray-200 shadow-2xs"
                          >
                            {cat}: {count}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-extrabold text-emerald-600 text-base">
                      {row.totalPoints} pts
                    </td>
                    <td className="py-4 px-4 text-right text-xs font-mono text-gray-500">
                      {row.lastSolveTime}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </UserLayout>
  );
};
