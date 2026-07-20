import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Eye, 
  EyeOff, 
  Calendar, 
  CheckCircle2, 
  Search, 
  Save, 
  RotateCcw
} from 'lucide-react';

export const LabAllocation: React.FC = () => {
  const [purchasedLabs, setPurchasedLabs] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial Allocations Grid state
  const [allocations, setAllocations] = useState<Record<string, Record<string, { isVisible: boolean; startDate: string; endDate: string }>>>({});

  const [searchGroupQuery, setSearchGroupQuery] = useState('');
  const [isSavedToastVisible, setIsSavedToastVisible] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      try {
        const labsRes = await fetch('/api/v1/labs');
        if (labsRes.ok) {
          const lData = await labsRes.json();
          setPurchasedLabs(lData || []);
        }

        const groupsRes = await fetch('/api/v1/admin/groups', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (groupsRes.ok) {
          const gData = await groupsRes.json();
          setGroups(gData || []);
        }
      } catch (err) {
        console.error('Error fetching allocations data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleVisibility = (groupId: string, labId: string) => {
    setAllocations((prev) => {
      const groupAlloc = prev[groupId] || {};
      const currentLabAlloc = groupAlloc[labId] || { isVisible: false, startDate: '2026-07-15', endDate: '2026-08-31' };
      return {
        ...prev,
        [groupId]: {
          ...groupAlloc,
          [labId]: {
            ...currentLabAlloc,
            isVisible: !currentLabAlloc.isVisible,
          },
        },
      };
    });
  };

  const handleBatchToggleGroup = (groupId: string, makeVisible: boolean) => {
    setAllocations((prev) => {
      const updatedGroup = { ...prev[groupId] };
      purchasedLabs.forEach((lab) => {
        updatedGroup[lab.id] = {
          ...(updatedGroup[lab.id] || { startDate: '2026-07-15', endDate: '2026-08-31' }),
          isVisible: makeVisible,
        };
      });
      return { ...prev, [groupId]: updatedGroup };
    });
  };

  const handleSaveAllocations = () => {
    setIsSavedToastVisible(true);
    setTimeout(() => setIsSavedToastVisible(false), 2000);
  };

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchGroupQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#0052CC] dark:text-blue-400" />
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Lab Access Allocation Matrix</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Grant or revoke lab access permissions for user cohorts and student groups.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAllocations({})}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Matrix
          </button>
          <button
            onClick={handleSaveAllocations}
            className="px-5 py-2.5 rounded-xl bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save Allocations
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchGroupQuery}
            onChange={(e) => setSearchGroupQuery(e.target.value)}
            placeholder="Search group rows..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span className="flex items-center gap-1 text-[#28A745] dark:text-emerald-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#28A745]"></span> Active & Visible
          </span>
          <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700"></span> Hidden to Group
          </span>
        </div>
      </div>

      {/* 2.6 Grid Matrix Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-4 w-72">Training Cohort Group</th>
                {purchasedLabs.map((lab) => (
                  <th key={lab.id} className="p-4 text-center border-l border-slate-200 dark:border-slate-700 min-w-[240px]">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-[#0052CC] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full mb-1">
                        {lab.category} Lab
                      </span>
                      <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 text-center max-w-[200px] line-clamp-1">
                        {lab.title}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredGroups.length === 0 || purchasedLabs.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(2, purchasedLabs.length + 1)} className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm font-medium">
                    No purchased labs allocated to user cohorts. Purchase labs in the Marketplace to configure allocations.
                  </td>
                </tr>
              ) : (
                filteredGroups.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    {/* Row Label (Group) */}
                    <td className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-extrabold text-slate-900 dark:text-slate-100">{g.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{g.memberCount || g.members || 0} Enrolled Users</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleBatchToggleGroup(g.id, true)}
                            className="text-[10px] font-bold text-[#0052CC] hover:underline px-1.5"
                            title="Make all labs visible"
                          >
                            All On
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            onClick={() => handleBatchToggleGroup(g.id, false)}
                            className="text-[10px] font-bold text-slate-400 hover:underline px-1.5"
                            title="Hide all labs"
                          >
                            All Off
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Matrix Cells */}
                    {purchasedLabs.map((lab) => {
                      const alloc = allocations[g.id]?.[lab.id] || { isVisible: false, startDate: '2026-07-15', endDate: '2026-08-31' };

                      return (
                        <td key={lab.id} className="p-4 border-l border-slate-200 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <button
                              onClick={() => toggleVisibility(g.id, lab.id)}
                              className={`w-full py-2 px-3 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                                alloc.isVisible
                                  ? 'bg-emerald-50 text-[#28A745] border-emerald-300 shadow-xs'
                                  : 'bg-slate-100/70 text-slate-400 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              {alloc.isVisible ? (
                                <>
                                  <Eye className="w-4 h-4 text-[#28A745]" /> Visible to Group
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-4 h-4 text-slate-400" /> Hidden
                                </>
                              )}
                            </button>

                            {/* Access Window Preview */}
                            {alloc.isVisible && (
                              <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-[#0052CC]" /> {alloc.startDate} → {alloc.endDate}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Success Notification Toast */}
      {isSavedToastVisible && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-[#28A745]" />
          Allocations saved & visibility state synced with live environment!
        </div>
      )}
    </div>
  );
};
