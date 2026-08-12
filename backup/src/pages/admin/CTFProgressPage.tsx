import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import type { CtfEvent, CtfChallenge, CtfScoreboardEntry } from '../../types/ctf';
import { ArrowLeft, Download, RefreshCw, Trophy, Activity, Check, Minus } from 'lucide-react';

export const CTFProgressPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const ctfId = Number(id);

  const [ctf, setCtf] = useState<CtfEvent | null>(null);
  const [challenges, setChallenges] = useState<CtfChallenge[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [solvesMap, setSolvesMap] = useState<Record<string, Set<number>>>({});
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Fetch CTF
      const ctfRes = await fetch(`/api/v1/ctf/${ctfId}`, { headers });
      if (!ctfRes.ok) throw new Error('CTF details not found.');
      const ctfData = await ctfRes.json();
      setCtf(ctfData);

      // 2. Fetch Challenges
      const chRes = await fetch(`/api/v1/ctf/${ctfId}/challenges`, { headers });
      if (!chRes.ok) throw new Error('Failed to load challenges.');
      const chData = await chRes.json();
      setChallenges(chData);

      // 3. Fetch Leaderboard (Participants list)
      const lbRes = await fetch(`/api/v1/ctf/${ctfId}/leaderboard`, { headers });
      if (!lbRes.ok) throw new Error('Failed to load scoreboard.');
      const lbData = await lbRes.json();
      setLeaderboard(lbData.entries || []);

      // 4. Fetch Submissions (to build solves matrix)
      const subRes = await fetch(`/api/v1/ctf/${ctfId}/submissions?limit=1000`, { headers });
      if (!subRes.ok) throw new Error('Failed to load submissions.');
      const subData = await subRes.json();
      
      // Build solves map: { participant_id: Set of challenge_ids }
      const newSolvesMap: Record<string, Set<number>> = {};
      const entries = subData.entries || [];
      entries.forEach((sub: any) => {
        if (sub.is_correct) {
          const key = String(sub.participant_id);
          if (!newSolvesMap[key]) {
            newSolvesMap[key] = new Set<number>();
          }
          newSolvesMap[key].add(sub.challenge_id);
        }
      });
      setSolvesMap(newSolvesMap);
    } catch (err: any) {
      setError(err.message || 'Error occurred while loading progress data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [ctfId]);

  const handleExportCSV = () => {
    if (!ctf || leaderboard.length === 0) return;

    // Headers: Rank, Name, Solved Count, Total Points, <Challenge Titles...>
    const challengeHeaders = challenges.map((ch) => `"${ch.title.replace(/"/g, '""')}"`);
    const csvHeaders = ['Rank', 'Participant Name', 'Solved Count', 'Total Points', ...challengeHeaders];

    const csvRows = leaderboard.map((p) => {
      const studentSolves = solvesMap[String(p.participant_id)] || new Set();
      const chSolveStates = challenges.map((ch) => (studentSolves.has(ch.id) ? 'Solved' : ''));
      return [
        p.rank,
        `"${p.participant_name.replace(/"/g, '""')}"`,
        p.solve_count,
        p.total_points,
        ...chSolveStates,
      ];
    });

    const csvContent = [csvHeaders.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ctf_${ctfId}_progress_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        
        {/* Navigation / Header */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Link
            to={`/admin/ctf/${ctfId}`}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-indigo-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Event Detail
          </Link>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="flex items-center gap-1 bg-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={handleExportCSV}
              disabled={leaderboard.length === 0}
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors shadow-md disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* CTF Summary Info */}
        {ctf && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Live Solves Grid</h2>
              <span className="text-xs text-slate-400 font-medium">({ctf.title})</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Live status of challenges solved by enrolled students</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400 font-semibold">
            Compiling Solves Matrix...
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-slate-400 text-xs font-semibold">
            No participants active in this CTF tournament yet.
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 bg-slate-50/50 dark:bg-slate-950/20">
                    <th className="px-4 py-4 w-12 text-center">Rank</th>
                    <th className="px-4 py-4 w-44">Participant</th>
                    <th className="px-4 py-4 w-20 text-center">Solves</th>
                    <th className="px-4 py-4 w-20 text-center">Score</th>
                    {challenges.map((ch) => (
                      <th
                        key={ch.id}
                        className="px-2 py-4 text-center text-[9px] font-bold truncate max-w-[120px]"
                        title={ch.title}
                      >
                        {ch.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {leaderboard.map((p) => {
                    const studentSolves = solvesMap[String(p.participant_id)] || new Set();
                    return (
                      <tr key={p.participant_id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-400">
                          {p.rank}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {p.participant_name}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-600 dark:text-slate-400 font-mono">
                          {p.solve_count}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                          {p.total_points}
                        </td>
                        {challenges.map((ch) => {
                          const solved = studentSolves.has(ch.id);
                          return (
                            <td key={ch.id} className="px-2 py-3 text-center">
                              {solved ? (
                                <span className="inline-flex items-center justify-center bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 w-5 h-5 rounded-full border border-emerald-200 dark:border-emerald-900/35">
                                  <Check className="w-3.5 h-3.5 stroke-[3px]" />
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-700">
                                  <Minus className="w-4 h-4 mx-auto" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
};
