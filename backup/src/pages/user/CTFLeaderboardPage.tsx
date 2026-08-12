import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UserLayout } from '../../components/user/UserLayout';
import type { CtfEvent, CtfScoreboardEntry } from '../../types/ctf';
import { useCTFWebSocket } from '../../hooks/useCTFWebSocket';
import { ArrowLeft, Trophy, RefreshCw, Activity, Award, Star } from 'lucide-react';

export const CTFLeaderboardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const ctfId = Number(id);

  const [ctf, setCtf] = useState<CtfEvent | null>(null);
  const [leaderboard, setLeaderboard] = useState<CtfScoreboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live WebSocket Updates
  const handleWebSocketMessage = useCallback((payload: any) => {
    if (payload.type === 'score_update') {
      if (payload.leaderboard) {
        setLeaderboard(payload.leaderboard);
      } else {
        // Fallback to fetch if payload does not have full entries
        fetchLeaderboardOnly();
      }
    } else if (payload.type === 'ctf_ended') {
      if (ctf) {
        setCtf({ ...ctf, status: 'completed' });
      }
    }
  }, [ctf]);

  const { connected } = useCTFWebSocket(ctfId, handleWebSocketMessage);

  const fetchLeaderboardOnly = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/v1/ctf/${ctfId}/leaderboard`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.entries || []);
      }
    } catch (err) {
      console.error('Failed to update leaderboard via HTTP fallback:', err);
    }
  };

  const fetchLeaderboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Fetch CTF details
      const ctfRes = await fetch(`/api/v1/ctf/${ctfId}`, { headers });
      if (!ctfRes.ok) throw new Error('CTF details not found.');
      const ctfData = await ctfRes.json();
      setCtf(ctfData);

      // 2. Fetch Leaderboard entries
      const lbRes = await fetch(`/api/v1/ctf/${ctfId}/leaderboard`, { headers });
      if (!lbRes.ok) throw new Error('Failed to load scoreboard.');
      const lbData = await lbRes.json();
      setLeaderboard(lbData.entries || []);
    } catch (err: any) {
      setError(err.message || 'Error occurred while loading scoreboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboardData();
  }, [ctfId]);

  return (
    <UserLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation / Header */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in duration-150">
          <Link
            to={`/ctf/${ctfId}/challenges`}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-indigo-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Arena
          </Link>
          
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {connected ? 'Live Sync Active' : 'Offline'}
            </span>
            <button
              onClick={fetchLeaderboardData}
              className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* scoreboard header info */}
        {ctf && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Event Leaderboard</h2>
              </div>
              <p className="text-xs text-slate-400">Live rankings for {ctf.title}</p>
            </div>
            {ctf.is_frozen && (
              <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Scoreboard Frozen ❄️
              </span>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400 font-semibold">
            Retrieving Live Standings...
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-slate-400 text-xs font-semibold">
            No submissions recorded. Be the first to capture a flag!
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 bg-slate-50/50 dark:bg-slate-950/20">
                    <th className="px-6 py-4 w-20 text-center">Rank</th>
                    <th className="px-6 py-4">Participant Squad</th>
                    <th className="px-6 py-4 w-32 text-center">Solved Targets</th>
                    <th className="px-6 py-4 w-32 text-center">Total Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {leaderboard.map((entry) => {
                    const isSelf = entry.participant_id === Number(localStorage.getItem('user_id') || 0);
                    
                    return (
                      <tr
                        key={entry.participant_id}
                        className={`transition-colors ${
                          isSelf
                            ? 'bg-indigo-500/5 hover:bg-indigo-500/10 font-bold'
                            : 'hover:bg-slate-50/40 dark:hover:bg-slate-900/30'
                        }`}
                      >
                        <td className="px-6 py-4 text-center font-mono text-slate-400 font-bold">
                          {entry.rank === 1 ? (
                            <span className="inline-flex items-center justify-center bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 w-6 h-6 rounded-full border border-amber-250 font-sans font-bold">
                              1
                            </span>
                          ) : entry.rank === 2 ? (
                            <span className="inline-flex items-center justify-center bg-slate-150 dark:bg-slate-800 text-slate-600 dark:text-slate-400 w-6 h-6 rounded-full border border-slate-250 font-sans font-bold">
                              2
                            </span>
                          ) : entry.rank === 3 ? (
                            <span className="inline-flex items-center justify-center bg-amber-50 dark:bg-amber-900/15 text-amber-700 w-6 h-6 rounded-full border border-amber-200/80 font-sans font-bold">
                              3
                            </span>
                          ) : (
                            entry.rank
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-200">
                          <div className="flex items-center gap-2">
                            <span>{entry.participant_name}</span>
                            {isSelf && (
                              <span className="text-[9px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                                You
                              </span>
                            )}
                            {entry.first_blood_challenges && entry.first_blood_challenges.length > 0 && (
                              <span
                                title={`${entry.first_blood_challenges.length} First Blood(s)`}
                                className="inline-flex items-center text-rose-500 text-[11px]"
                              >
                                🩸
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                          {entry.solve_count}
                        </td>
                        <td className="px-6 py-4 text-center font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                          {entry.total_points}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </UserLayout>
  );
};
