import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  category: 'windows' | 'web' | 'linux' | 'ai';
  categoryLabel: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  totalChallenges: number;
  solvedChallenges: number;
  durationHours: number;
  status: 'not_started' | 'in_progress' | 'upcoming' | 'completed';
  timeRemaining?: number; // live container countdown in seconds
  timeToStart?: number; // upcoming scheduled container countdown in seconds
  tags: string[];
  objectives: string[];
  environmentType: string;
  prerequisites: string;
}

export const AvailableLabs: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  // Modal & Deployment States
  const [selectedDetailLab, setSelectedDetailLab] = useState<Lab | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStep, setDeploymentStep] = useState(0);

  // Mock list of allocated training labs
  const [labs, setLabs] = useState<Lab[]>([
    {
      id: 'lab-1',
      title: 'Active Directory Security Basics',
      category: 'windows',
      categoryLabel: 'Windows Domain Security',
      description: 'Learn the fundamentals of Windows Active Directory structure, enumeration vectors, and standard security misconfigurations.',
      difficulty: 'advanced',
      totalChallenges: 8,
      solvedChallenges: 2,
      durationHours: 3,
      status: 'in_progress',
      timeRemaining: 7342, // 2 hours
      tags: ['AD', 'Enumeration', 'Kerberos'],
      objectives: [
        'Enumerate Active Directory organizational structures',
        'Perform Kerberoasting to harvest system service tickets',
        'Analyze attack path maps using BloodHound analyzer'
      ],
      environmentType: 'Kali Desktop & Windows Domain target',
      prerequisites: 'None'
    },
    {
      id: 'lab-2',
      title: 'AI Prompt Injection Sandpit',
      category: 'ai',
      categoryLabel: 'AI Model Safety',
      description: 'Explore the risk vectors in Large Language Model applications and attempt to bypass safety prompts using jailbreaks.',
      difficulty: 'intermediate',
      totalChallenges: 5,
      solvedChallenges: 0,
      durationHours: 2,
      status: 'upcoming',
      timeToStart: 495, // 8 mins
      tags: ['LLM', 'Jailbreak', 'OWASP'],
      objectives: [
        'Analyze system prompt leak security guidelines',
        'Construct jailbreak injections to leak admin keys',
        'Implement input validation and semantic filters'
      ],
      environmentType: 'Jupyter Notebook Console',
      prerequisites: 'SQL Injection Sandbox'
    },
    {
      id: 'lab-3',
      title: 'Linux Privilege Escalation Tactics',
      category: 'linux',
      categoryLabel: 'Linux Infrastructure',
      description: 'Hone your local privilege escalation skills on a target Linux container, auditing cron, SUID, and kernel exploits.',
      difficulty: 'intermediate',
      totalChallenges: 6,
      solvedChallenges: 6,
      durationHours: 3,
      status: 'completed',
      tags: ['SUID', 'Cron', 'Exploit'],
      objectives: [
        'Audit SUID/GUID binary privilege vulnerabilities',
        'Exploit misconfigured cron tab execution paths',
        'Leverage kernel versions for local root shells'
      ],
      environmentType: 'Web Terminal Workspace',
      prerequisites: 'None'
    },
    {
      id: 'lab-4',
      title: 'SQL Injection Sandbox Range',
      category: 'web',
      categoryLabel: 'Web Application Security',
      description: 'Practice union-based, error-based, and blind SQL injection methods on a mock target database to retrieve admin keys.',
      difficulty: 'beginner',
      totalChallenges: 4,
      solvedChallenges: 0,
      durationHours: 2,
      status: 'not_started',
      tags: ['SQLi', 'SQL', 'DBMS'],
      objectives: [
        'Analyze blind SQL query response behaviors',
        'Execute union database structure mappings',
        'Retrieve database tables schema parameters'
      ],
      environmentType: 'Web Form & Database Terminal',
      prerequisites: 'None'
    },
    {
      id: 'lab-5',
      title: 'Kubernetes Cluster Hijacking',
      category: 'linux',
      categoryLabel: 'Linux Infrastructure',
      description: 'Investigate misconfigured API services and token leakages to compromise and escape container runtimes to host node systems.',
      difficulty: 'expert',
      totalChallenges: 7,
      solvedChallenges: 0,
      durationHours: 4,
      status: 'not_started',
      tags: ['K8s', 'API Security', 'Escalation'],
      objectives: [
        'Compromise unprotected dashboard services',
        'Extract leaked cluster service account tokens',
        'Escape container contexts to compromise root nodes'
      ],
      environmentType: 'K8s Multi-Node Cluster Terminal',
      prerequisites: 'Linux Privilege Escalation'
    }
  ]);

  // Real-time countdown updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLabs((prevLabs) =>
        prevLabs.map((lab) => {
          if (lab.status === 'in_progress' && lab.timeRemaining && lab.timeRemaining > 0) {
            return { ...lab, timeRemaining: lab.timeRemaining - 1 };
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
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'intermediate':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'advanced':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'expert':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
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
            navigate(`/labs/${lab.id}/session/sess-123`);
          }, 600);
          return prev;
        }
        return prev + 1;
      });
    }, 850);
  };

  // Filter computation logic
  const filteredLabs = labs.filter((lab) => {
    const matchesSearch = 
      lab.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      lab.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lab.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || lab.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'all' || lab.difficulty === selectedDifficulty;
    const matchesStatus = selectedStatus === 'all' || lab.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesDifficulty && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header title node */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Available Labs</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Access training scenarios allocated to your cybersecurity cohort.
          </p>
        </div>
        <span className="self-start sm:self-center text-xs font-bold text-[#0052CC] bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
          {filteredLabs.length} {filteredLabs.length === 1 ? 'Lab' : 'Labs'} Available
        </span>
      </div>

      {/* Filter and Search controls toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <Filter className="w-4 h-4 text-slate-400" />
          <span>Filter Allocated Catalog</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Query search input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/15 focus:border-[#0052CC] transition-all"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/15 focus:border-[#0052CC] transition-all"
          >
            <option value="all">All Domains</option>
            <option value="windows">Windows Domain Security</option>
            <option value="web">Web Application Security</option>
            <option value="linux">Linux Infrastructure</option>
            <option value="ai">AI Model Safety</option>
          </select>

          {/* Difficulty Dropdown */}
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/15 focus:border-[#0052CC] transition-all"
          >
            <option value="all">All Difficulties</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>

          {/* Status Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/15 focus:border-[#0052CC] transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="upcoming">Upcoming (Locked)</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Grid listing */}
      {filteredLabs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 px-6 text-center shadow-xs">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">No training labs match your filters.</p>
          <p className="text-xs text-slate-400 mt-1">Try clearing your filters or search keywords.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLabs.map((lab) => (
            <div
              key={lab.id}
              className={`bg-white rounded-xl border shadow-xs flex flex-col justify-between overflow-hidden transition-all ${
                lab.status === 'in_progress' 
                  ? 'border-emerald-300 ring-2 ring-emerald-500/10' 
                  : lab.status === 'upcoming' 
                  ? 'border-amber-200 bg-amber-50/10' 
                  : 'border-slate-200'
              }`}
            >
              {/* Card content top */}
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    {lab.categoryLabel}
                  </span>
                  <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full ${getDifficultyStyles(lab.difficulty)}`}>
                    {lab.difficulty.toUpperCase()}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-slate-800 text-base leading-snug group-hover:text-[#0052CC] transition-colors">
                    {lab.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed line-clamp-3">
                    {lab.description}
                  </p>
                </div>

                {/* Progress bar info */}
                {lab.status !== 'upcoming' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>Challenges Progress</span>
                      <span>{lab.solvedChallenges} / {lab.totalChallenges} Solved</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${lab.status === 'completed' ? 'bg-[#28A745]' : 'bg-[#0052CC]'}`}
                        style={{ width: `${(lab.solvedChallenges / lab.totalChallenges) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {lab.tags.map((tag, idx) => (
                    <span key={idx} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card footer details */}
              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
                {lab.status === 'in_progress' ? (
                  <>
                    <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatTime(lab.timeRemaining)} left</span>
                    </div>
                    <button
                      onClick={() => navigate(`/labs/${lab.id}/session/sess-123`)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors shadow-xs"
                    >
                      Resume Lab
                    </button>
                  </>
                ) : lab.status === 'upcoming' ? (
                  <>
                    <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 animate-pulse">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Starts in {formatTime(lab.timeToStart)}</span>
                    </div>
                    <button
                      disabled
                      className="bg-slate-100 text-slate-400 border border-slate-200 font-semibold text-xs px-3.5 py-1.5 rounded-lg cursor-not-allowed"
                    >
                      Locked
                    </button>
                  </>
                ) : lab.status === 'completed' ? (
                  <>
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Completed</span>
                    </div>
                    <button
                      onClick={() => setSelectedDetailLab(lab)}
                      className="text-[#0052CC] hover:text-blue-700 font-bold text-xs inline-flex items-center gap-1"
                    >
                      Review Score
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-semibold text-slate-500">Duration: {lab.durationHours} hrs</span>
                    <button
                      onClick={() => setSelectedDetailLab(lab)}
                      className="bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
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

      {/* Lab Details Modal Dialog overlay (Page 3.3 preview / Spin-up deployment console) */}
      {selectedDetailLab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95">
            {isDeploying ? (
              /* Deployment Console Screen Overlay */
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
              /* High-Fidelity Details View */
              <>
                {/* Header banner */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                      {selectedDetailLab.categoryLabel}
                    </span>
                    <h3 className="font-black text-slate-900 text-base mt-1">{selectedDetailLab.title}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedDetailLab(null)}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Overview</span>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                      {selectedDetailLab.description}
                    </p>
                  </div>

                  {/* Learning Objectives milestones list */}
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Learning Objectives</span>
                    <ul className="list-disc list-inside text-xs text-slate-600 mt-1.5 space-y-1">
                      {selectedDetailLab.objectives.map((obj, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Four box grid specs */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
                      <span className="text-xs font-extrabold text-slate-700 mt-0.5 block">{selectedDetailLab.durationHours} Hours Max</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Difficulty</span>
                      <span className="text-xs font-extrabold text-slate-700 mt-0.5 block capitalize">{selectedDetailLab.difficulty}</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Points Target</span>
                      <span className="text-xs font-extrabold text-slate-700 mt-0.5 block">{selectedDetailLab.totalChallenges * 25} points</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Platform</span>
                      <span className="text-xs font-extrabold text-slate-700 mt-0.5 block truncate">{selectedDetailLab.environmentType}</span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-100 pt-3">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Prerequisites:</span>
                    <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-[10px]">{selectedDetailLab.prerequisites}</span>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setSelectedDetailLab(null)}
                    className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                  {selectedDetailLab.status !== 'completed' && (
                    <button
                      onClick={() => handleDeployLab(selectedDetailLab)}
                      className="bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow-xs inline-flex items-center gap-1.5"
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
