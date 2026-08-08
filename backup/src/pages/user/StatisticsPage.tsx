import React, { useState, useEffect } from "react";
import {
  Trophy, Award, Clock, Flame, Zap, ShieldCheck,
  Activity, BookOpen, Star, CheckCircle2, Medal,
  Globe, Smartphone, Calendar, ChevronRight,
  User, Users, Crown, Target, TrendingUp,
  AlertCircle, RefreshCw, Puzzle
} from "lucide-react";
import { VectorBadge } from "../../components/user/VectorBadge";
import { useAuth } from "../../context";

type TabId = "overview" | "leaderboard";

// ── Realistic level thresholds (based on total score) ──────────────────────
const LEVEL_THRESHOLDS = [0, 300, 700, 1500, 3000, 5000, 8000, 12000, 17000, 25000];
const computeLevel = (score: number) => {
  let lvl = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (score >= LEVEL_THRESHOLDS[i]) lvl = i + 1;
    else break;
  }
  return Math.min(lvl, LEVEL_THRESHOLDS.length);
};
const computeXP = (score: number) => {
  const lvl = computeLevel(score);
  const min = LEVEL_THRESHOLDS[lvl - 1] ?? 0;
  const max = LEVEL_THRESHOLDS[lvl] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] * 2;
  return { lvl, current: score - min, needed: max - min };
};

// ── Score-based badge unlock ────────────────────────────────────────────────
const computeBadgeUnlocks = (rawBadges: any[], totalScore: number) => {
  const sorted = [...rawBadges].sort((a, b) => (a.reward_points ?? 0) - (b.reward_points ?? 0));
  let cumulative = 0;
  return sorted.map((badge) => {
    cumulative += (badge.reward_points ?? 50);
    const threshold = badge._threshold ?? Math.round(cumulative * 2);
    const isUnlocked = badge.unlocked !== undefined ? badge.unlocked : totalScore >= threshold;
    return { ...badge, unlocked: isUnlocked, _threshold: threshold };
  });
};

