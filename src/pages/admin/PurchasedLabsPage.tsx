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
      {/* Grid List (3-col Desktop, 2-col Tablet, 1-col Mobile) */}
      {purchasedLabs.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <FlaskConical className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-extrabold text-slate-700 dark:text-slate-200">No active lab licenses purchased yet</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">Explore the lab catalog to add security labs to your organization portal.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {purchasedLabs.map((lab) => (
            <div
              key={lab.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                    {lab.lab_id.includes('cloud') ? 'Cloud' : lab.lab_id.includes('ot') ? 'OT' : lab.lab_id.includes('recon') ? 'Recon' : lab.lab_id.includes('puzzle') ? 'Puzzle' : 'Linux'}
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#28A745] border border-emerald-200">
                    {lab.status || 'Active'}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 line-clamp-1">
                  {lab.lab_title}
                </h3>
              </div>

              <div className="p-5 bg-slate-50/50 dark:bg-slate-800/40 space-y-3 flex-1 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 font-medium">Seats Allocated</span>
                  <span className="font-bold">{lab.assigned_seats} / {lab.total_seats || 50} Seats</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 font-medium">Expiry Date</span>
                  <span className="font-bold">{lab.expiry_date || '2027-01-15'}</span>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                <button
                  onClick={() => handleLaunchLab(lab.lab_id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
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
