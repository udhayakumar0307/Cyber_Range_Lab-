import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context';
import { VectorBadge } from '../../components/user/VectorBadge';
import { 
  Award, 
  Clock, 
  TrendingUp, 
  ShieldCheck, 
  Calendar,
  Zap,
  Target,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Share2,
  Download,
  Trophy,
  ExternalLink,
  X
} from 'lucide-react';

interface DomainProficiency {
  domain: string;
  scorePercentage: number;
  solvedCount: number;
  totalCount: number;
  color: string;
}

export const ProgressTracking: React.FC = () => {
  const { user } = useAuth();
  const [timePeriod, setTimePeriod] = useState('all');
  const [dashboard, setDashboard] = useState<any>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [allLabs, setAllLabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [domains, setDomains] = useState<DomainProficiency[]>([]);
  const [selectedUnlockedBadge, setSelectedUnlockedBadge] = useState<any | null>(null);

  // Certificate modal state
  const [certModalBadge, setCertModalBadge] = useState<any | null>(null);
  const [certData, setCertData] = useState<any | null>(null);
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

      const [dashRes, achRes, labsRes] = await Promise.all([
        fetch('/api/v1/reporting/dashboard', { headers }),
        fetch('/api/v1/reporting/achievements', { headers }),
        fetch('/api/v1/labs', { headers })
      ]);

      if (dashRes.ok) {
        const dash = await dashRes.json();
        setDashboard(dash);
      }
      if (achRes.ok) {
        const achs = await achRes.json();
        const sorted = (achs || []).sort((a: any, b: any) => (a.reward_points || 0) - (b.reward_points || 0));
        setAchievements(sorted);
      }
      if (labsRes.ok) {
        const labs = await labsRes.json();
        setAllLabs(labs);
        
        const colors = [
          'bg-[#2563EB]', 'bg-purple-600', 'bg-emerald-500', 
          'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'
        ];
        
        const uniqueDomainsMap = new Map();
        labs.forEach((lab: any) => {
          const domainName = lab.title || lab.name;
          if (!uniqueDomainsMap.has(domainName)) {
            const totalCount = lab.modules ? lab.modules.length : 0;
            const solvedCount = lab.solvedChallenges || 0;
            const scorePercentage = totalCount > 0 ? Math.min(Math.round((solvedCount / totalCount) * 100), 100) : 0;
            
            uniqueDomainsMap.set(domainName, {
              domain: domainName,
              scorePercentage,
              solvedCount,
              totalCount,
              color: colors[uniqueDomainsMap.size % colors.length]
            });
          }
        });
        
        setDomains(Array.from(uniqueDomainsMap.values()));
      }
      
      if (!dashRes.ok && !achRes.ok && !labsRes.ok) {
        setErrorMsg('Could not fetch telemetry data from backend API.');
      }
    } catch (err) {
      console.error('Failed to load progress reporting data:', err);
      setErrorMsg('Network connectivity error. Unable to load progress.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCertificate = async (badge: any) => {
    setCertModalBadge(badge);
    setCertData(null);
    setCertError(null);
    setCertLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/v1/reporting/certificates', { headers });
      if (!res.ok) throw new Error('Failed to load certificates');
      const certs: any[] = await res.json();
      // Match strictly by the certificate_id the achievements API already resolved
      const match = certs.find(
        (c) => c.display_certificate_id === badge.certificate_id
      );
      if (match && match.png_url) {
        setCertData(match);
      } else {
        // No fallback — show an honest error
        setCertError('Certificate not found. It may still be generating — please try again in a moment.');
      }
    } catch (err: any) {
      setCertError(err.message || 'Failed to load certificate.');
    } finally {
      setCertLoading(false);
    }
  };

  const handleShareAchievement = async (data: { labTitle: string; totalScore: number; username: string }) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `CyberRange Certificate - ${data.labTitle}`,
          text: `I completed ${data.labTitle} on CyberRange! Score: +${data.totalScore} pts.`,
          url: window.location.href,
        });
        return;
      } catch (err) {
        console.log('Share cancelled:', err);
      }
    }
    alert(`Certificate generated for ${data.labTitle}. Verify at CyberRange official portal.`);
  };

  const handleDownloadBadgeCard = (badge: any) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw premium background gradient
    const grad = ctx.createLinearGradient(0, 0, 800, 500);
    grad.addColorStop(0, '#0F172A'); // deep slate navy
    grad.addColorStop(1, '#1E293B');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 500);

    // 2. Draw border
    ctx.strokeStyle = '#D4AF37'; // Gold
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 792, 492);

    // Inner gold frame
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 16, 768, 468);

    // 3. Draw grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let x = 40; x < 800; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 500);
      ctx.stroke();
    }
    for (let y = 40; y < 500; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(800, y);
      ctx.stroke();
    }

    // 4. Brand text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 24px "Plus Jakarta Sans", "Segoe UI", sans-serif';
    ctx.fillText('CYBER RANGE', 40, 60);
    
    ctx.fillStyle = '#FBD86B'; // Gold light
    ctx.font = 'bold 9px "Plus Jakarta Sans", "Segoe UI", sans-serif';
    ctx.fillText('LEARN. PRACTICE. DEFEND.', 40, 80);

    // 5. Draw Badge Icon representation in the center-left
    const bx = 200;
    const by = 260;
    ctx.shadowColor = '#D4AF37';
    ctx.shadowBlur = 15;
    
    // Draw Shield Polygon
    ctx.fillStyle = '#1E3A8A';
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bx, by - 60);
    ctx.lineTo(bx + 52, by - 30);
    ctx.lineTo(bx + 52, by + 20);
    ctx.lineTo(bx, by + 56);
    ctx.lineTo(bx - 52, by + 20);
    ctx.lineTo(bx - 52, by - 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inside lock/star graphic
    ctx.fillStyle = '#FBD86B';
    ctx.font = '900 24px "Segoe UI Symbol", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆', bx, by - 5);

    // 6. Right side details
    const tx = 320;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Achievement Unlocked title
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 12px "Plus Jakarta Sans", "Segoe UI", sans-serif';
    ctx.fillText('ACHIEVEMENT UNLOCKED', tx, 170);

    // Badge Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 36px "Plus Jakarta Sans", "Segoe UI", sans-serif';
    ctx.fillText(badge.title, tx, 220);

    // Description text (word wrapped)
    ctx.fillStyle = '#94A3B8'; // Slate 400
    ctx.font = '14px "Plus Jakarta Sans", "Segoe UI", sans-serif';
    const words = badge.description.split(' ');
    let line = '';
    let currY = 260;
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      if (testLine.length > 35 && n > 0) {
        ctx.fillText(line, tx, currY);
        line = words[n] + ' ';
        currY += 22;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, tx, currY);

    // Student Name
    const name = user?.name || user?.email.split('@')[0] || 'CyberRange Specialist';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 13px "Plus Jakarta Sans", "Segoe UI", sans-serif';
    ctx.fillText(`Awarded to: ${name}`, tx, currY + 50);

    // Earned Date
    const date = badge.earned_at ? new Date(badge.earned_at).toLocaleDateString() : new Date().toLocaleDateString();
    ctx.fillStyle = '#64748B'; // Slate 500
    ctx.font = '500 11px "Plus Jakarta Sans", "Segoe UI", sans-serif';
    ctx.fillText(`Earned on: ${date}`, tx, currY + 70);

    // Trigger download
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${badge.id}_achievement_card.png`;
    link.href = dataUrl;
    link.click();
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

          <div className="divide-y divide-slate-100 dark:divide-slate-800 my-4 pr-1">
            {achievements && achievements.length > 0 ? (
              achievements.map((badge, idx) => (
                <div key={badge.id} className={`py-4 flex items-center justify-between gap-3.5 border-b border-slate-100 dark:border-slate-800/80 last:border-0 ${!badge.unlocked ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3.5">
                    <VectorBadge
                      title={badge.title}
                      points={badge.reward_points}
                      variant={!badge.unlocked ? 'purple' : (idx % 4 === 0 ? 'gold' : idx % 4 === 1 ? 'emerald' : idx % 4 === 2 ? 'blue' : 'purple')}
                      size="sm"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">{badge.title}</span>
                        <span className="text-[10px] font-extrabold text-[#2563EB] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 px-2 py-0.5 rounded-full">
                          +{badge.reward_points} Pts
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {badge.description}
                      </p>
                    </div>
                  </div>
                  {badge.unlocked ? (
                    badge.certificate_id ? (
                      // Badge is unlocked AND has a certificate → show enabled View Certificate button
                      <button
                        onClick={() => handleOpenCertificate(badge)}
                        className="shrink-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Award className="w-3 h-3" /> View Certificate
                      </button>
                    ) : (
                      // Badge is unlocked but NO certificate (e.g. First Lab, Fast Solver) → disabled label
                      <span className="shrink-0 text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-not-allowed select-none">
                        <CheckCircle2 className="w-3 h-3" /> Badge Earned
                      </span>
                    )
                  ) : (
                    // Badge is locked → need more points
                    <span className="shrink-0 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-800">
                      Need points to unlock
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                No achievements found.
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

      {/* Completed Labs & Verifiable Achievement Cards Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs transition-colors space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Completed Lab Statistics & Achievement Cards</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Direct access to verifiable completion certificates, scores, and downloadable achievement cards.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {allLabs.map((lab) => {
            const totalModules = lab.totalChallenges ?? lab.modules?.length ?? 5;
            const solvedModules = lab.solvedChallenges ?? 0;
            const isCompleted = lab.status === 'completed' || (totalModules > 0 && solvedModules >= totalModules);
            const scoreVal = isCompleted ? (totalModules * 200 || 1000) : (solvedModules * 200);
            const maxScoreVal = totalModules * 200 || 1000;
            const percentVal = isCompleted ? 100 : (totalModules > 0 ? Math.round((solvedModules / totalModules) * 100) : 0);

            return (
              <div 
                key={lab.id} 
                className={`p-4 rounded-xl border ${
                  isCompleted 
                    ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20' 
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
                } flex flex-col justify-between space-y-3 transition-colors`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">{lab.title || lab.name}</h4>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">{lab.category || 'Infrastructure Security'}</span>
                  </div>
                  {isCompleted ? (
                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Completed
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold text-[10px] rounded-full">
                      In Progress ({percentVal}%)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px]">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Final Score</span>
                    <span className="font-extrabold text-blue-600 dark:text-blue-400">{scoreVal} / {maxScoreVal}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Completion</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{percentVal}%</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Badge</span>
                    <span className="font-extrabold text-amber-500">🏅 Range Master</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-semibold text-slate-400">
                    {isCompleted ? '✓ Verifiable Credential Issued' : `${solvedModules}/${totalModules} Modules Solved`}
                  </span>

                  {isCompleted && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleShareAchievement({
                          labTitle: lab.title || lab.name,
                          totalScore: scoreVal,
                          username: user?.name || user?.email || 'CyberRange Student'
                        })}
                        className="px-3 py-1 bg-[#2563EB] hover:bg-blue-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors shadow-xs"
                        title="Download or share achievement card PNG"
                      >
                        <Share2 className="w-3 h-3" /> Share / Card
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Certificate Viewer Modal */}
      {certModalBadge && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl relative w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Your Certificate</h3>
                {certData && (
                  <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full">
                    {certData.display_certificate_id}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setCertModalBadge(null); setCertData(null); setCertError(null); }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {certLoading && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-500 font-semibold">Loading your certificate...</p>
                </div>
              )}

              {certError && !certLoading && (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                  <AlertCircle className="w-10 h-10 text-amber-400" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{certError}</p>
                  <p className="text-xs text-slate-400">Complete the associated lab to generate your certificate.</p>
                </div>
              )}

              {certData && !certLoading && (
                <div className="space-y-4">
                  {/* Certificate PNG Preview */}
                  <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg">
                    <img
                      src={certData.png_url}
                      alt={`Certificate - ${certData.lab_title}`}
                      className="w-full h-auto object-contain"
                    />
                  </div>

                  {/* Certificate Details Row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700 text-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Certificate ID</span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100 mt-1 block font-mono">{certData.display_certificate_id}</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700 text-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Issued On</span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100 mt-1 block">
                        {certData.completion_date ? new Date(certData.completion_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Today'}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700 text-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-1 flex items-center justify-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> VALID
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            {certData && (
              <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <a
                  href={`/certificate/verify/${certData.display_certificate_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Verify Online
                </a>
                <a
                  href={certData.pdf_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#0B1F3A] hover:bg-[#142d54] text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </a>
                <a
                  href={certData.png_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" /> Download PNG
                </a>
                <button
                  onClick={() => { setCertModalBadge(null); setCertData(null); setCertError(null); }}
                  className="ml-auto px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}

            {!certData && !certLoading && (
              <div className="flex justify-end px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  onClick={() => { setCertModalBadge(null); setCertError(null); }}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
