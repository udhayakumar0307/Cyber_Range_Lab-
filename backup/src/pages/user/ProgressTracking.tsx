import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Clock, 
  TrendingUp, 
  ShieldCheck, 
  Calendar,
  Zap,
  Target,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface DomainProficiency {
  domain: string;
  scorePercentage: number;
  solvedCount: number;
  totalCount: number;
  color: string;
}

export const ProgressTracking: React.FC = () => {
  const [timePeriod, setTimePeriod] = useState('all');
  const [dashboard, setDashboard] = useState<any>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const [dashRes, achRes] = await Promise.all([
        fetch('/api/v1/reporting/dashboard', { headers }),
        fetch('/api/v1/reporting/achievements', { headers })
      ]);

      if (dashRes.ok) {
        const dash = await dashRes.json();
        setDashboard(dash);
      }
      if (achRes.ok) {
        const achs = await achRes.json();
        setAchievements(achs);
      }
      if (!dashRes.ok && !achRes.ok) {
        setErrorMsg('Could not fetch telemetry data from backend API.');
      }
    } catch (err) {
      console.error('Failed to load progress reporting data:', err);
      setErrorMsg('Network connectivity error. Unable to load progress.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Fetching telemetry and achievement records...</p>
      </div>
    );
  }

  const linuxCount = dashboard?.skills?.linux ?? 0;
  const pythonCount = dashboard?.skills?.python ?? 0;
  const cCount = dashboard?.skills?.c ?? 0;
  const cppCount = dashboard?.skills?.cpp ?? 0;

  const domains: DomainProficiency[] = [
    { 
      domain: 'Linux Infrastructure & Shells', 
      scorePercentage: Math.min(Math.round((linuxCount / 5) * 100), 100), 
      solvedCount: linuxCount, 
      totalCount: 5,
      color: 'bg-[#2563EB]' 
    },
    { 
      domain: 'Python Security Automation', 
      scorePercentage: Math.min(Math.round((pythonCount / 5) * 100), 100), 
      solvedCount: pythonCount, 
      totalCount: 5,
      color: 'bg-purple-600' 
    },
    { 
      domain: 'C Exploitations', 
      scorePercentage: Math.min(Math.round((cCount / 5) * 100), 100), 
      solvedCount: cCount, 
      totalCount: 5,
      color: 'bg-emerald-500' 
    },
    { 
      domain: 'C++ Vulnerable Code mapping', 
      scorePercentage: Math.min(Math.round((cppCount / 5) * 100), 100), 
      solvedCount: cppCount, 
      totalCount: 5,
      color: 'bg-amber-500' 
    }
  ];

  const unlockedBadges = achievements ? achievements.filter(a => a.unlocked) : [];
  const weeklyGraph = dashboard?.weekly_graph || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Progress & Achievements</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Analyze your training milestones, skill categories, and study session logs.
          </p>
        </div>

        {/* Date Filter Toolbar */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <select
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-400 font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
          <button 
            onClick={loadData}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 hover:bg-rose-700 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Overview KPI Box Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs transition-colors">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Training Hours</span>
          <span className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1 block">
            {dashboard?.total_training_hours ?? 0} Hours
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5 mt-1">
            <Clock className="w-3 h-3" /> Tracked dynamically from sessions
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs transition-colors">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Average Session</span>
          <span className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1 block">
            {dashboard?.avg_session_duration ?? 0} Mins
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-1 block">Standard average session duration</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs transition-colors">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Badges Unlocked</span>
          <span className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1 block">
            {unlockedBadges.length} Badges
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5 mt-1">
            <Award className="w-3 h-3" /> Out of {achievements?.length ?? 0} milestones
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs transition-colors">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Total Points</span>
          <span className="text-xl font-black text-[#2563EB] dark:text-blue-400 mt-1 block">
            {dashboard?.score ?? 0} Pts
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5 mt-1">
            <TrendingUp className="w-3 h-3" /> Earned from solved challenges
          </span>
        </div>
      </div>

      {/* Row 1 Grid: Skill Domains & Score Trajectory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col justify-between transition-colors">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">Skill Domain Category Ratings</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Solve percentages across security disciplines</p>
          </div>

          <div className="space-y-4 my-6">
            {domains.map((dom, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-300">{dom.domain}</span>
                  <span className="text-slate-800 dark:text-slate-100">{dom.scorePercentage}% ({dom.solvedCount}/{dom.totalCount})</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${dom.color}`}
                    style={{ width: `${dom.scorePercentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-lg text-xs text-[#2563EB] dark:text-blue-400 font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 flex-shrink-0" />
            <span>Completion dynamic rating is {dashboard?.completion_rate ?? 0}%.</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col justify-between transition-colors">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">Weekly Solved Challenge Trajectory</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Daily challenge resolution distribution</p>
          </div>

          <div className="h-44 w-full relative pt-4 pb-2 my-4">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 300 120">
              <line x1="0" y1="20" x2="300" y2="20" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />
              <line x1="0" y1="60" x2="300" y2="60" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />
              <line x1="0" y1="100" x2="300" y2="100" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />

              {weeklyGraph.map((item: any, idx: number) => {
                const val = Math.min(item.solved ?? 0, 5);
                const height = val * 16 + 5;
                const y = 100 - height;
                const x = 20 + idx * 38;
                return (
                  <rect key={idx} x={x} y={y} width="20" height={height} fill="#2563EB" rx="3" opacity="0.85" />
                );
              })}
            </svg>
            <div className="flex justify-between text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-2 px-1">
              {weeklyGraph.map((item: any, idx: number) => (
                <span key={idx}>{item.day} ({item.solved ?? 0})</span>
              ))}
            </div>
          </div>

          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-lg text-xs text-emerald-800 dark:text-emerald-400 font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>Interactive graph pulls from real completion logs.</span>
          </div>
        </div>
      </div>

      {/* Row 2 Grid: Unlocked Badges */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Unlocked Badges & Achievements</h3>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900">
                Verifiable
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Certificates earned from target range completions</p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 my-4 max-h-[300px] overflow-y-auto pr-1">
            {unlockedBadges.length > 0 ? (
              unlockedBadges.map((badge) => (
                <div key={badge.id} className="py-4 flex items-start gap-3.5 first:pt-0 last:pb-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 border border-amber-100 dark:border-amber-900 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{badge.title}</span>
                      <span className="text-[9px] font-bold text-[#2563EB] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 px-1.5 py-0.2 rounded-md">
                        +{badge.reward_points} Pts
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {badge.description}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                No achievements unlocked yet. Start solving lab modules to unlock badges!
              </div>
            )}
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Target className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Next Milestone Certificate Target</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5 block">CyberRange Specialist</span>
              </div>
            </div>
            <button 
              onClick={() => alert('Finish more lab challenges to unlock additional badges.')}
              className="bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-colors shadow-xs"
            >
              Milestone Active
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
