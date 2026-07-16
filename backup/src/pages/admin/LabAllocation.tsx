import React, { useState } from 'react';
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
  // Mock Purchased Labs
  const purchasedLabs = [
    { id: 'lab-aws-01', title: 'AWS Security Architecture & Exploitation', category: 'Cloud' },
    { id: 'lab-web-01', title: 'OWASP Top 10 Exploitation & Defense', category: 'Web' },
    { id: 'lab-net-01', title: 'Network Traffic Forensics & PCAP Analysis', category: 'Network' },
  ];

  // Mock Groups
  const groups = [
    { id: 'grp-1', name: 'Red Team Cohort 2026', members: 42 },
    { id: 'grp-2', name: 'Blue Team Defense Alpha', members: 35 },
    { id: 'grp-3', name: 'SOC Analysts Batch B', members: 28 },
    { id: 'grp-4', name: 'Executive Security Briefing', members: 15 },
  ];

  // Initial Allocations Grid state
  const [allocations, setAllocations] = useState<Record<string, Record<string, { isVisible: boolean; startDate: string; endDate: string }>>>({
    'grp-1': {
      'lab-aws-01': { isVisible: true, startDate: '2026-07-01', endDate: '2026-08-31' },
      'lab-web-01': { isVisible: true, startDate: '2026-06-15', endDate: '2026-07-31' },
      'lab-net-01': { isVisible: false, startDate: '2026-08-01', endDate: '2026-09-30' },
    },
    'grp-2': {
      'lab-aws-01': { isVisible: false, startDate: '2026-08-01', endDate: '2026-09-30' },
      'lab-web-01': { isVisible: true, startDate: '2026-07-10', endDate: '2026-08-15' },
      'lab-net-01': { isVisible: true, startDate: '2026-07-01', endDate: '2026-08-31' },
    },
    'grp-3': {
      'lab-aws-01': { isVisible: false, startDate: '2026-09-01', endDate: '2026-10-31' },
      'lab-web-01': { isVisible: true, startDate: '2026-07-05', endDate: '2026-08-20' },
      'lab-net-01': { isVisible: false, startDate: '2026-08-10', endDate: '2026-09-30' },
    },
    'grp-4': {
      'lab-aws-01': { isVisible: true, startDate: '2026-07-01', endDate: '2026-12-31' },
      'lab-web-01': { isVisible: false, startDate: '2026-08-01', endDate: '2026-09-30' },
      'lab-net-01': { isVisible: false, startDate: '2026-08-01', endDate: '2026-09-30' },
    },
  });

  const [searchGroupQuery, setSearchGroupQuery] = useState('');
  const [isSavedToastVisible, setIsSavedToastVisible] = useState(false);

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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-7 h-7 text-[#0052CC]" />
            Lab Allocation Matrix & Visibility Controls
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Assign purchased labs to user groups and toggle lab access visibility in real time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAllocations({})}
            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Matrix
          </button>
          <button
            onClick={handleSaveAllocations}
            className="px-5 py-2.5 rounded-xl bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Allocations
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchGroupQuery}
            onChange={(e) => setSearchGroupQuery(e.target.value)}
            placeholder="Search group rows..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1 text-[#28A745] font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#28A745]"></span> Active & Visible
          </span>
          <span className="flex items-center gap-1 text-slate-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> Hidden to Group
          </span>
        </div>
      </div>

      {/* 2.6 Grid Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100/90 text-slate-700 text-xs font-black uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-4 w-72">Training Cohort Group</th>
                {purchasedLabs.map((lab) => (
                  <th key={lab.id} className="p-4 text-center border-l border-slate-200 min-w-[240px]">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-[#0052CC] bg-blue-50 px-2 py-0.5 rounded-full mb-1">
                        {lab.category} Lab
                      </span>
                      <span className="text-xs font-extrabold text-slate-900 text-center max-w-[200px] line-clamp-1">
                        {lab.title}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredGroups.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* Row Label (Group) */}
                  <td className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-extrabold text-slate-900">{g.name}</p>
                        <p className="text-xs text-slate-500 font-medium">{g.members} Enrolled Users</p>
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
              ))}
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
