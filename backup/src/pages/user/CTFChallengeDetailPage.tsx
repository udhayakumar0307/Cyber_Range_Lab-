import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { UserLayout } from '../../components/user/UserLayout';
import type { CtfEvent, CtfChallenge, CtfHint } from '../../types/ctf';
import { useCTFWebSocket } from '../../hooks/useCTFWebSocket';
import { HintUnlockModal } from './HintUnlockModal';
import {
  ArrowLeft,
  Trophy,
  Copy,
  Check,
  Download,
  AlertCircle,
  HelpCircle,
  Play,
  CheckCircle2,
  Lock,
  ExternalLink,
  Terminal,
} from 'lucide-react';

export const CTFChallengeDetailPage: React.FC = () => {
  const { id, cid } = useParams<{ id: string; cid: string }>();
  const ctfId = Number(id);
  const challengeId = Number(cid);
  const navigate = useNavigate();

  const [ctf, setCtf] = useState<CtfEvent | null>(null);
  const [challenge, setChallenge] = useState<CtfChallenge | null>(null);
  
  // Submit state
  const [flagInput, setFlagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSolved, setIsSolved] = useState(false);

  // Copy target state
  const [copied, setCopied] = useState(false);

  // Hint unlock modal state
  const [activeHintToUnlock, setActiveHintToUnlock] = useState<CtfHint | null>(null);
  const [unlockedHintsMap, setUnlockedHintsMap] = useState<Record<number, string>>({});

  // WebSocket updates for live scoring/solves
  const handleWebSocketMessage = useCallback((payload: any) => {
    if (payload.type === 'score_update') {
      fetchChallengeOnly();
    } else if (payload.type === 'ctf_ended') {
      if (ctf) {
        setCtf({ ...ctf, status: 'completed' });
      }
    }
  }, [ctf]);

  useCTFWebSocket(ctfId, handleWebSocketMessage);

  const fetchChallengeOnly = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/v1/ctf/${ctfId}/challenges`, { headers });
      if (res.ok) {
        const data = await res.json();
        const found = data.find((c: CtfChallenge) => c.id === challengeId);
        if (found) {
          setChallenge(found);
        }
      }
    } catch (err) {
      console.error('Failed to sync challenge via WS:', err);
    }
  };

  const fetchDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Fetch CTF
      const ctfRes = await fetch(`/api/v1/ctf/${ctfId}`, { headers });
      if (!ctfRes.ok) throw new Error('CTF Details not found.');
      const ctfData = await ctfRes.json();
      setCtf(ctfData);

      // 2. Fetch Challenges to find the specific one
      const chRes = await fetch(`/api/v1/ctf/${ctfId}/challenges`, { headers });
      if (!chRes.ok) throw new Error('Failed to load challenges.');
      const chData = await chRes.json();
      const found = chData.find((c: CtfChallenge) => c.id === challengeId);
      if (!found) throw new Error('Challenge not found.');
      setChallenge(found);

      // 3. Check if solved and fetch hints unlocked by this user
      const subRes = await fetch(`/api/v1/ctf/${ctfId}/submissions?limit=100`, { headers });
      if (subRes.ok) {
        const subData = await subRes.json();
        const currentUserId = Number(localStorage.getItem('user_id') || 0);
        
        // Is solved?
        const solved = (subData.entries || []).some(
          (s: any) => s.is_correct && s.challenge_id === challengeId && s.participant_id === currentUserId
        );
        setIsSolved(solved);
        if (solved) {
          setFeedback({ type: 'success', text: 'You have already solved this challenge.' });
        }
      }

      // Check which hints are already unlocked by this user
      // We can iterate through hints and attempt to request unlocked text (unlocked texts will be fetched when unlocked, 
      // or we can request them if previously unlocked. Backend returns unlocked hint text if already unlocked or cost=0).
      // We will make individual check requests or fetch them on request.
      const hintsTextMap: Record<number, string> = {};
      for (const h of found.hints) {
        if (h.cost_percent === 0) {
          hintsTextMap[Number(h.id)] = h.text || '';
        } else {
          // Check if already unlocked by calling unlock endpoint.
          // If already unlocked, backend returns code 200 with text. 
          // If not unlocked, backend returns 400 'already unlocked' error check? 
          // Wait, backend endpoints return HTTP 400 for already unlocked when attempting unlock.
          // But wait, the challenge GET endpoint itself returns the unlocked hint texts!
          // Ah! Our backend endpoint returns hint texts only for cost_percent=0 OR if unlocked by that participant.
          // So if we fetch the challenge, the hint object text property will contain the unlocked text if already unlocked!
          if (h.text) {
            hintsTextMap[Number(h.id)] = h.text;
          }
        }
      }
      setUnlockedHintsMap(hintsTextMap);

    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error loading challenge.' });
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [ctfId, challengeId]);

  const handleCopy = () => {
    if (!challenge?.connection_string) return;
    navigator.clipboard.writeText(challenge.connection_string);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagInput || !ctf || !challenge) return;
    
    setSubmitting(true);
    setFeedback(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`/api/v1/ctf/${ctfId}/challenge/${challengeId}/submission`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ flag: flagInput }),
      });

      const data = await res.json();
      if (res.status === 429) {
        setFeedback({ type: 'error', text: 'Rate limit exceeded. Maximum 5 attempts per minute.' });
        return;
      }
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to submit flag.');
      }

      if (data.correct) {
        setIsSolved(true);
        setFeedback({
          type: 'success',
          text: data.message || `Correct flag! You earned ${data.points_credited} points.`,
        });
      } else {
        setFeedback({ type: 'error', text: 'Incorrect flag. Try again!' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'An error occurred during submission.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockSuccess = (hintId: number, hintText: string) => {
    setUnlockedHintsMap((prev) => ({ ...prev, [hintId]: hintText }));
    // Re-fetch details to calculate updated penalty scores
    fetchDetails();
  };

  if (!ctf || !challenge) {
    return (
      <UserLayout>
        <div className="text-center py-12 text-slate-400 font-semibold">
          Accessing Challenge Briefing...
        </div>
      </UserLayout>
    );
  }

  const isCompleted = ctf.status === 'completed';
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

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
          <span className="text-xs font-bold text-slate-400 font-mono">
            Category: {challenge.category || 'Misc'}
          </span>
        </div>

        {/* Challenge Briefing Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{challenge.title}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{challenge.solve_count} solved</span>
                <span>•</span>
                <span className="font-semibold text-indigo-500">
                  {challenge.scoring_mode === 'static' ? 'Static Points' : 'Dynamic Decay'}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Points Payout</span>
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                {challenge.scoring_mode === 'static' ? challenge.static_points : challenge.current_points} pts
              </span>
            </div>
          </div>

          {/* Description brief */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Breifing Brief</h3>
            <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {challenge.description}
            </div>
          </div>

          {/* Connection Monospace string */}
          {challenge.connection_string && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Access Connection</h3>
              <div className="flex items-center justify-between bg-slate-900 text-slate-100 p-3 rounded-xl border border-slate-800 font-mono text-xs overflow-x-auto shadow-inner">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>{challenge.connection_string}</span>
                </div>
                <button
                  onClick={handleCopy}
                  className="text-slate-400 hover:text-white p-1 rounded transition-colors ml-4"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* GCP Web URL target */}
          {challenge.challenge_url && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Endpoint</h3>
              <a
                href={challenge.challenge_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {challenge.challenge_url}
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* Downloadable files */}
          {challenge.files && challenge.files.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attachment Archives</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {challenge.files.map((file) => (
                  <a
                    key={file.id}
                    href={`/api/v1/ctf/${ctfId}/challenge/${challengeId}/files/${file.filename}`}
                    download
                    className="flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40 p-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors shadow-sm"
                  >
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate mr-3">
                      {file.filename}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 font-mono flex-shrink-0 flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 px-2 py-0.5 rounded-md">
                      <Download className="w-3 h-3" />
                      {formatBytes(file.file_size_bytes)}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Flags Submission Block */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Submit Flag</h3>
          
          <form onSubmit={handleFlagSubmit} className="flex gap-2">
            <input
              type="text"
              value={flagInput}
              onChange={(e) => setFlagInput(e.target.value)}
              placeholder="e.g. CTF{your_flag_here}"
              disabled={isSolved || submitting || isCompleted}
              className="flex-1 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none disabled:bg-slate-100 dark:disabled:bg-slate-900/50"
              required
            />
            <button
              type="submit"
              disabled={isSolved || submitting || isCompleted}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-500/20 flex-shrink-0"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>

          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold border ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : feedback.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                  : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </div>

        {/* Hints and Penalties Board */}
        {challenge.hints && challenge.hints.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-500" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hints Board</h3>
            </div>

            <div className="space-y-3">
              {challenge.hints.map((hint, idx) => {
                const hintText = unlockedHintsMap[Number(hint.id)];
                const isUnlocked = !!hintText;

                return (
                  <div
                    key={hint.id}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm"
                  >
                    <div className="flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20 px-4 py-3 text-xs border-b border-slate-250 dark:border-slate-800/80">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Hint #{idx + 1}</span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        Penalty Deduction: {hint.cost_percent ?? 0}%
                      </span>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 text-sm">
                      {isUnlocked ? (
                        <div className="text-slate-600 dark:text-slate-300 font-medium">
                          {hintText}
                        </div>
                      ) : (
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-xs text-slate-400 font-medium">
                            Brief hint details are locked. Unlocking this hint reduces points payout.
                          </span>
                          <button
                            type="button"
                            disabled={isCompleted}
                            onClick={() => setActiveHintToUnlock(hint)}
                            className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-bold text-[10px] uppercase border border-amber-250 dark:border-amber-900/40 px-3.5 py-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-40"
                          >
                            <Lock className="w-3 h-3" />
                            Unlock Hint
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Hint Unlock Confirm Dialog */}
      {activeHintToUnlock && (
        <HintUnlockModal
          isOpen={!!activeHintToUnlock}
          onClose={() => setActiveHintToUnlock(null)}
          ctfId={ctfId}
          challengeId={challengeId}
          hint={activeHintToUnlock}
          onUnlockSuccess={handleUnlockSuccess}
        />
      )}
    </UserLayout>
  );
};
