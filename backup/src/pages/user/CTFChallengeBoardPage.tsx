import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { UserLayout } from '../../components/user/UserLayout';
import type { CtfEvent, CtfChallenge } from '../../types/ctf';
import { useCTFWebSocket } from '../../hooks/useCTFWebSocket';
import { Trophy, Clock, HelpCircle, CheckCircle2, ChevronRight, AlertTriangle, ListFilter, Play } from 'lucide-react';

export const CTFChallengeBoardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const ctfId = Number(id);
  const navigate = useNavigate();

  const [ctf, setCtf] = useState<CtfEvent | null>(null);
  const [challenges, setChallenges] = useState<CtfChallenge[]>([]);
  const [solvedIds, setSolvedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket Live Updates
  const handleWebSocketMessage = useCallback((payload: any) => {
    if (payload.type === 'score_update') {
      // Re-fetch challenges to get updated point values/solve counts
      fetchChallengesOnly();
    } else if (payload.type === 'ctf_ended') {
      if (ctf) {
        setCtf({ ...ctf, status: 'completed' });
      }
    }
  }, [ctf]);

  useCTFWebSocket(ctfId, handleWebSocketMessage);

  const fetchChallengesOnly = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/v1/ctf/${ctfId}/challenges`, { headers });
      if (res.ok) {
        const data = await res.json();
        setChallenges(data);
      }
    } catch (err) {
      console.error('Failed to update challenges via WS trigger:', err);
    }
  };

  const fetchBoardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Fetch CTF
      const ctfRes = await fetch(`/api/v1/ctf/${ctfId}`, { headers });
      if (!ctfRes.ok) throw new Error('CTF Details not found.');
      const ctfData = await ctfRes.json();
      setCtf(ctfData);

      // 2. Fetch Challenges
      const chRes = await fetch(`/api/v1/ctf/${ctfId}/challenges`, { headers });
      if (!chRes.ok) throw new Error('Failed to load challenges.');
      const chData = await chRes.json();
      setChallenges(chData);

      // 3. Fetch Student Solves (to mark solved checkmarks)
      const subRes = await fetch(`/api/v1/ctf/${ctfId}/submissions?limit=100`, { headers });
      if (subRes.ok) {
        const subData = await subRes.json();
        const correctIds = new Set<number>();
        (subData.entries || []).forEach((s: any) => {
          if (s.is_correct && s.participant_id === Number(localStorage.getItem('user_id') || 0)) {
            correctIds.add(s.challenge_id);
          }
        });
        setSolvedIds(correctIds);
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred while loading board.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoardData();
  }, [ctfId]);

  if (loading) {
    return (
      <UserLayout>
        <div className="text-center py-12 text-slate-400 font-semibold">
          Accessing Tournament Board...
        </div>
      </UserLayout>
    );
  }

  if (!ctf) {
    return (
      <UserLayout>
        <div className="text-center py-12 text-rose-500 font-semibold">
          CTF Arena not found.
        </div>
      </UserLayout>
    );
  }

  const isCompleted = ctf.status === 'completed';

  // Group challenges by Category
  const categoriesMap: Record<string, CtfChallenge[]> = {};
  challenges.forEach((ch) => {
    const cat = ch.category || 'Misc';
    if (!categoriesMap[cat]) {
      categoriesMap[cat] = [];
    }
    categoriesMap[cat].push(ch);
  });

  return (
    <UserLayout>
      <div className="space-y-6">
        
        {/* Banner if CTF has completed */}
        {isCompleted && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div>
              <span className="font-bold text-sm block">This tournament has ended</span>
              <span className="text-xs text-rose-500/80">
                Submissions are now closed. You can view challenge briefings and attachment archives, but no points will be awarded.
              </span>
            </div>
          </div>
        )}

        {/* Board Header Block */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{ctf.title}</h2>
            </div>
            <p className="text-xs text-slate-400 line-clamp-2 max-w-2xl leading-relaxed">
              {ctf.description || 'Welcome to the tournament! Select a target below to start auditing.'}
            </p>
          </div>
          <div className="flex-shrink-0">
            <Link
              to={`/ctf/${ctfId}/scoreboard`}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-500/25"
            >
              <Trophy className="w-4 h-4" />
              Live Scoreboard
            </Link>
          </div>
        </div>

        {challenges.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 text-xs font-semibold">
            No challenges released in this CTF environment yet.
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(categoriesMap).map(([categoryName, items]) => (
              <div key={categoryName} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                  <ListFilter className="w-4.5 h-4.5 text-indigo-500" />
                  <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm tracking-wide uppercase">
                    {categoryName}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((ch) => {
                    const isSolved = solvedIds.has(ch.id);
                    return (
                      <div
                        key={ch.id}
                        onClick={() => navigate(`/ctf/${ctfId}/challenges/${ch.id}`)}
                        className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 cursor-pointer shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-44 relative ${
                          isCompleted
                            ? 'opacity-80 border-slate-200 dark:border-slate-800'
                            : isSolved
                            ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/10'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {/* Title and Category Badge */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-3">
                            <span className="font-extrabold text-slate-800 dark:text-slate-100 line-clamp-1">
                              {ch.title}
                            </span>
                            {isSolved && (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                            )}
                          </div>
                          
                          {/* Connection indicator */}
                          {ch.connection_string && (
                            <span className="text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded leading-normal line-clamp-1 inline-block">
                              {ch.connection_string}
                            </span>
                          )}
                        </div>

                        {/* Point Details and Solves Count */}
                        <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                              Points Payout
                            </span>
                            <span className="font-mono font-extrabold text-sm text-indigo-600 dark:text-indigo-400">
                              {ch.scoring_mode === 'static' ? ch.static_points : ch.current_points} pts
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                            <span>{ch.solve_count} solved</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </UserLayout>
  );
};