export const StatisticsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [stats, setStats] = useState<any>({});
  const [activityGraph, setActivityGraph] = useState<any>(null);
  const [completedLabs, setCompletedLabs] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);

  const [leaderTab, setLeaderTab] = useState<"personal" | "college" | "global">("personal");
  const [userProfile, setUserProfile] = useState<any>(null);
  const [personalHistory, setPersonalHistory] = useState<any[]>([]);
  const [globalRanks, setGlobalRanks] = useState<any[]>([]);
  const [globalTotal, setGlobalTotal] = useState(0);
  const [globalPage, setGlobalPage] = useState(1);
  const [collegeRanks, setCollegeRanks] = useState<any[]>([]);
  const [collegeTotal, setCollegeTotal] = useState(0);
  const [collegePage, setCollegePage] = useState(1);
  const [lbErrorMsg, setLbErrorMsg] = useState("");
  const limit = 10;

  const [userCerts, setUserCerts] = useState<any[]>([]);

  const loadAll = async () => {
    setLoading(true);
    setErrorMsg("");
    const token = localStorage.getItem("token");
    const h: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const [sRes, gRes, lRes, dashRes, achRes, labsRes, profRes, progRes, certsRes] = await Promise.all([
        fetch("/api/v1/user/statistics", { headers: h }),
        fetch("/api/v1/user/activity-graph", { headers: h }),
        fetch("/api/v1/user/completed-labs", { headers: h }),
        fetch("/api/v1/reporting/dashboard", { headers: h }),
        fetch("/api/v1/reporting/achievements", { headers: h }),
        fetch("/api/v1/labs", { headers: h }),
        fetch("/api/v1/auth/me", { headers: h }),
        fetch("/api/v1/reporting/progress", { headers: h }),
        fetch("/api/v1/reporting/certificates/my-certificates", { headers: h }),
      ]);
      
      let fetchedStats: any = {};
      if (sRes.ok) {
        fetchedStats = await sRes.json();
        setStats(fetchedStats);
      }
      if (gRes.ok) setActivityGraph(await gRes.json());
      if (lRes.ok) setCompletedLabs(await lRes.json());
      if (dashRes.ok) setDashboard(await dashRes.json());
      if (achRes.ok) setAchievements(await achRes.json());
      if (certsRes.ok) setUserCerts(await certsRes.json());
      if (labsRes.ok) {
        const labs = await labsRes.json();
        const seen = new Set<string>();
        // ── Deduplicate by id, but KEEP the puzzle labs ──────────────────
        const uniqueLabs = (Array.isArray(labs) ? labs : []).filter((lab: any) => {
          const id = String(lab.id ?? "").toLowerCase();
          const title = String(lab.title ?? lab.name ?? "").toLowerCase();
          const isIgnoredTechCorp =
            id === "techcorp-sysadmin-labs" ||
            id === "techcorp" ||
            title.includes("techcorp");
          if (isIgnoredTechCorp || seen.has(id)) return false;
          seen.add(id);
          return true;
        });

        const colors = ["bg-[#2563EB]", "bg-purple-600", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-teal-500", "bg-indigo-500"];
        setDomains(uniqueLabs.map((lab: any, i: number) => {
          const id = String(lab.id ?? "").toLowerCase();
          const isPuzzle = id.includes("puzzle");
          
          let total = lab.modules?.length ?? lab.totalChallenges ?? 0;
          let solved = lab.solvedChallenges ?? 0;
          
          // If it is puzzle, reflect the level finished correctly
          if (isPuzzle) {
            const pLvl = fetchedStats.puzzle_level ?? 1;
            solved = Math.max(solved, pLvl);
            if (total === 0) total = 34; // default total puzzle challenges
          }

          return {
            domain: lab.title || lab.name,
            scorePercentage: total > 0 ? Math.min(Math.round((solved / total) * 100), 100) : 0,
            solvedCount: solved, totalCount: total, color: colors[i % colors.length],
          };
        }));
      }
      if (profRes.ok) setUserProfile(await profRes.json());
      if (progRes.ok) setPersonalHistory(await progRes.json());
    } catch {
      setErrorMsg("Network error loading statistics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!userProfile) return;
    const token = localStorage.getItem("token");
    const h: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`/api/v1/reporting/leaderboard?type=global&page=${globalPage}&limit=${limit}`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setGlobalRanks(d.ranks || []); setGlobalTotal(d.total || 0); } });
  }, [globalPage, userProfile]);

  useEffect(() => {
    if (!userProfile?.college_id) return;
    const token = localStorage.getItem("token");
    const h: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`/api/v1/reporting/leaderboard?type=college&page=${collegePage}&limit=${limit}`, { headers: h })
      .then(async r => {
        if (r.ok) { const d = await r.json(); setCollegeRanks(d.ranks || []); setCollegeTotal(d.total || 0); setLbErrorMsg(""); }
        else { const e = await r.json(); setLbErrorMsg(e.detail || "Could not load college standings."); }
      });
  }, [collegePage, userProfile]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const toXY = (angle: number, r: number, cx: number, cy: number) => ({
    x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle),
  });
  const isAdmin = (name?: string, email?: string) => {
    const n = (name || "").toLowerCase(); const e = (email || "").toLowerCase();
    return n.includes("sysadmin") || n === "admin" || e.includes("sysadmin") || e.startsWith("admin@");
  };

  const totalScore = stats.total_score ?? 0;
  const { lvl, current: xpCurrent, needed: xpNeeded } = computeXP(totalScore);
  const levelColor = (l: number) =>
    l >= 10 ? "from-yellow-400 to-amber-600" : l >= 7 ? "from-rose-400 to-red-600" : l >= 5 ? "from-emerald-400 to-teal-600" : l >= 3 ? "from-violet-400 to-purple-600" : "from-blue-400 to-indigo-600";

  // Score-based badge computation
  const badgesWithUnlock = computeBadgeUnlocks(achievements, totalScore);
  const unlockedBadges = badgesWithUnlock.filter(b => b.unlocked);

  const weeklyGraph: any[] = dashboard?.weekly_graph || [];
  const maxWeeklySolved = Math.max(1, ...weeklyGraph.map((d: any) => d.solved ?? 0));

  // Radar
  const radarLabels = activityGraph?.labels ?? ["Modules", "Flags", "Hours", "Score", "Puzzle", "Active Days"];
  const radarValues = activityGraph?.values ?? [0, 0, 0, 0, 0, 0];
  const radarRaw = activityGraph?.raw ?? {};
  const radarRawKeys = ["modules", "flags", "hours", "score", "puzzle", "active_days"];
  
  // Real puzzle level calculation
  const puzzleLevel = stats.puzzle_level ?? 1;

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview & Activity", icon: <Activity className="w-4 h-4" /> },
    { id: "leaderboard", label: "Leaderboard & Solves", icon: <Trophy className="w-4 h-4" /> },
  ];

  if (loading) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const nextLockedBadge = badgesWithUnlock.find(b => !b.unlocked);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      {/* Header */}
      <div className="relative bg-gradient-to-r from-indigo-900 via-[#2563EB] to-blue-900 rounded-3xl p-7 text-white shadow-md overflow-hidden">
        <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none"><Activity className="w-64 h-64" /></div>
        <div className="relative">
          <p className="text-blue-200 text-xs font-bold uppercase tracking-widest">Student Portal</p>
          <h1 className="text-3xl font-black tracking-tight mt-0.5">My Statistics</h1>
          <p className="text-blue-200 text-sm mt-1">Progress · Activity · Rankings — all in one place</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-400 font-bold flex items-center justify-between">
          <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4" />{errorMsg}</div>
          <button onClick={loadAll} className="px-3 py-1 bg-rose-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 hover:bg-rose-700 cursor-pointer"><RefreshCw className="w-3 h-3" /> Retry</button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs sm:text-sm font-bold w-full gap-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg transition-all cursor-pointer ${activeTab === t.id ? "bg-white dark:bg-slate-900 text-[#2563EB] shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}>
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ═══ TAB 1: OVERVIEW & ACTIVITY ═══ */}
      {activeTab === "overview" && (
        <div className="space-y-6">

          {/* Level + XP bar — score-based */}
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className={`w-[72px] h-[72px] rounded-2xl bg-gradient-to-br ${levelColor(lvl)} flex flex-col items-center justify-center shadow-lg flex-shrink-0`}>
                <span className="text-white text-[10px] font-bold uppercase tracking-wide">LVL</span>
                <span className="text-white text-2xl font-black leading-none">{lvl}</span>
              </div>
              <div className="flex-1 space-y-1.5 w-full">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#0F172A] dark:text-white">
                    {lvl < 3 ? "Rookie Analyst" : lvl < 5 ? "Security Apprentice" : lvl < 7 ? "Cyber Defender" : lvl < 9 ? "Threat Hunter" : "Elite Operator"}
                  </span>
                  <span className="text-xs font-black text-[#2563EB]">{xpCurrent.toLocaleString()} / {xpNeeded.toLocaleString()} XP</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#2563EB] to-indigo-500 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.round((xpCurrent / xpNeeded) * 100))}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  {(xpNeeded - xpCurrent).toLocaleString()} pts to Level {lvl + 1} — Total Score: <span className="font-bold text-[#2563EB]">{totalScore.toLocaleString()} pts</span>
                </p>
              </div>
            </div>
          </div>

          {/* 7 Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Total Score", value: `${totalScore.toLocaleString()}`, sub: "pts", color: "text-[#2563EB]", bg: "bg-blue-50 dark:bg-blue-950/40", icon: <Trophy className="w-4 h-4" /> },
              { label: "Global Rank", value: `#${stats.global_rank ?? "--"}`, sub: "platform", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/40", icon: <Zap className="w-4 h-4" /> },
              { label: "Modules Done", value: `${stats.modules_completed ?? 0}`, sub: "modules", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", icon: <Award className="w-4 h-4" /> },
              { label: "Puzzle Level", value: `Lv ${puzzleLevel}`, sub: "current", color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/40", icon: <Puzzle className="w-4 h-4" /> },
              { label: "Badges", value: `${unlockedBadges.length}`, sub: `of ${badgesWithUnlock.length}`, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-950/40", icon: <Star className="w-4 h-4" /> },
              { label: "Training Hrs", value: `${stats.training_hours ?? 0}`, sub: "hours", color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/40", icon: <Clock className="w-4 h-4" /> },
              { label: "Active Days", value: `${stats.current_streak_days ?? 0}`, sub: "streak", color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/40", icon: <Flame className="w-4 h-4" /> },
            ].map(m => (
              <div key={m.label} className="bg-white dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-[#334155] p-3.5 shadow-xs flex flex-col gap-1.5">
                <div className={`w-8 h-8 rounded-xl ${m.bg} ${m.color} flex items-center justify-center`}>{m.icon}</div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{m.label}</p>
                <p className={`text-base font-black ${m.color}`}>{m.value} <span className="text-[10px] font-semibold text-slate-400">{m.sub}</span></p>
              </div>
            ))}
          </div>

          {/* Radar + Skill Domain side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Spiderweb Radar */}
            <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-5 shadow-xs">
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2 mb-5"><Activity className="w-4 h-4 text-[#2563EB]" /> Activity Radar</h2>
              {(() => {
                const size = 260; const cx = size / 2; const cy = size / 2; const R = 90;
                const n = radarLabels.length;
                const angles = radarLabels.map((_: any, i: number) => (2 * Math.PI * i) / n);
                const gridPts = [20, 40, 60, 80, 100].map((lvl: number) =>
                  angles.map((a: number) => { const p = toXY(a, (lvl / 100) * R, cx, cy); return `${p.x},${p.y}`; }).join(" ")
                );
                // Dynamically ensure puzzle is reflected on its radar value if it's 0 but level > 0
                const updatedRadarValues = [...radarValues];
                const puzzleIndex = radarLabels.findIndex((l: any) => String(l).toLowerCase().includes("puzzle"));
                if (puzzleIndex !== -1 && updatedRadarValues[puzzleIndex] === 0 && puzzleLevel > 0) {
                  updatedRadarValues[puzzleIndex] = Math.min(100, Math.round((puzzleLevel / 34) * 100));
                }

                const dataPts = angles.map((a: number, i: number) => {
                  const p = toXY(a, ((updatedRadarValues[i] || 0) / 100) * R, cx, cy); return `${p.x},${p.y}`;
                });
                return (
                  <div className="flex flex-col items-center gap-4">
                    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ overflow: "visible" }}>
                      {gridPts.map((pts: string, li: number) => <polygon key={li} points={pts} fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4,4" className="text-slate-300 dark:text-slate-700" />)}
                      {angles.map((a: number, i: number) => { const p = toXY(a, R, cx, cy); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="currentColor" strokeWidth="0.5" className="text-slate-300 dark:text-slate-700" />; })}
                      <polygon points={dataPts.join(" ")} fill="rgba(37,99,235,0.15)" stroke="#2563EB" strokeWidth="2.5" strokeLinejoin="round" />
                      {angles.map((a: number, i: number) => { const p = toXY(a, ((updatedRadarValues[i] || 0) / 100) * R, cx, cy); return <circle key={i} cx={p.x} cy={p.y} r="4.5" fill="#2563EB" stroke="white" strokeWidth="2" />; })}
                      {angles.map((a: number, i: number) => {
                        const lp = toXY(a, R + 26, cx, cy);
                        let valText = radarRaw[radarRawKeys[i]] ?? 0;
                        if (radarRawKeys[i] === "puzzle" && valText === 0 && puzzleLevel > 0) {
                          valText = puzzleLevel;
                        }
                        return (
                          <g key={i}>
                            <text x={lp.x} y={lp.y - 4} textAnchor="middle" style={{ fontSize: "8.5px", fontWeight: 700, fill: "#64748B" }}>{radarLabels[i]}</text>
                            <text x={lp.x} y={lp.y + 8} textAnchor="middle" style={{ fontSize: "8px", fontWeight: 900, fill: "#2563EB" }}>{valText}</text>
                          </g>
                        );
                      })}
                    </svg>
                    <div className="grid grid-cols-3 gap-2 w-full">
                      {radarLabels.map((label: string, i: number) => {
                        let valText = radarRaw[radarRawKeys[i]] ?? 0;
                        if (radarRawKeys[i] === "puzzle" && valText === 0 && puzzleLevel > 0) {
                          valText = puzzleLevel;
                        }
                        return (
                          <div key={label} className="text-center p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                            <p className="text-[9px] font-bold text-slate-400 uppercase truncate">{label}</p>
                            <p className="text-sm font-black text-[#2563EB]">{valText}</p>
                            <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                              <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${updatedRadarValues[i] || 0}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Skill Domain Bars */}
            <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-5 shadow-xs flex flex-col">
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-white mb-1">Skill Domain Ratings</h2>
              <p className="text-xs text-slate-400 mb-4">Solve percentage across security disciplines</p>
              <div className="flex-1 space-y-3">
                {domains.length > 0 ? domains.map((d, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700 dark:text-slate-300 truncate pr-2">{d.domain}</span>
                      <span className="text-slate-600 dark:text-slate-300 flex-shrink-0">{d.scorePercentage}% ({d.solvedCount}/{d.totalCount})</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${d.color}`} style={{ width: `${d.scorePercentage}%` }} />
                    </div>
                  </div>
                )) : <div className="flex-1 flex items-center justify-center text-slate-400 text-xs font-semibold py-6">Complete labs to see domain ratings</div>}
              </div>
              {dashboard && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-lg text-xs text-[#2563EB] font-semibold flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" />Completion rate: {dashboard.completion_rate ?? 0}%
                </div>
              )}
            </div>
          </div>

          {/* Weekly Challenge Chart + Completed Labs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Weekly Chart */}
            <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-5 shadow-xs">
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-white mb-1">Weekly Solved Challenge Trajectory</h2>
              <p className="text-xs text-slate-400 mb-4">Daily challenge resolution — last 7 days</p>
              {weeklyGraph.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <TrendingUp className="w-8 h-8 opacity-30" />
                  <p className="text-xs font-semibold">Complete challenges to populate this chart</p>
                </div>
              ) : (
                <div>
                  <div className="relative h-44 w-full">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {[25, 50, 75].map(y => (
                        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                      ))}
                    </svg>
                    <div className="absolute inset-0 flex items-end gap-1.5 px-2 pb-1">
                      {weeklyGraph.map((item: any, idx: number) => {
                        const val = item.solved ?? 0;
                        const pct = maxWeeklySolved > 0 ? Math.round((val / maxWeeklySolved) * 100) : 0;
                        const minH = val > 0 ? 8 : 2;
                        const barH = Math.max(minH, pct);
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                            <div className="opacity-0 group-hover:opacity-100 text-[9px] font-black text-[#2563EB] transition-opacity">{val}</div>
                            <div
                              className={`w-full rounded-t-md transition-all duration-500 ${val > 0 ? "bg-[#2563EB]" : "bg-slate-200 dark:bg-slate-700"}`}
                              style={{ height: `${barH}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex justify-between px-2 mt-1">
                    {weeklyGraph.map((item: any, idx: number) => (
                      <div key={idx} className="flex-1 text-center">
                        <p className="text-[9px] font-bold text-slate-400">{item.day}</p>
                        <p className="text-[9px] font-black text-[#2563EB]">{item.solved ?? 0}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-lg text-xs text-emerald-700 font-semibold flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" />Pulled from real completion logs
              </div>
            </div>

            {/* Completed Labs */}
            <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-5 shadow-xs flex flex-col">
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-[#2563EB]" /> Completed Labs
                {completedLabs.length > 0 && <span className="ml-auto bg-[#2563EB] text-white text-[9px] font-black rounded-full px-2 py-0.5">{completedLabs.length}</span>}
              </h2>
              {completedLabs.length === 0
                ? <div className="flex-1 flex flex-col items-center justify-center py-8 text-slate-400 gap-2"><div className="text-4xl">🔬</div><p className="text-sm font-bold">No completed labs yet</p></div>
                : <div className="space-y-2 overflow-y-auto max-h-[340px] pr-1">
                    {completedLabs.map((lab, idx) => {
                      const dc = lab.difficulty === "EASY" ? "text-emerald-600 bg-emerald-50 border-emerald-200" : lab.difficulty === "MEDIUM" ? "text-amber-600 bg-amber-50 border-amber-200" : "text-rose-600 bg-rose-50 border-rose-200";
                      return (
                        <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:border-[#2563EB]/30 transition-colors">
                          <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm flex-shrink-0">🧪</div>
                          <div className="flex-1 min-w-0"><p className="font-bold text-xs text-[#0F172A] dark:text-white truncate">{lab.name}</p><div className="flex items-center gap-1.5 mt-1"><span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${dc}`}>{lab.difficulty}</span><span className="text-[10px] text-slate-400">{lab.category}</span></div></div>
                          <div className="text-right flex-shrink-0"><p className="text-xs font-black text-[#2563EB]">+{lab.score} pts</p><p className="text-[9px] text-slate-400">{lab.completed_at || "--"}</p></div>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        </div>
                      );
                    })}
                  </div>
              }
            </div>
          </div>

          {/* Badges & Achievements — score-based unlock & 2-column layout */}
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-[#0F172A] dark:text-white">Badges & Achievements</h2>
                <p className="text-xs text-slate-400">Unlocked based on your total score — {unlockedBadges.length} of {badgesWithUnlock.length} earned</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900">Score-Based</span>
            </div>
            
            <div className="max-h-[380px] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {badgesWithUnlock.length > 0 ? badgesWithUnlock.map((badge, idx) => (
                  <div key={badge.id} className={`p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between gap-3 transition-opacity ${!badge.unlocked ? "opacity-45" : ""}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <VectorBadge title={badge.title} points={badge.reward_points} variant={!badge.unlocked ? "purple" : idx % 4 === 0 ? "gold" : idx % 4 === 1 ? "emerald" : idx % 4 === 2 ? "blue" : "purple"} size="sm" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-black text-[#0F172A] dark:text-white truncate">{badge.title}</span>
                          <span className="text-[9px] font-bold text-[#2563EB] bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 px-1 py-0.5 rounded-full">+{badge.reward_points} Pts</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{badge.description}</p>
                        {!badge.unlocked && (
                          <p className="text-[9px] text-amber-500 font-semibold mt-0.5">
                            Requires {badge._threshold.toLocaleString()} pts
                          </p>
                        )}
                      </div>
                    </div>
                    {badge.unlocked
                      ? <a href={`/certificate/verify/${badge.display_certificate_id || badge.certificate_id || userCerts[0]?.display_certificate_id || "CYR-2026-000002"}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-emerald-600 hover:underline inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex-shrink-0"><ShieldCheck className="w-3.5 h-3.5" />Verify</a>
                      : <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 flex-shrink-0">🔒 Locked</span>}
                  </div>
                )) : <div className="py-8 text-center text-xs text-slate-400 col-span-2">Complete labs to earn badges.</div>}
              </div>
            </div>

            <div className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-rose-500" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Next Badge Unlocks At</span>
                  <span className="text-xs font-bold text-[#0F172A] dark:text-white">
                    {nextLockedBadge 
                      ? `${nextLockedBadge._threshold.toLocaleString()} pts — ${nextLockedBadge.title} (needs ${Math.max(0, nextLockedBadge._threshold - totalScore).toLocaleString()} more)`
                      : "All Badges Unlocked! 🏆"}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-[#2563EB] bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 rounded-lg border border-blue-100 dark:border-blue-900">
                {totalScore.toLocaleString()} pts earned
              </span>
            </div>
          </div>

          {/* Certificates */}
          {completedLabs.length > 0 && (
            <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-5 shadow-xs">
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2 mb-4"><Star className="w-4 h-4 text-amber-500" /> Certificates</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedLabs.slice(0, 6).map((lab, idx) => (
                  <div key={idx} className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 p-4 flex gap-3 items-start hover:shadow-md transition-shadow">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0"><Medal className="w-4 h-4 text-amber-600" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-[#0F172A] dark:text-white truncate">{lab.name}</p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold mt-0.5">Certificate of Completion</p>
                      <p className="text-[9px] text-slate-400">{lab.completed_at || "--"}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session meta */}
          <div className="bg-white dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-[#334155] px-5 py-4 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {[
                { icon: <Calendar className="w-3.5 h-3.5 text-emerald-500" />, label: "Account Created", val: stats.created_at || "--" },
                { icon: <Globe className="w-3.5 h-3.5 text-blue-500" />, label: "Last Login", val: stats.last_login || "Active" },
                { icon: <Smartphone className="w-3.5 h-3.5 text-violet-500" />, label: "College Rank", val: stats.college_rank ? `#${stats.college_rank}` : "--" },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-2 text-slate-500">{r.icon}<span>{r.label}</span><span className="ml-auto font-bold text-[#0F172A] dark:text-white">{r.val}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 2: LEADERBOARD & SOLVES ═══ */}
      {activeTab === "leaderboard" && (
        <div className="space-y-5">

          {/* Sub-tab selector */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold w-full sm:w-max flex-wrap gap-1">
            {([
              { id: "personal", label: "Personal Solves Log", icon: <User className="w-3.5 h-3.5" /> },
              ...(userProfile?.account_type === "STUDENT" ? [{ id: "college", label: "College Standings", icon: <Users className="w-3.5 h-3.5" /> }] : []),
              { id: "global", label: "Global Leaderboard", icon: <Trophy className="w-3.5 h-3.5" /> },
            ] as { id: string; label: string; icon: React.ReactNode }[]).map(t => (
              <button key={t.id} onClick={() => setLeaderTab(t.id as any)} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer ${leaderTab === t.id ? "bg-white dark:bg-slate-900 text-[#2563EB] shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}>{t.icon}{t.label}</button>
            ))}
          </div>

          {/* Personal Solves Table */}
          {leaderTab === "personal" && (
            <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="font-bold text-sm text-[#0F172A] dark:text-white">Personal Scenario Solves History</h3>
                <p className="text-xs text-slate-400 mt-0.5">All modules you have solved across labs</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead><tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase font-bold border-b border-slate-100 dark:border-slate-800"><th className="px-5 py-3">Module ID</th><th className="px-5 py-3">Module Title</th><th className="px-5 py-3">Points</th><th className="px-5 py-3">Attempts</th><th className="px-5 py-3">Completed At</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {personalHistory.length > 0
                      ? personalHistory.map(item => <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50"><td className="px-5 py-3.5 font-bold text-slate-400">{item.module_id}</td><td className="px-5 py-3.5 font-bold text-[#0F172A] dark:text-white">{item.module_title}</td><td className="px-5 py-3.5 font-bold text-[#2563EB]">{item.points} pts</td><td className="px-5 py-3.5 text-slate-500">{item.attempts} attempts</td><td className="px-5 py-3.5 text-slate-400">{item.completed_at}</td></tr>)
                      : <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 font-semibold">No solved flags recorded yet. Complete a lab module to populate!</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* College / Global Table */}
          {(leaderTab === "college" || leaderTab === "global") && (() => {
            const rows = leaderTab === "college" ? collegeRanks : globalRanks;
            const total = leaderTab === "college" ? collegeTotal : globalTotal;
            const page = leaderTab === "college" ? collegePage : globalPage;
            const setPage = leaderTab === "college" ? setCollegePage : setGlobalPage;
            const title = leaderTab === "college" ? "College Cohort Standings" : "Global Range Leaderboard";
            const badge = leaderTab === "college" ? "Active Standings" : "Global Standings";
            return (
              <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] overflow-hidden shadow-xs">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                  <h3 className="font-bold text-sm text-[#0F172A] dark:text-white">{title}</h3>
                  <span className="text-xs font-bold text-[#2563EB] bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-full border border-blue-100 dark:border-blue-900">{badge}</span>
                </div>
                {lbErrorMsg
                  ? <div className="p-6 text-center text-xs font-bold text-rose-500">{lbErrorMsg}</div>
                  : <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead><tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase font-bold border-b border-slate-100 dark:border-slate-800"><th className="px-6 py-3 w-14 text-center">Rank</th><th className="px-6 py-3">Name</th><th className="px-6 py-3">College</th><th className="px-6 py-3 text-right">Score</th></tr></thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            {rows.filter(r => !isAdmin(r.name, r.email)).map((row, idx) => {
                              const rank = idx + 1 + (page - 1) * limit;
                              return (
                                <tr key={row.rank || idx} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${row.is_current ? "bg-blue-50/40 dark:bg-blue-950/30 font-bold" : ""}`}>
                                  <td className="px-6 py-4 text-center font-extrabold text-[#0F172A] dark:text-white">
                                    {rank === 1 ? <span className="inline-flex items-center gap-1 text-amber-500"><Crown className="w-3.5 h-3.5 fill-amber-500" />1</span> : rank === 2 ? <span className="inline-flex items-center gap-1 text-slate-400"><Medal className="w-3.5 h-3.5 fill-slate-300" />2</span> : rank}
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-7 h-7 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${row.is_current ? "bg-emerald-500" : "bg-[#2563EB]"}`}>{row.name.split(" ").map((n: string) => n[0]).join("")}</div>
                                      <span className="font-bold text-[#0F172A] dark:text-white">{row.name}</span>
                                      {row.is_current && <span className="text-[9px] font-black text-[#2563EB] bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded-md">YOU</span>}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-slate-500">{row.college}</td>
                                  <td className="px-6 py-4 text-right font-extrabold text-[#2563EB]">{row.score} pts</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                        <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer">Previous</button>
                        <span className="text-xs font-bold text-slate-500">Page {page} of {Math.ceil(total / limit) || 1}</span>
                        <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer">Next</button>
                      </div>
                    </>}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
