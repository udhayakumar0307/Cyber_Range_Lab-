import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { 
  Clock, 
  ArrowRight,
  Shield,
  Terminal,
  Layers,
  BookOpen,
  Calendar,
  CheckCircle2
} from 'lucide-react';

interface RentalPurchase {
  id: number;
  lab_id: string;
  lab_name: string;
  hours_purchased: number;
  hours_used: number;
  hours_remaining: number;
  expires_at: string;
}

export const MyLabsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rentals, setRentals] = useState<RentalPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
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

  const fetchPurchasedRentals = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/v1/user/rentals', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to fetch purchased labs.');
      setRentals(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error loading purchased labs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchasedRentals();
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
          } else {
            navigate(`/labs/${targetLabId}/session/sess-123`);
          }
        }, 1500);
      }
    };
    setTimeout(addLog, 200);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-[#2563EB]" />
          My Purchased Labs
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Monitor your active learning subscriptions, hourly sandbox allocations, and remaining time balances.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 font-semibold">Loading purchased assets...</div>
      ) : errorMsg ? (
        <div className="p-4 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold text-center">
          {errorMsg}
        </div>
      ) : rentals.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <Layers className="w-12 h-12 text-blue-500 mx-auto animate-pulse" />
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">No Purchased Labs</h3>
            <p className="text-xs text-slate-500 mt-1">Explore Available Labs in the marketplace to get started.</p>
          </div>
          <button
            onClick={() => navigate('/labs')}
            className="px-4 py-2 bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1"
          >
            Go to Available Labs <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rentals.map((lab) => {
            const hasHours = lab.hours_remaining > 0;
            return (
              <div 
                key={lab.id} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-all relative overflow-hidden group"
              >
                {/* Header status */}
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${hasHours ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-rose-600 bg-rose-50 border-rose-200'} uppercase tracking-wider`}>
                    {hasHours ? 'Active' : 'Expired'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    License ID: #{lab.id}
                  </span>
                </div>

                {/* Lab Title */}
                <div className="mb-4">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-[#2563EB] transition-colors">
                    {lab.lab_name}
                  </h3>
                </div>

                {/* Hours Breakdown */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3.5 mb-4 text-center">
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Purchased</div>
                    <div className="text-base font-black text-slate-800 dark:text-white mt-0.5">{lab.hours_purchased}h</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Used</div>
                    <div className="text-base font-black text-slate-600 dark:text-slate-400 mt-0.5">{lab.hours_used}h</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Remaining</div>
                    <div className={`text-base font-black mt-0.5 ${hasHours ? 'text-emerald-500' : 'text-rose-500'}`}>{lab.hours_remaining}h</div>
                  </div>
                </div>

                {/* Date Limit */}
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-5">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Expiry:</span>
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
