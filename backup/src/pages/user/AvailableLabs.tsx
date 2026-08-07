import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context';
import { CertificateTemplate, CertificatePreviewWrapper } from '../../components/user/CertificateTemplate';
import { VectorBadge } from '../../components/user/VectorBadge';
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
  X,
  Share2,
  Download,
  Award,
  ShoppingCart
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
  priceInr?: number;
  isFree?: boolean;
  isPurchased?: boolean;
  assignedBy?: string;
  dueDate?: string;
}

export const AvailableLabs: React.FC = () => {
  const navigate = useNavigate();
  const { user, apiFetch } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlSearch = searchParams.get('search') || searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(urlSearch);

  // Tabs Switcher & Rentals
  const [activeTab, setActiveTab] = useState<'all' | 'purchased'>('all');
  const [rentals, setRentals] = useState<any[]>([]);
  const [rentalsLoading, setRentalsLoading] = useState(false);

  const fetchPurchasedRentals = async () => {
    setRentalsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/v1/user/rentals', { headers });
      if (res.ok) {
        setRentals(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch purchased rentals:', err);
    } finally {
      setRentalsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'purchased') {
      fetchPurchasedRentals();
    }
  }, [activeTab]);

  const [labs, setLabs] = useState<Lab[]>([]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Fetch assigned student training labs directly from filtered API
    apiFetch('/api/v1/labs')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
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
            priceInr: item?.priceInr || 0,
            isFree: item?.isFree !== undefined ? item.isFree : true,
            isPurchased: item?.isPurchased !== undefined ? item.isPurchased : false,
            assignedBy: item?.assignedBy || 'Professor Admin',
            dueDate: item?.dueDate || 'Aug 30, 2026'
          };
        });
        setLabs(normalized);
      })
      .catch(() => {
        if (!cancelled) setLabs([]);
      });

    return () => { cancelled = true; };
  }, [apiFetch, refreshTrigger]);

  useEffect(() => {
    const handleLabPurchased = () => {
      setRefreshTrigger(prev => prev + 1);
    };
    window.addEventListener('lab-purchased', handleLabPurchased);
    return () => {
      window.removeEventListener('lab-purchased', handleLabPurchased);
    };
  }, []);

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
        return 'bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'advanced':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'expert':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  // Sync searchTerm with URL search parameter changes
  useEffect(() => {
    setSearchTerm(urlSearch);
  }, [urlSearch]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    if (val.trim()) {
      setSearchParams({ search: val });
    } else {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('search');
      newParams.delete('q');
      setSearchParams(newParams);
    }
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  const [selectedDetailLab, setSelectedDetailLab] = useState<Lab | null>(null);

  const [isDeploying, setIsDeploying] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  // Cart state for personal workspace: tracks which lab IDs are currently in cart
  const [cartLabIds, setCartLabIds] = useState<Set<string>>(new Set());
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  const fetchCartState = useCallback(async () => {
    if (user?.auth_type === 'SSO') return;
    try {
      const res = await apiFetch('/api/v1/cart');
      if (res.ok) {
        const data = await res.json();
        const ids = new Set<string>((data.items || []).map((item: any) => item.lab_id as string));
        setCartLabIds(ids);
      }
    } catch {
      // ignore cart fetch errors
    }
  }, [apiFetch, user?.auth_type]);

  // Load cart state on mount (personal workspace only)
  useEffect(() => {
    fetchCartState();
  }, [fetchCartState]);

  const steps = [
    'Provisioning isolated sandbox cluster...',
    'Mounting secure range network bridges...',
    'Attaching scoring engine sensors...',
    'Spawning victim targets and OT simulations...',
    'Injecting objective validation keys...',
    'Finalizing container deployment checks...'
  ];

  const handleDeployLab = (lab: Lab) => {
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
          
          setLabs(prevLabs =>
            prevLabs.map(l => l.id === lab.id ? { ...l, status: 'in_progress' } : l)
          );

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
        }, 1500);
      }
    };
    setTimeout(addLog, 200);
  };

  const handleShareAchievement = async (labTitle: string, score: number) => {
    const text = `I just completed the ${labTitle} practical challenge on CyberRange Platform! Final Score: ${score}%! #CyberRange #SecurityAnalytics`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'CyberRange Practical Training Completed',
          text,
          url: window.location.origin
        });
        return;
      } catch (err) {
        console.log('Share dismissed or cancelled:', err);
      }
    }
  };

  const handleDownloadAchievement = async (lab: Lab) => {
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Fetch user certificates to locate the displaying display_certificate_id for the current lab
      const res = await fetch('/api/v1/reporting/certificates', { headers });
      if (!res.ok) {
        throw new Error('Failed to load certificates list.');
      }
      const certs = await res.json();
      const labCert = certs.find((c: any) => c.lab_id === lab.id);
      
      if (!labCert || !labCert.png_url) {
        throw new Error('No generated certificate found for this lab yet.');
      }
      
      // Use helper tool to trigger authenticated blob download for PNG
      const { downloadAuthenticatedFile } = await import('../../utils/exportUtils');
      await downloadAuthenticatedFile(labCert.png_url, `${labCert.display_certificate_id || 'certificate'}.png`);
    } catch (err: any) {
      alert(`Certificate download failed.\nReason: ${err.message}`);
    }
  };

  const filteredLabs = labs.filter((lab) => {
    const labId = (lab.id || '').toLowerCase();
    const labTitle = (lab.title || '').toLowerCase();
    if (
      labId === 'puzzle-lab' || 
      labId === 'puzzle' || 
      labId === 'techcorp-sysadmin-labs' || 
      labId === 'techcorp' ||
      labTitle.includes('techcorp')
    ) {
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

  const isSso = user?.auth_type === 'SSO';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header title node */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {isSso ? 'Assigned Labs' : 'Available Labs'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isSso ? 'Access training scenarios allocated to your cybersecurity cohort.' : 'Explore and enroll in hands-on cybersecurity laboratories.'}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-center">
          <span className="text-xs font-bold text-[#2563EB] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-900">
            {filteredLabs.length} {filteredLabs.length === 1 ? 'Lab' : 'Labs'} {isSso ? 'Assigned' : 'Available'}
          </span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-2 py-3 text-sm font-extrabold transition-all relative cursor-pointer ${
            activeTab === 'all'
              ? 'text-[#2563EB] dark:text-blue-400 border-b-2 border-[#2563EB] -mb-[2px]'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          All Labs
        </button>
        <button
          onClick={() => setActiveTab('purchased')}
          className={`px-2 py-3 text-sm font-extrabold transition-all relative cursor-pointer ${
            activeTab === 'purchased'
              ? 'text-[#2563EB] dark:text-blue-400 border-b-2 border-[#2563EB] -mb-[2px]'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          My Purchased Labs
        </button>
      </div>

      {activeTab === 'all' ? (
        <>
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
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#2563EB] transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold p-0.5 rounded"
                title="Clear search"
              >
                ✕
              </button>
            )}
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
                handleSearchChange('');
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
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {isSso ? 'No labs have been assigned yet by your instructor.' : 'No training labs match your filters.'}
          </p>
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
                {/* Header card metadata */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {lab.categoryLabel}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border capitalize ${getDifficultyStyles(lab.difficulty)}`}>
                    {lab.difficulty}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-extrabold text-slate-950 dark:text-white text-base leading-tight">
                    {lab.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {lab.description}
                  </p>
                </div>

                {/* Progress Indicators */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-400 dark:text-slate-500">Progress</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">
                      {lab.solvedChallenges} / {lab.totalChallenges} Modules
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#2563EB] h-full transition-all duration-500"
                      style={{ width: `${lab.totalChallenges > 0 ? (lab.solvedChallenges / lab.totalChallenges) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Tags metadata */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {lab.tags.map((tag, idx) => (
                    <span key={idx} className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      #{tag}
                    </span>
                  ))}
                </div>

                {isSso && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    <span>Assigned By: {lab.assignedBy}</span>
                    <span>Due: {lab.dueDate}</span>
                  </div>
                )}
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
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Price / Hour</span>
                      {lab.priceInr === 0 || lab.isFree ? (
                        <span className="text-sm font-black text-emerald-500">FREE</span>
                      ) : (
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">₹{(lab.priceInr ?? 0).toLocaleString('en-IN')}</span>
                      )}
                    </div>
                    {/* Personal workspace: purchased → Launch Lab */}
                    {!isSso && lab.isPurchased ? (
                      <button
                        onClick={() => handleDeployLab(lab)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <span>Launch Lab</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : !isSso && !lab.isPurchased ? (
                      /* Non-SSO unpurchased lab: Add to Cart for any lab */
                      cartLabIds.has(lab.id) ? (
                        <button
                          onClick={() => navigate('/cart')}
                          className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>In Cart</span>
                        </button>
                      ) : (
                        <button
                          disabled={addingToCart === lab.id}
                          onClick={async () => {
                            setAddingToCart(lab.id);
                            try {
                              const res = await apiFetch('/api/v1/cart/items', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  lab_id: lab.id,
                                  lab_title: lab.title,
                                  hours_purchased: 1
                                })
                              });
                              if (res.status === 409) {
                                await fetchCartState();
                                navigate('/cart');
                              } else if (res.ok) {
                                await fetchCartState();
                              }
                            } catch (e) {
                              console.error(e);
                            } finally {
                              setAddingToCart(null);
                            }
                          }}
                          className="bg-[#2563EB] hover:bg-blue-600 disabled:opacity-60 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>{addingToCart === lab.id ? 'Adding...' : 'Add to Cart'}</span>
                        </button>
                      )
                    ) : (
                      /* SSO workspace: Launch Lab */
                      <button
                        onClick={() => handleDeployLab(lab)}
                        className="bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <span>{lab.solvedChallenges > 0 ? 'Continue Lab' : 'Launch Lab'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      ) : (
        /* My Purchased Labs Switch view */
        <div className="space-y-6">
          {rentalsLoading ? (
            <div className="py-12 text-center text-slate-500 font-semibold">Loading purchased sandbox hour balances...</div>
          ) : rentals.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-xs">
              <HelpCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">No Purchased Labs</h3>
                <p className="text-xs text-slate-500 mt-1">Rent practical labs from the "All Labs" tab to begin training.</p>
              </div>
              <button
                onClick={() => setActiveTab('all')}
                className="px-4 py-2 bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Browse Catalog
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-2 duration-200">
              {rentals.map((lab) => {
                const hasHours = lab.hours_remaining > 0;
                return (
                  <div 
                    key={lab.id} 
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-all relative overflow-hidden group"
                  >
                    {/* Header status */}
                    <div className="flex justify-between items-center mb-3">
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${hasHours ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900' : 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900'} uppercase tracking-wider`}>
                        {hasHours ? 'Active' : 'Expired'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        License ID: #{lab.id}
                      </span>
                    </div>

                    {/* Lab Title */}
                    <div className="mb-4">
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-[#2563EB] transition-colors leading-tight">
                        {lab.lab_name}
                      </h3>
                    </div>

                    {/* Hours Breakdown */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3.5 mb-4 text-center border border-slate-100 dark:border-slate-800/60">
                      <div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Purchased</div>
                        <div className="text-sm font-black text-slate-800 dark:text-white mt-0.5">{lab.hours_purchased}h</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Used</div>
                        <div className="text-sm font-black text-slate-600 dark:text-slate-400 mt-0.5">{lab.hours_used}h</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Remaining</div>
                        <div className={`text-sm font-black mt-0.5 ${hasHours ? 'text-emerald-500' : 'text-rose-500'}`}>{lab.hours_remaining}h</div>
                      </div>
                    </div>

                    {/* Date Limit */}
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-5">
                      <span className="flex items-center gap-1.5">📅 Expiry:</span>
                      <span className="text-slate-700 dark:text-slate-300 font-bold">{lab.expires_at}</span>
                    </div>

                    {/* Action button */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Workspace</span>
                      <button
                        onClick={() => handleDeployLab(lab)}
                        disabled={!hasHours}
                        className={`px-4 py-2 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 shadow-xs ${
                          hasHours 
                            ? 'bg-[#2563EB] hover:bg-blue-600 text-white cursor-pointer' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <span>Launch</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                    <span>Scoring cluster deployment container logs</span>
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-[260px] scrollbar-thin">
                    {terminalLogs.map((log, idx) => (
                      <div key={idx} className="animate-in fade-in slide-in-from-bottom-1 duration-100">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-900 pt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Task: Provision Isolated Range</span>
                  <span>Step {activeStep} of {steps.length}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#2563EB]">
                      <Award className="w-5 h-5" />
                      <h2 className="font-extrabold text-slate-950 dark:text-white text-base">Certificate & Achievement</h2>
                    </div>
                    <button
                      onClick={() => setSelectedDetailLab(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Review earned credentials and share performance.</p>
                </div>

                <div className="p-6 space-y-4 max-h-[420px] overflow-y-auto">
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 dark:text-slate-500">Final Verification Score</span>
                      <span className="block text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">100% Passed</span>
                    </div>
                    <VectorBadge title={selectedDetailLab.title} points={100} variant="emerald" />
                  </div>

                  <CertificatePreviewWrapper
                    recipientName={user?.name || user?.email.split('@')[0] || 'Student Specialist'}
                    labTitle={selectedDetailLab.title}
                    score={100}
                    completedAt={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    duration="1.5 Hours"
                    certificateId={`CERT-${selectedDetailLab.id.toUpperCase()}-${user?.id || '001'}`}
                  />

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <button
                      onClick={() => handleShareAchievement(selectedDetailLab.title, 100)}
                      className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share Credential</span>
                    </button>
                    <button
                      onClick={() => handleDownloadAchievement(selectedDetailLab)}
                      className="bg-[#2563EB] hover:bg-blue-600 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Certificate</span>
                    </button>
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
                  <button
                    onClick={() => handleDeployLab(selectedDetailLab)}
                    className="bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Spin Up Lab</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
