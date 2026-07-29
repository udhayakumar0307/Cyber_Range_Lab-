import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cachedFetch } from '../../utils/apiCache';
import { 
  Search, 
  Clock, 
  CheckCircle2, 
  HelpCircle, 
  Filter, 
  ArrowRight,
  Shield,
  Terminal,
  X
} from 'lucide-react';

interface Lab {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  totalChallenges: number;
  solvedChallenges: number;
  durationHours: number;
  status: 'not_started' | 'in_progress' | 'upcoming' | 'completed';
  timeRemaining?: number;
  timeToStart?: number;
  tags: string[];
  objectives: string[];
  environmentType: string;
  prerequisites: string;
}

export const AvailableLabs: React.FC = () => {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  const [selectedDetailLab, setSelectedDetailLab] = useState<Lab | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStep, setDeploymentStep] = useState(0);

  const [labs, setLabs] = useState<Lab[]>([]);

  useEffect(() => {
    let cancelled = false;

    // cachedFetch deduplicates in-flight requests and caches lab metadata for 5 minutes.
    // Lab metadata (names, categories, modules) is static — safe to cache.
    // User progress (solvedChallenges) is fetched server-side and included in the response.
    cachedFetch<any[]>(apiFetch, '/api/v1/labs', { ttl: 300 })
      .then((items) => {
        if (cancelled) return;
        const normalized = (Array.isArray(items) ? items : []).map((item: any) => {
          const isRecon = item?.id === 'lab1-recon' || item?.id === 'recon-lab' || String(item?.category).toLowerCase().includes('recon');
          const solved = item?.solvedChallenges ?? 0;
          let total = item?.totalChallenges ?? item?.modules?.length ?? 0;
          if (total === 0 || isRecon) {
            total = Math.max(5, total);
          }

          let labStatus: Lab['status'] = 'not_started';
          if (total > 0 && solved >= total) {
            labStatus = 'completed';
          } else if (solved > 0) {
            labStatus = 'in_progress';
          }

          // Read localStorage once during data load, not on every render
          const savedTimeStr = localStorage.getItem(`lab_timer_${item?.id}`);
          const savedTime = savedTimeStr ? parseInt(savedTimeStr, 10) : null;
          const initialRemaining = savedTime && !isNaN(savedTime) && savedTime > 0 ? savedTime : 5400;

          const catRaw = String(item?.category ?? 'linux').toLowerCase();
          let mappedCat = catRaw;
          if (catRaw.includes('recon')) mappedCat = 'recon';
          else if (catRaw.includes('cloud')) mappedCat = 'cloud';
          else if (catRaw.includes('crypto')) mappedCat = 'crypto';
          else if (catRaw.includes('linux')) mappedCat = 'linux';
          else if (catRaw.includes('ot') || catRaw.includes('industrial')) mappedCat = 'ot';

          return {
            id: item?.id ?? '',
            title: item?.title ?? item?.name ?? '',
            category: mappedCat,
            categoryLabel: item?.category ?? 'Network Reconnaissance',
            description: item?.shortDescription ?? '',
            difficulty: String(item?.difficulty ?? 'intermediate').toLowerCase() as Lab['difficulty'],
            totalChallenges: total,
            solvedChallenges: solved,
            durationHours: typeof item?.durationHours === 'number' ? item.durationHours : 1.5,
            status: labStatus,
            timeRemaining: initialRemaining,
            tags: Array.isArray(item?.skillsCovered) ? item.skillsCovered : [mappedCat],
            objectives: [item?.fullDescription ?? item?.shortDescription ?? ''],
            environmentType: item?.dockerImage ?? '',
            prerequisites: (Array.isArray(item?.prerequisites) ? item.prerequisites : []).join(', ') || 'None',
          };
        });
        setLabs(normalized);
      })
      .catch(() => {
        if (!cancelled) setLabs([]);
      });

    return () => { cancelled = true; };
  // apiFetch is stable (useCallback in AuthContext) — safe to include
  }, [apiFetch]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLabs((prevLabs) =>
        prevLabs.map((lab) => {
          if (lab.status === 'in_progress' && lab.timeRemaining && lab.timeRemaining > 0) {
            const nextTime = lab.timeRemaining - 1;
            localStorage.setItem(`lab_timer_${lab.id}`, nextTime.toString());
            return { ...lab, timeRemaining: nextTime };
          }
          if (lab.status === 'upcoming' && lab.timeToStart && lab.timeToStart > 0) {
            const nextTimeToStart = lab.timeToStart - 1;
            if (nextTimeToStart === 0) {
              return {
                ...lab,
                status: 'in_progress',
                timeRemaining: 7200,
                timeToStart: undefined
              };
            }
            return { ...lab, timeToStart: nextTimeToStart };
          }
          return lab;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds?: number) => {
    if (seconds === undefined) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const getDifficultyStyles = (diff: string) => {
    switch (diff) {
      case 'beginner':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'intermediate':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'advanced':
        return 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      case 'expert':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const handleDeployLab = (lab: Lab) => {
    setIsDeploying(true);
    setDeploymentStep(0);

    const stepInterval = setInterval(() => {
      setDeploymentStep((prev) => {
        if (prev >= 3) {
          clearInterval(stepInterval);
          setTimeout(() => {
            setIsDeploying(false);
            setSelectedDetailLab(null);
            const isCll = lab.id === 'command-line-lab' || lab.id.toLowerCase().replace(/[\s_-]+/g, '') === 'commandlinelab';
            const isCrypto = lab.id === 'cryptography-lab' || lab.id.toLowerCase().replace(/[\s_-]+/g, '') === 'cryptographylab';
            const isCloud = lab.id === 'cloud-security-lab' || lab.id.toLowerCase().replace(/[\s_-]+/g, '') === 'cloudsecuritylab';
            if (isCll) {
              navigate('/labs/command-line-lab/session/sess-cll-01');
            } else if (isCrypto) {
              navigate('/labs/cryptography-lab/session/sess-crypto-01');
            } else if (isCloud) {
              navigate('/labs/cloud-security-lab/session/sess-cloud-01');
            } else if (lab.id === 'lab1-recon' || lab.id === 'recon-lab') {
              navigate('/labs/lab1-recon/session/sess-recon-01');
            } else if (lab.id === 'puzzle-lab' || lab.id === 'puzzle') {
              navigate('/labs/puzzle-lab');
            } else {
              navigate(`/labs/${lab.id}/session/sess-123`);
            }
          }, 600);
          return prev;
        }
        return prev + 1;
      });
    }, 850);
  };

  const filteredLabs = labs.filter((lab) => {
    // Exclude puzzle-lab from student Available Labs catalog grid (student accesses Puzzle via sidebar)
    if (lab.id === 'puzzle-lab' || lab.id === 'puzzle') {
      return false;
    }

    const query = searchTerm.toLowerCase().trim();
    const matchesSearch = 
      !query ||
      lab.title.toLowerCase().includes(query) || 
      lab.description.toLowerCase().includes(query) ||
      lab.category.toLowerCase().includes(query) ||
      lab.tags.some(tag => tag.toLowerCase().includes(query));
    
    const matchesCategory = 
      selectedCategory === 'all' || 
      lab.category === selectedCategory ||
      (selectedCategory === 'recon' && lab.category.includes('recon')) ||
      (selectedCategory === 'cloud' && lab.category.includes('cloud')) ||
      (selectedCategory === 'crypto' && lab.category.includes('crypto')) ||
      (selectedCategory === 'linux' && lab.category.includes('linux')) ||
      (selectedCategory === 'ot' && (lab.category.includes('ot') || lab.category.includes('industrial')));

    const matchesDifficulty = selectedDifficulty === 'all' || lab.difficulty === selectedDifficulty;
    const matchesStatus = selectedStatus === 'all' || lab.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesDifficulty && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header title node */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Available Labs</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Access training scenarios allocated to your cybersecurity cohort.
          </p>
        </div>
        <span className="self-start sm:self-center text-xs font-bold text-[#2563EB] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-900">
          {filteredLabs.length} {filteredLabs.length === 1 ? 'Lab' : 'Labs'} Available
        </span>
      </div>

      {/* Filter and Search controls toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          <Filter className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <span>Filter Allocated Catalog</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative lg:col-span-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#2563EB] transition-all"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#2563EB] transition-all"
          >
            <option value="all">All Domains</option>
            <option value="linux">Linux Infrastructure</option>
            <option value="cloud">Cloud &amp; Infrastructure Security</option>
            <option value="crypto">Cryptography &amp; Security</option>
            <option value="recon">Network Reconnaissance</option>
            <option value="ot">OT &amp; Industrial Security</option>
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#2563EB] transition-all"
          >
            <option value="all">All Difficulties</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#2563EB] transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="upcoming">Upcoming (Locked)</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Reset button row if filters active */}
        {(searchTerm || selectedCategory !== 'all' || selectedDifficulty !== 'all' || selectedStatus !== 'all') && (
          <div className="flex items-center justify-end pt-1">
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setSelectedDifficulty('all');
                setSelectedStatus('all');
              }}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-lg transition-all whitespace-nowrap cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-1"
              title="Reset all filters"
            >
              <X className="w-3 h-3" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Grid listing */}
      {filteredLabs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 py-12 px-6 text-center shadow-xs transition-colors">
          <HelpCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No training labs match your filters.</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try clearing your filters or search keywords.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLabs.map((lab) => (
            <div
              key={lab.id}
              className={`bg-white dark:bg-slate-900 rounded-xl border shadow-xs flex flex-col justify-between overflow-hidden transition-all ${
                lab.status === 'in_progress' 
                  ? 'border-emerald-300 dark:border-emerald-800 ring-2 ring-emerald-500/10' 
                  : lab.status === 'upcoming' 
                  ? 'border-amber-200 dark:border-amber-800 bg-amber-50/10 dark:bg-amber-950/10' 
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                    {lab.categoryLabel}
                  </span>
                  <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full ${getDifficultyStyles(lab.difficulty)}`}>
                    {lab.difficulty.toUpperCase()}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base leading-snug">
                    {lab.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed line-clamp-3">
                    {lab.description}
                  </p>
                </div>

                {lab.status !== 'upcoming' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <span>Challenges Progress</span>
                      <span>{lab.solvedChallenges} / {lab.totalChallenges} Solved</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${lab.status === 'completed' ? 'bg-[#10B981]' : 'bg-[#2563EB]'}`}
                        style={{ width: `${(lab.solvedChallenges / lab.totalChallenges) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {lab.tags.map((tag, idx) => (
                    <span key={idx} className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
                {lab.status === 'in_progress' ? (
                  <>
                    <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatTime(lab.timeRemaining)} left</span>
                    </div>
                    <button
                      onClick={() => {
                        const isCll = lab.id === 'command-line-lab' || lab.id.toLowerCase().replace(/[\s_-]+/g, '') === 'commandlinelab';
                        const isCrypto = lab.id === 'cryptography-lab' || lab.id.toLowerCase().replace(/[\s_-]+/g, '') === 'cryptographylab';
                        const isCloud = lab.id === 'cloud-security-lab' || lab.id.toLowerCase().replace(/[\s_-]+/g, '') === 'cloudsecuritylab';
                        if (isCll) {
                          navigate('/labs/command-line-lab/session/sess-cll-01');
                        } else if (isCrypto) {
                          navigate('/labs/cryptography-lab/session/sess-crypto-01');
                        } else if (isCloud) {
                          navigate('/labs/cloud-security-lab/session/sess-cloud-01');
                        } else if (lab.id === 'lab1-recon' || lab.id === 'recon-lab') {
                          navigate('/labs/lab1-recon/session/sess-recon-01');
                        } else {
                          navigate(`/labs/${lab.id}/session/sess-123`);
                        }
                      }}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors shadow-xs"
                    >
                      Resume Lab
                    </button>
                  </>
                ) : lab.status === 'upcoming' ? (
                  <>
                    <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 animate-pulse">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Starts in {formatTime(lab.timeToStart)}</span>
                    </div>
                    <button
                      disabled
                      className="bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 font-semibold text-xs px-3.5 py-1.5 rounded-lg cursor-not-allowed"
                    >
                      Locked
                    </button>
                  </>
                ) : lab.status === 'completed' ? (
                  <>
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Completed</span>
                    </div>
                    <button
                      onClick={() => setSelectedDetailLab(lab)}
                      className="text-[#2563EB] dark:text-blue-400 hover:underline font-bold text-xs inline-flex items-center gap-1"
                    >
                      Review Score
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Duration: {lab.durationHours} hrs</span>
                    <button
                      onClick={() => setSelectedDetailLab(lab)}
                      className="bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <span>Start Lab</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      {selectedDetailLab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95">
            {isDeploying ? (
              <div className="bg-slate-950 font-mono text-xs text-emerald-400 p-6 h-[380px] flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-400 border-b border-slate-800 pb-2 mb-3">
                    <Terminal className="w-4 h-4 text-emerald-500" />
                    <span>CyberRange Deployment telemetry</span>
                  </div>
                  
                  {deploymentStep >= 0 && (
                    <p className="animate-in fade-in duration-300">
                      <span className="text-blue-400">&gt;</span> Requesting auth credential token... [OK]
                    </p>
                  )}
                  {deploymentStep >= 1 && (
                    <p className="animate-in fade-in duration-300">
                      <span className="text-blue-400">&gt;</span> Allocating cloud sandbox container nodes... [OK]
                    </p>
                  )}
                  {deploymentStep >= 2 && (
                    <p className="animate-in fade-in duration-300">
                      <span className="text-blue-400">&gt;</span> Establishing secure port-forward bridges... [OK]
                    </p>
                  )}
                  {deploymentStep >= 3 && (
                    <p className="animate-in fade-in duration-300 text-emerald-300 font-bold">
                      <span className="text-blue-400">&gt;</span> Mounting workspaces and targets... [OK]
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[11px] font-bold text-slate-400">
                      {deploymentStep < 3 ? 'Spinning up container environment...' : 'Provisioning completed successfully!'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">Instance ID: cystar-db-{selectedDetailLab.id}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-0.5 rounded-full">
                      {selectedDetailLab.categoryLabel}
                    </span>
                    <h3 className="font-black text-slate-900 dark:text-white text-base mt-1">{selectedDetailLab.title}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedDetailLab(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4 text-slate-800 dark:text-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Overview</span>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {selectedDetailLab.description}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Learning Objectives</span>
                    <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-300 mt-1.5 space-y-1">
                      {selectedDetailLab.objectives.map((obj, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg">
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Duration</span>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 mt-0.5 block">{selectedDetailLab.durationHours} Hours Max</span>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg">
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Difficulty</span>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 mt-0.5 block capitalize">{selectedDetailLab.difficulty}</span>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg">
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Points Target</span>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 mt-0.5 block">{selectedDetailLab.totalChallenges * 25} points</span>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg">
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Platform</span>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 mt-0.5 block truncate">{selectedDetailLab.environmentType}</span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
                    <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px]">Prerequisites:</span>
                    <span className="font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[10px]">{selectedDetailLab.prerequisites}</span>
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setSelectedDetailLab(null)}
                    className="bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs px-4 py-2 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                  {selectedDetailLab.status !== 'completed' && (
                    <button
                      onClick={() => handleDeployLab(selectedDetailLab)}
                      className="bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow-xs inline-flex items-center gap-1.5"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Spin Up Lab</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
