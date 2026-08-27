import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { 
  Clock, 
  ArrowRight,
  Shield,
  Terminal,
  User,
  Layers,
  Activity,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Award,
  ChevronLeft,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  History as HistoryIcon
} from 'lucide-react';

interface AssignedLab {
  id: number;
  lab_id: string;
  lab_name: string;
  difficulty: string;
  estimated_time: string;
  assigned_by: string;
  group_name: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  remaining_minutes: number;
  progress_percent: number;
}

interface AssignmentStats {
  assignment_id: number;
  lab_name: string;
  score: number;
  time_taken: string;
  progress_percent: number;
  radar_labels: string[];
  radar_values: number[];
  strong_areas: string[];
  weak_areas: string[];
}

export const AssignedLabsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [labs, setLabs] = useState<AssignedLab[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Tab layout: 'active' | 'history'
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // Stats Details view
  const [selectedStats, setSelectedStats] = useState<AssignmentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Deploy State
  const [selectedDetailLab, setSelectedDetailLab] = useState<any>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    'Provisioning isolated sandbox cluster...',
    'Mounting secure range network bridges...',
    'Attaching scoring engine sensors...',
    'Spawning victim targets and OT simulations...',
    'Injecting objective validation keys...',
    'Finalizing container deployment checks...'
  ];

  const fetchAssignedLabs = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/v1/user/assignments', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to fetch assigned labs.');
      setLabs(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error loading assigned labs.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignmentStats = async (assignId: number) => {
    setStatsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/v1/user/assignments/${assignId}/statistics`, { headers });
      const data = await res.json();
      if (res.ok) {
        setSelectedStats(data);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedLabs();
  }, []);

  const handleDeployLab = (lab: any) => {
    setSelectedDetailLab(lab);
    setIsDeploying(true);
    setTerminalLogs([]);
    setActiveStep(0);

    let stepIndex = 0;
    const addLog = () => {
      if (stepIndex < steps.length) {
        setTerminalLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ${steps[stepIndex]}`
        ]);
        setActiveStep(stepIndex + 1);
        stepIndex++;
        setTimeout(addLog, 1200);
      } else {
        setTerminalLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] SUCCESS: Range environment is healthy.`,
          `[${new Date().toLocaleTimeString()}] Redirecting user to virtual terminal console...`
        ]);
        setTimeout(() => {
          setIsDeploying(false);
          setSelectedDetailLab(null);
          
          const targetLabId = lab.lab_id;
          const normalizedLabId = targetLabId.toLowerCase().replace(/[\s_-]+/g, '');
          const isSysadmin = targetLabId === 'linux-sysadmin-lab' || normalizedLabId === 'linuxsysadminlab';
          const isCll = targetLabId === 'command-line-lab' || normalizedLabId === 'commandlinelab';
          const isCrypto = targetLabId === 'cryptography-lab' || normalizedLabId === 'cryptographylab';
          const isCloud = targetLabId === 'cloud-security-lab' || targetLabId === 'cloudcorp-aws-lab' || normalizedLabId.includes('cloud');
          const isPuzzle = targetLabId === 'techcorp-sysadmin-labs' || targetLabId === 'puzzle-lab' || targetLabId.toLowerCase().includes('puzzle');
          if (isSysadmin) {
            navigate('/labs/linux-sysadmin');
          } else if (isCll) {
            navigate('/labs/command-line-lab/session/sess-cll-01');
          } else if (isCrypto) {
            navigate('/labs/cryptography-lab/session/sess-crypto-01');
          } else if (isCloud) {
            navigate('/labs/cloud-security-lab/session/sess-cloud-01');
          } else if (targetLabId === 'lab1-recon' || targetLabId === 'recon-lab') {
            navigate('/labs/lab1-recon/session/sess-recon-01');
          } else if (isPuzzle) {
            navigate('/puzzle');
          } else {
            navigate(`/labs/${targetLabId}/session/sess-123`);
          }
        }, 1500);
      }
    };
    setTimeout(addLog, 200);
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case 'beginner': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200';
      case 'intermediate': return 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200';
      case 'advanced': return 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200';
      default: return 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200';
    }
  };

  // Filter assignments based on tab selection
  const activeLabs = labs.filter(l => l.status.toLowerCase() !== 'completed');
  const historyLabs = labs.filter(l => l.status.toLowerCase() === 'completed');

  // SVG Radar/Spiderweb helper calculations
  const RadarChart: React.FC<{ labels: string[], values: number[] }> = ({ labels, values }) => {
    const R = 80;
    const cx = 120;
    const cy = 110;
    const n = labels.length;
    const angles = labels.map((_, i) => (2 * Math.PI * i) / n);

    const toXY = (angle: number, r: number) => {
      return {
        x: cx + r * Math.sin(angle),
        y: cy - r * Math.cos(angle)
      };
    };

    // Draw concentric polygon rings (e.g. 20%, 40%, 60%, 80%, 100%)
    const rings = [20, 40, 60, 80, 100];
    const ringPaths = rings.map(pct => {
      const pts = angles.map(a => {
        const pt = toXY(a, (pct / 100) * R);
        return `${pt.x},${pt.y}`;
      });
      return pts.join(' ');
    });

    // Draw value polygon
    const valPoints = angles.map((a, i) => {
      const v = values[i] ?? 0;
      const pt = toXY(a, (v / 100) * R);
      return `${pt.x},${pt.y}`;
    }).join(' ');

    return (
      <svg className="w-full h-[240px] max-w-[280px] mx-auto bg-transparent overflow-visible">
        {/* Ring lines */}
        {ringPaths.map((pts, idx) => (
          <polygon 
            key={idx} 
            points={pts} 
            fill="none" 
            stroke="#E2E8F0" 
            strokeWidth="1" 
            className="dark:stroke-slate-800"
          />
        ))}

        {/* Axis Web Spokes */}
        {angles.map((a, i) => {
          const pt = toXY(a, R);
          return (
            <line 
              key={i} 
              x1={cx} 
              y1={cy} 
              x2={pt.x} 
              y2={pt.y} 
              stroke="#E2E8F0" 
              strokeWidth="1" 
              className="dark:stroke-slate-800"
            />
          );
        })}

        {/* Skill Value Fill Poly */}
        <polygon 
          points={valPoints} 
          fill="rgba(37, 99, 235, 0.15)" 
          stroke="#2563EB" 
          strokeWidth="2.5" 
          className="animate-pulse"
        />

        {/* Dots on corners */}
        {angles.map((a, i) => {
          const v = values[i] ?? 0;
          const pt = toXY(a, (v / 100) * R);
          return (
            <circle 
              key={i} 
              cx={pt.x} 
              cy={pt.y} 
              r="4.5" 
              fill="#2563EB" 
              stroke="white" 
              strokeWidth="1.5" 
              className="dark:stroke-slate-900"
            />
          );
        })}

        {/* Labels text */}
        {angles.map((a, i) => {
          const lp = toXY(a, R + 18);
          // Adjust anchor offsets to center properly
          const align = a === 0 || Math.abs(a - Math.PI) < 0.1 ? 'middle' : (a < Math.PI ? 'start' : 'end');
          return (
            <g key={i}>
              <text 
                x={lp.x} 
                y={lp.y} 
                textAnchor={align} 
                className="text-[9px] font-extrabold fill-slate-500 dark:fill-slate-400"
              >
                {labels[i]}
              </text>
              <text 
                x={lp.x} 
                y={lp.y + 9} 
                textAnchor={align} 
                className="text-[8px] font-black fill-[#2563EB]"
              >
                {values[i]}%
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  // Render Stats Details view
  if (selectedStats) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header Navigation */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <button 
            onClick={() => setSelectedStats(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-extrabold rounded-xl transition-colors cursor-pointer text-slate-700 dark:text-slate-200"
          >
            <ChevronLeft className="w-4 h-4" /> Back to History
          </button>
          <span className="text-[10px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-3 py-1 border border-blue-100 dark:border-blue-900 rounded-full uppercase tracking-wider">
            Assignment Analytics
          </span>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
            {selectedStats.lab_name}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Detailed performance breakdown and skill mapping for this allocation.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Score */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Score Earned</span>
              <span className="text-3xl font-black text-[#2563EB] block">{selectedStats.score}</span>
            </div>
            <Award className="w-10 h-10 text-[#2563EB]/25" />
          </div>

          {/* Card 2: Time Taken */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Time Spent</span>
              <span className="text-3xl font-black text-slate-800 dark:text-slate-100 block">{selectedStats.time_taken}</span>
            </div>
            <Clock className="w-10 h-10 text-slate-400/30" />
          </div>

          {/* Card 3: Completion */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Completion</span>
              <span className="text-3xl font-black text-emerald-500 block">{selectedStats.progress_percent}%</span>
            </div>
            <CheckCircle2 className="w-10 h-10 text-emerald-500/25" />
          </div>

        </div>

        {/* Visual Graph + Areas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          
          {/* Left panel: SVG Spiderweb Radar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[300px] shadow-xs">
            <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-1.5 self-start">
              <Activity className="w-4 h-4 text-[#2563EB]" /> Skill Domain Vector Matrix
            </h3>
            <RadarChart 
              labels={selectedStats.radar_labels} 
              values={selectedStats.radar_values} 
            />
          </div>

          {/* Right panel: Strong / Weak Areas tags */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xs">
            <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-5 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-[#2563EB]" /> Proficiency vectors
            </h3>

            <div className="space-y-5 flex-1">
              {/* Strong Areas */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" /> Strong Domains
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedStats.strong_areas.map((tag, idx) => (
                    <span 
                      key={idx} 
                      className="text-[11px] font-bold px-3 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Weak Areas */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" /> Improvement Areas
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedStats.weak_areas.map((tag, idx) => (
                    <span 
                      key={idx} 
                      className="text-[11px] font-bold px-3 py-1 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Context Notice */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-6 text-[10px] font-semibold text-slate-400 leading-relaxed">
              * Skill mappings and radar vector matrices are dynamically generated based on module completions, solution attempt metrics, and scoring rules recorded within this active assignment's time range.
            </div>

          </div>

        </div>

      </div>
    );
  }

  // Standard tab card listing view
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#2563EB]" />
            Assignments
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Access assigned sandbox ranges and review historical performance logs.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl inline-flex self-start sm:self-center gap-1">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'active' 
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' 
                : 'text-slate-400 hover:text-slate-650'
            }`}
          >
            Active Tasks ({activeLabs.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'history' 
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' 
                : 'text-slate-400 hover:text-slate-650'
            }`}
          >
            History ({historyLabs.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 font-semibold">Loading assignments data...</div>
      ) : errorMsg ? (
        <div className="p-4 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold text-center">
          {errorMsg}
        </div>
      ) : (activeTab === 'active' ? activeLabs : historyLabs).length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-2xs">
          {activeTab === 'active' ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">All Caught Up!</h3>
                <p className="text-xs text-slate-500 mt-1">You have no active lab assignments due at this time.</p>
              </div>
            </>
          ) : (
            <>
              <HistoryIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">No Historical Data</h3>
                <p className="text-xs text-slate-500 mt-1">There are no completed or expired assignments recorded.</p>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(activeTab === 'active' ? activeLabs : historyLabs).map((lab) => {
            const isLive = lab.status.toLowerCase() === 'running';
            return (
              <div 
                key={lab.id} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-all relative overflow-hidden group"
              >
                {/* Top Difficulty Tag & Category */}
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${getDifficultyColor(lab.difficulty)} uppercase tracking-wider`}>
                    {lab.difficulty}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {lab.group_name}
                  </span>
                </div>

                {/* Lab Title */}
                <div className="mb-4">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-[#2563EB] transition-colors">
                    {lab.lab_name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Assigned By: <span className="font-semibold text-slate-700 dark:text-slate-300">{lab.assigned_by}</span>
                  </p>
                </div>

                {/* Date / Expiry Mappings */}
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 mb-4 space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" /> Starts:</span>
                    <span>{new Date(lab.start_datetime).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-slate-400" /> Expires:</span>
                    <span className="text-rose-500 font-bold">{new Date(lab.end_datetime).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-5 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500">
                    <span>Task Progress</span>
                    <span>{lab.progress_percent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${lab.progress_percent}%` }}
                    />
                  </div>
                </div>

                {/* Status indicator & Action Button */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Status</span>
                    <span className={`text-xs font-black ${isLive ? 'text-emerald-500' : 'text-slate-500'}`}>
                      {lab.status}
                    </span>
                  </div>

                  {activeTab === 'active' ? (
                    <button
                      onClick={() => handleDeployLab(lab)}
                      disabled={!isLive}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 shadow-xs ${
                        isLive 
                          ? 'bg-[#2563EB] hover:bg-blue-600 text-white cursor-pointer' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span>{lab.progress_percent > 0 ? 'Resume' : 'Launch'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => fetchAssignmentStats(lab.id)}
                      disabled={statsLoading}
                      className="px-4 py-2 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-250 dark:border-slate-700 hover:border-slate-350 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      View Details
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Terminal Log Modal popup */}
      {selectedDetailLab && isDeploying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-slate-950 font-mono text-xs text-emerald-400 p-6 h-[380px] flex flex-col justify-between max-w-lg w-full rounded-2xl shadow-2xl border border-slate-800">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-400 border-b border-slate-800 pb-2 mb-3">
                <Terminal className="w-4 h-4 text-emerald-500" />
                <span>Provisioning range environment</span>
              </div>
              <div className="space-y-1 overflow-y-auto max-h-[260px] scrollbar-thin">
                {terminalLogs.map((log, idx) => (
                  <div key={idx}>{log}</div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between text-slate-500 pt-2 border-t border-slate-900">
              <span>Deploying task: {selectedDetailLab.lab_name}</span>
              <span>{Math.round((activeStep / steps.length) * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
