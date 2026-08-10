import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { 
  Trophy, 
  Flame, 
  Award, 
  Play, 
  Clock, 
  CheckCircle2, 
  ShieldAlert, 
  BookOpen, 
  TrendingUp,
  FlaskConical,
  Flag,
  ArrowRight
} from 'lucide-react';

interface TrainingLab {
  id: string;
  title: string;
  category: string;
  status: 'live' | 'upcoming' | 'completed';
  timeRemaining?: number;
  timeToStart?: number;
  score?: string;
  completedAt?: string;
  description?: string;
  totalChallenges?: number;
  solvedChallenges?: number;
  tags?: string[];
  duration?: string;
}

interface DashboardActivity {
  id: number;
  action?: string | null;
  description?: string | null;
  timestamp?: string | null;
}

interface DashboardData {
  user?: { name?: string | null } | null;
  statistics?: {
    total_score?: number | null;
    rank?: number | null;
    total_users?: number | null;
    completed_labs?: number | null;
    assigned_labs?: number | null;
    completion_percentage?: number | null;
  } | null;
  assigned_labs?: Array<{
    id?: string | null;
    title?: string | null;
    category?: string | null;
    description?: string | null;
    status?: 'live' | 'upcoming' | 'completed' | null;
    total_challenges?: number | null;
    solved_challenges?: number | null;
    duration_hours?: number | null;
    tags?: string[] | null;
  }> | null;
  recent_activity?: DashboardActivity[] | null;
}

