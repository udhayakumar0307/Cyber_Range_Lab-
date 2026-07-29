import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Play, RefreshCw } from 'lucide-react';

interface PurchasedLabRecord {
  id: number | string;
  lab_id: string;
  lab_title: string;
  license_key: string;
  total_seats: number;
  assigned_seats: number;
  status: string;
  purchased_date: string;
  expiry_date: string;
}

export const PurchasedLabsPage: React.FC = () => {
  const navigate = useNavigate();

  const [purchasedLabs, setPurchasedLabs] = useState<PurchasedLabRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPurchased = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('/api/v1/admin/purchased-labs', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setPurchasedLabs(data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch purchased labs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPurchased();
  }, []);

  const handleLaunchLab = (labId: string) => {
    const isCll = labId === 'command-line-lab' || labId.toLowerCase().replace(/[\s_-]+/g, '') === 'commandlinelab';
    const isCrypto = labId === 'cryptography-lab' || labId.toLowerCase().replace(/[\s_-]+/g, '') === 'cryptographylab';
    if (isCll) {
      navigate('/labs/command-line-lab/session');
    } else if (isCrypto) {
      navigate('/labs/cryptography-lab/session');
    } else if (labId === 'lab1-recon' || labId === 'recon-lab') {
      navigate('/labs/lab1-recon/session');
    } else {
      navigate(`/labs/${labId}/session`);
    }
  };

  const handleRenew = (labTitle: string) => {
    alert(`Renewing license duration for ${labTitle}... Redirecting to marketplace.`);
    navigate('/admin/labs');
  };

  if (loading) {
    return (
      <div className="min-h-[350px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#0052CC] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-[#0052CC] dark:text-blue-400" />
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Purchased Lab Licenses</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your organization's active security lab licenses, student seat allocations, and renewals.
          </p>
        </div>

        <button
          onClick={() => navigate('/admin/labs')}
          className="bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 self-start sm:self-center cursor-pointer"
        >
          <span>Purchase More Labs</span>
        </button>
      </div>

      {/* Grid List */}
      {purchasedLabs.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <FlaskConical className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-extrabold text-slate-700 dark:text-slate-200">No records available</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">No active lab licenses purchased yet for this organization.</p>
          <button
            onClick={() => navigate('/admin/labs')}
            className="px-4 py-2 bg-[#0052CC] text-white text-xs font-bold rounded-xl shadow-xs"
          >
            Explore Lab Catalog
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {purchasedLabs.map((lab) => (
            <div
              key={lab.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col justify-between"
            >
              {/* Top Banner */}
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black tracking-wider uppercase text-[#0052CC] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-md border border-blue-100 dark:border-blue-800">
                      {lab.status}
                    </span>
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 mt-2">
                      {lab.lab_title}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleRenew(lab.lab_title)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    title="Renew License"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {/* Metadata Details */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 dark:text-slate-400 font-medium block">License Key</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                      {lab.license_key}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 dark:text-slate-400 font-medium block">Valid Until</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {lab.expiry_date}
                    </span>
                  </div>
                </div>

                {/* Progress Bar Seats */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-600 dark:text-slate-400">Seat Utilization</span>
                    <span className="text-slate-900 dark:text-slate-100">
                      {lab.assigned_seats} / {lab.total_seats} Seats
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0052CC] rounded-full transition-all"
                      style={{ width: `${Math.min(100, (lab.assigned_seats / (lab.total_seats || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                  License Status: Active
                </span>

                <button
                  onClick={() => handleLaunchLab(lab.lab_id)}
                  className="px-4 py-2 bg-[#28A745] hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Launch Lab</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
