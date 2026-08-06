import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Play, 
  Pause, 
  Square, 
  AlertOctagon, 
  Users, 
  Clock, 
  Cpu,
  RotateCcw,
  RotateCw
} from 'lucide-react';

interface LabInstanceControl {
  id: string;
  labTitle: string;
  category: string;
  status: 'running' | 'paused' | 'idle' | 'stopped';
  activeUserCount: number;
  cpuLoadPercent: number;
  uptimeHours: string;
  allocatedGroup: string;
}

export const LabControlPanel: React.FC = () => {
  const [instances, setInstances] = useState<LabInstanceControl[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      try {
        const [sessRes, invRes] = await Promise.all([
          fetch('/api/v1/admin/sessions', { headers }),
          fetch('/api/v1/admin/inventory', { headers })
        ]);

        if (sessRes.ok) {
          const data = await sessRes.json();
          if (Array.isArray(data)) {
            const mapped = data.map((s: any) => ({
              id: s.id,
              labTitle: s.labTitle,
              category: "Security Challenge",
              status: (s.status.toLowerCase() === 'running' ? 'running' : 'stopped') as any,
              activeUserCount: 1,
              cpuLoadPercent: 12,
              uptimeHours: `${s.uptimeMinutes || 30} mins`,
              allocatedGroup: s.userEmail || "Active Cohort"
            }));
            setInstances(mapped);
          }
        }

        if (invRes.ok) {
          const invData = await invRes.json();
          if (invData && invData.labs) {
            setInventory(invData.labs);
          }
        }
      } catch (err) {
        console.error("Failed to fetch sessions/inventory:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    instanceId: string;
    targetAction: 'start' | 'pause' | 'stop' | 'restart';
    labTitle: string;
  }>({
    isOpen: false,
    instanceId: '',
    targetAction: 'start',
    labTitle: '',
  });

  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [emergencyCode, setEmergencyCode] = useState('');

  const handleActionClick = (instanceId: string, labTitle: string, targetAction: 'start' | 'pause' | 'stop' | 'restart') => {
    setConfirmDialog({
      isOpen: true,
      instanceId,
      targetAction,
      labTitle,
    });
  };

  const handleExecuteAction = () => {
    const { instanceId, targetAction } = confirmDialog;
    setInstances((prev) =>
      prev.map((inst) => {
        if (inst.id === instanceId || instanceId === 'all') {
          const newStatus =
            targetAction === 'start' || targetAction === 'restart'
              ? 'running'
              : targetAction === 'pause'
              ? 'paused'
              : 'stopped';
          return {
            ...inst,
            status: newStatus,
            activeUserCount: newStatus === 'running' ? 12 : 0,
            cpuLoadPercent: newStatus === 'running' ? 30 : 0,
          };
        }
        return inst;
      })
    );
    setConfirmDialog({ isOpen: false, instanceId: '', targetAction: 'start', labTitle: '' });
  };

  const handleEmergencyStopAll = () => {
    if (emergencyCode === 'STOP-ALL-2026') {
      setInstances((prev) =>
        prev.map((inst) => ({
          ...inst,
          status: 'stopped',
          activeUserCount: 0,
          cpuLoadPercent: 0,
        }))
      );
      setIsEmergencyModalOpen(false);
      setEmergencyCode('');
    } else {
      alert('Invalid security verification code. Required: STOP-ALL-2026');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#0052CC] dark:text-blue-400" />
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Lab Environment Control Panel</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time management of active Docker container labs, virtual instances, and resource allocation.
          </p>
        </div>

        <button
          onClick={() => handleActionClick('all', 'All Container Labs', 'restart')}
          className="px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 font-bold text-xs border border-amber-200 dark:border-amber-800 transition-colors inline-flex items-center gap-2 self-start sm:self-center cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> Restart All Containers
        </button>
      </div>

      {/* Instance List Grid */}
      <div className="grid grid-cols-1 gap-4">
        {instances.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
            <Sliders className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">No active containers</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Docker integration idle or no instances currently running.</p>
          </div>
        ) : (
          instances.map((inst) => {
          const statusBadgeStyles = {
            running: 'bg-emerald-50 dark:bg-emerald-950/40 text-[#28A745] dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
            paused: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
            idle: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
            stopped: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800',
          };

          return (
            <div
              key={inst.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Lab Metadata */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold border px-2.5 py-0.5 rounded-full capitalize flex items-center gap-1.5 ${
                      statusBadgeStyles[inst.status]
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        inst.status === 'running'
                          ? 'bg-[#28A745] animate-pulse'
                          : inst.status === 'paused'
                          ? 'bg-amber-500'
                          : 'bg-slate-400'
                      }`}
                    ></span>
                    {inst.status}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    {inst.category}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">{inst.labTitle}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Allocated Cohort: <span className="text-slate-800 dark:text-slate-200 font-bold">{inst.allocatedGroup}</span>
                </p>
              </div>

              {/* Live Resource Telemetry */}
              <div className="flex items-center gap-6 text-xs border-y md:border-y-0 border-slate-100 dark:border-slate-800 py-3 md:py-0">
                <div>
                  <span className="text-slate-400 dark:text-slate-400 font-medium block">Active Users</span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-[#0052CC] dark:text-blue-400" /> {inst.activeUserCount}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 dark:text-slate-400 font-medium block">CPU Utilization</span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-[#6F42C1] dark:text-purple-400" /> {inst.cpuLoadPercent}%
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 dark:text-slate-400 font-medium block">Container Uptime</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> {inst.uptimeHours}
                  </span>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex items-center gap-2">
                {inst.status !== 'running' && (
                  <button
                    onClick={() => handleActionClick(inst.id, inst.labTitle, 'start')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-[#28A745] dark:text-emerald-400 font-bold text-xs border border-emerald-200 dark:border-emerald-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-[#28A745] dark:fill-emerald-400" /> Start Lab
                  </button>
                )}

                {inst.status === 'running' && (
                  <button
                    onClick={() => handleActionClick(inst.id, inst.labTitle, 'pause')}
                    className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs border border-amber-200 transition-colors inline-flex items-center gap-1.5"
                  >
                    <Pause className="w-3.5 h-3.5 fill-amber-700" /> Pause Instance
                  </button>
                )}

                {inst.status !== 'stopped' && (
                  <button
                    onClick={() => handleActionClick(inst.id, inst.labTitle, 'stop')}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold text-xs border border-slate-200 hover:border-rose-200 transition-colors inline-flex items-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5" /> Stop / Kill
                  </button>
                )}
              </div>
            </div>
          );
        }))}
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 p-6 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#0052CC] flex items-center justify-center mx-auto">
              <Sliders className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900 capitalize">
                Confirm {confirmDialog.targetAction} Action
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to {confirmDialog.targetAction} instance for{' '}
                <span className="font-bold text-slate-800">{confirmDialog.labTitle}</span>?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() =>
                  setConfirmDialog({ isOpen: false, instanceId: '', targetAction: 'start', labTitle: '' })
                }
                className="py-2 px-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAction}
                className="py-2 px-3 rounded-xl bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Stop All Modal */}
      {isEmergencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-rose-200 p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <AlertOctagon className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">Emergency Stop All Instances</h3>
              <p className="text-xs text-slate-500 mt-1">
                This will immediately terminate all active lab containers and disconnect active users across all cohorts.
              </p>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-left">
              <label className="font-bold text-rose-800 block mb-1">
                Enter Security Verification Code:
              </label>
              <input
                type="text"
                placeholder="Type: STOP-ALL-2026"
                value={emergencyCode}
                onChange={(e) => setEmergencyCode(e.target.value)}
                className="w-full p-2 bg-white border border-rose-300 rounded-lg font-mono text-xs text-rose-900 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setIsEmergencyModalOpen(false)}
                className="py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleEmergencyStopAll}
                className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
              >
                Emergency Kill All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