export const UserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, apiFetch } = useAuth();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [labs, setLabs] = useState<TrainingLab[]>([]);
  const [recentActivities, setRecentActivities] = useState<DashboardActivity[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadDashboard = async () => {
      try {
        const response = await apiFetch('/api/v1/user/dashboard');
        if (!response.ok || cancelled) return;
        const data: DashboardData = await response.json();
        if (cancelled) return;
        setDashboard(data);
        setLabs((data.assigned_labs ?? [])
          .filter((lab) => lab.id !== 'puzzle-lab' && lab.id !== 'puzzle')
          .map((lab) => ({
            id: lab.id ?? '', title: lab.title ?? '', category: lab.category ?? '',
            status: lab.status ?? 'live', description: lab.description ?? '',
            totalChallenges: lab.total_challenges ?? 0, solvedChallenges: lab.solved_challenges ?? 0,
            tags: lab.tags ?? [], duration: `${lab.duration_hours ?? 0} hrs`
          })));
        setRecentActivities(data.recent_activity ?? []);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load dashboard data:', error);
        }
      }
    };
    loadDashboard();
    return () => { cancelled = true; };
  // apiFetch is stable (useCallback in AuthContext)
  }, [apiFetch]);

  const statistics = dashboard?.statistics;
  const completedPercentage = statistics?.completion_percentage ?? 0;
  const activityTime = (timestamp?: string | null) => timestamp ? new Date(timestamp).toLocaleString() : '';

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Welcome Banner Card */}
      <div className="bg-gradient-to-r from-blue-900 via-[#2563EB] to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Trophy className="w-80 h-80 text-white" />
        </div>
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Welcome back, {dashboard?.user?.name ?? user?.name ?? ''}! 👋
            </h1>
            {user?.auth_type === 'SSO' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-white/20 text-emerald-300 border border-white/10 uppercase tracking-wider self-start sm:self-center gap-1.5 animate-pulse">
                🏫 Academic Account
              </span>
            )}
          </div>
          <p className="text-sm text-blue-100/90 leading-relaxed font-bold">
            {user?.auth_type === 'SSO' 
              ? `${user?.email ? user.email.split('@')[1].toUpperCase() : 'Institution'} Academic Workspace`
              : 'Personal Learning Account'}
          </p>

          {/* Experience Progress */}
          <div className="pt-2 max-w-lg">
            <div className="flex justify-between text-xs font-bold text-blue-100 mb-1.5">
              <span>Assigned Lab Progress</span>
              <span>{completedPercentage}% complete</span>
            </div>
            <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden border border-white/10">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${completedPercentage}%` }}></div>
            </div>
          </div>

          <div className="pt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/labs')}
              className="bg-[#2563EB] hover:bg-blue-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md inline-flex items-center gap-2 border border-white/20 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              Continue Training
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* TOTAL SCORE */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-[11px] font-bold text-[#64748B] dark:text-[#CBD5E1] uppercase tracking-wider">TOTAL SCORE</p>
            <p className="text-2xl font-black text-[#0F172A] dark:text-white mt-1">{(statistics?.total_score ?? 0).toLocaleString()} pts</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* GLOBAL RANK */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-[11px] font-bold text-[#64748B] dark:text-[#CBD5E1] uppercase tracking-wider">GLOBAL RANK</p>
            <p className="text-2xl font-black text-[#0F172A] dark:text-white mt-1">#{statistics?.rank ?? 0} / {(statistics?.total_users ?? 0).toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Trophy className="w-6 h-6" />
          </div>
        </div>

        {/* LABS COMPLETED */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-[11px] font-bold text-[#64748B] dark:text-[#CBD5E1] uppercase tracking-wider">LABS COMPLETED</p>
            <p className="text-2xl font-black text-[#0F172A] dark:text-white mt-1">{statistics?.completed_labs ?? 0} / {statistics?.assigned_labs ?? 0} Labs</p>
            <div className="w-36 h-1.5 bg-blue-50 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${completedPercentage}%` }}></div>
            </div>
            <span className="text-[10px] text-[#64748B] dark:text-[#CBD5E1] font-semibold mt-1 block">{completedPercentage}% complete rate</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <FlaskConical className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* About CyberRange Platform informational section with 4 clean feature cards */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl border border-[#E2E8F0] dark:border-[#334155] p-6 sm:p-8 shadow-xs transition-colors">
        <h2 className="text-lg sm:text-xl font-black text-[#0F172A] dark:text-white tracking-tight">
          About CyberRange Platform
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#CBD5E1] leading-relaxed mt-2.5 max-w-4xl">
          CyberRange is a practical cybersecurity learning platform that provides hands-on labs, OT/ICS simulations, puzzles, and Capture the Flag challenges. Students can practice real-world attack and defense scenarios while tracking their learning progress and improving cybersecurity skills.
        </p>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          {/* Card 1 */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 p-5 rounded-2xl transition-all hover:scale-[1.01]">
            <h3 className="font-bold text-sm text-[#0F172A] dark:text-white">Hands-on Labs</h3>
            <ul className="list-disc list-inside text-xs text-[#64748B] dark:text-[#CBD5E1] mt-3 space-y-1.5 leading-relaxed">
              <li>Real-world cybersecurity scenarios</li>
              <li>Guided practical exercises</li>
            </ul>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 p-5 rounded-2xl transition-all hover:scale-[1.01]">
            <h3 className="font-bold text-sm text-[#0F172A] dark:text-white">OT / ICS Security</h3>
            <ul className="list-disc list-inside text-xs text-[#64748B] dark:text-[#CBD5E1] mt-3 space-y-1.5 leading-relaxed">
              <li>Industrial Control Systems</li>
              <li>SCADA environments</li>
              <li>PLC simulations</li>
            </ul>
          </div>

          {/* Card 3 */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 p-5 rounded-2xl transition-all hover:scale-[1.01]">
            <h3 className="font-bold text-sm text-[#0F172A] dark:text-white">CTF & Puzzle Challenges</h3>
            <ul className="list-disc list-inside text-xs text-[#64748B] dark:text-[#CBD5E1] mt-3 space-y-1.5 leading-relaxed">
              <li>Skill-based exercises</li>
              <li>Flag submissions</li>
              <li>Progressive difficulty</li>
            </ul>
          </div>

          {/* Card 4 */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 p-5 rounded-2xl transition-all hover:scale-[1.01]">
            <h3 className="font-bold text-sm text-[#0F172A] dark:text-white">Progress Tracking</h3>
            <ul className="list-disc list-inside text-xs text-[#64748B] dark:text-[#CBD5E1] mt-3 space-y-1.5 leading-relaxed">
              <li>Scores</li>
              <li>Badges</li>
              <li>Achievements</li>
              <li>Leaderboards</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
