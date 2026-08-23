import React, { useState, useEffect, useMemo } from 'react';
import type { UserGroup, PlatformUser } from '../../types/admin';
import { X, UsersRound, ArrowRight, ArrowLeft, CheckCircle2, Search, MousePointerClick, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { getDeptShortCode } from '../../utils/deptMapping';
import { parseRangeSelection } from '../../utils/rangeSelect';

interface GroupCreateModalProps {
  groupToEdit?: UserGroup | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (group: Partial<UserGroup>, memberIds: number[]) => void;
  allStudents?: PlatformUser[];
  onMembersChanged?: () => void;
}

const MAX_SIZE_OPTIONS = [10, 20, 30, 40, 50, 60];

export const GroupCreateModal: React.FC<GroupCreateModalProps> = ({
  groupToEdit,
  isOpen,
  onClose,
  onSave,
  allStudents = [],
  onMembersChanged,
}) => {
  const isEditMode = !!groupToEdit;

  const [step, setStep] = useState<'build' | 'confirm'>('build');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxSize, setMaxSize] = useState(40);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const [studentSearch, setStudentSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [memberSearch, setMemberSearch] = useState('');
  const [selectedToRemove, setSelectedToRemove] = useState<Set<number>>(new Set());
  const [locallyRemovedIds, setLocallyRemovedIds] = useState<Set<number>>(new Set());
  const [removing, setRemoving] = useState(false);
  const [selectedPanelOpen, setSelectedPanelOpen] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setStep('build');
      setName(groupToEdit?.name || '');
      setDescription(groupToEdit?.description || '');
      setMaxSize(groupToEdit?.maxSize || 40);
      setStudentSearch('');
      setSelectedIds(new Set());
      setErrors({});
      setMemberSearch('');
      setSelectedToRemove(new Set());
      setLocallyRemovedIds(new Set());
    }
  }, [isOpen, groupToEdit]);

  const trimmedSearch = studentSearch.trim();
  // A query made up only of digits/commas/hyphens/spaces is treated as an
  // S.No range (e.g. "1-4,7,9-12") instead of a name/roll/dept text filter.
  const isRangeQuery = trimmedSearch !== '' && /^[\d,\-\s]+$/.test(trimmedSearch);

  const getDbId = (s: PlatformUser) => s.db_id ?? Number(String(s.id).replace('usr-', ''));

  const eligibleStudents = useMemo(
    () => allStudents.filter((s) => !s.groupId || (isEditMode && s.groupId === groupToEdit?.id && locallyRemovedIds.has(getDbId(s)))),
    [allStudents, isEditMode, groupToEdit, locallyRemovedIds]
  );

  const currentMembers = useMemo(() => {
    if (!isEditMode || !groupToEdit) return [];
    return allStudents.filter((s) => s.groupId === groupToEdit.id && !locallyRemovedIds.has(getDbId(s)));
  }, [allStudents, isEditMode, groupToEdit, locallyRemovedIds]);

  // Typing this (then Enter) selects every current member at once, instead of
  // clicking each name — a quick way to remove the whole group's roster.
  const SELECT_ALL_QUERIES = ['all', 'select all', 'remove all', '*'];
  const isSelectAllQuery = SELECT_ALL_QUERIES.includes(memberSearch.trim().toLowerCase());

  const filteredCurrentMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q || isSelectAllQuery) return currentMembers;
    return currentMembers.filter((s) => s.fullName.toLowerCase().includes(q));
  }, [currentMembers, memberSearch, isSelectAllQuery]);

  const handleMemberSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isSelectAllQuery) {
      e.preventDefault();
      setSelectedToRemove(new Set(currentMembers.map((s) => getDbId(s))));
      setMemberSearch('');
    }
  };

  const candidates = useMemo(() => {
    if (isRangeQuery) return eligibleStudents;
    const q = trimmedSearch.toLowerCase();
    if (!q) return eligibleStudents;
    return eligibleStudents.filter((s) =>
      s.fullName.toLowerCase().includes(q) ||
      (s.rollNumber || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    );
  }, [eligibleStudents, trimmedSearch, isRangeQuery]);

  if (!isOpen) return null;

  const toggleOne = (dbId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(dbId)) next.delete(dbId);
      else {
        if (next.size >= maxSize) {
          alert(`You can select at most ${maxSize} students for this group.`);
          return prev;
        }
        next.add(dbId);
      }
      return next;
    });
  };

  const applyRangeSelection = () => {
    const sNos = parseRangeSelection(trimmedSearch, candidates.length);
    if (sNos.size === 0) {
      alert('No valid S.No entries found. Use a format like 1-4,7,9-12.');
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const sNo of sNos) {
        const student = candidates[sNo - 1];
        if (!student) continue;
        const dbId = getDbId(student);
        if (next.size >= maxSize && !next.has(dbId)) continue;
        next.add(dbId);
      }
      return next;
    });
    setStudentSearch('');
  };

  const selectedStudents = allStudents.filter((s) => selectedIds.has(getDbId(s)));

  const toggleMemberToRemove = (dbId: number) => {
    setSelectedToRemove((prev) => {
      const next = new Set(prev);
      if (next.has(dbId)) next.delete(dbId);
      else next.add(dbId);
      return next;
    });
  };

  const handleRemoveSelectedMembers = async () => {
    if (!groupToEdit || selectedToRemove.size === 0) return;
    const groupDbId = groupToEdit.db_id || Number(String(groupToEdit.id).replace('grp-', ''));
    setRemoving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/admin/groups/${groupDbId}/members/bulk-remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ user_ids: Array.from(selectedToRemove) })
      });
      if (res.ok) {
        setLocallyRemovedIds((prev) => new Set([...prev, ...selectedToRemove]));
        setSelectedToRemove(new Set());
        onMembersChanged?.();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || 'Failed to remove selected students.');
      }
    } catch (err) {
      console.error('Error removing group members:', err);
      alert('An error occurred while removing selected students.');
    } finally {
      setRemoving(false);
    }
  };

  const handleContinueToConfirm = () => {
    if (!name.trim()) {
      setErrors({ name: 'Group name is required.' });
      return;
    }
    if (selectedIds.size === 0 && !isEditMode) {
      alert('Select at least one student to add to this group.');
      return;
    }
    if (selectedIds.size === 0) {
      // Editing existing group with no new students added — save metadata directly.
      handleFinalConfirm();
      return;
    }
    setErrors({});
    setStep('confirm');
  };

  const handleFinalConfirm = () => {
    onSave(
      {
        id: groupToEdit?.id,
        db_id: groupToEdit?.db_id,
        name,
        description: description || 'Training group cohort for cybersecurity exercises.',
        maxSize,
      },
      Array.from(selectedIds)
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-100 dark:bg-amber-950/60 text-[#FFA500] dark:text-amber-400">
              <UsersRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                {step === 'build'
                  ? isEditMode ? 'Edit Training Group' : 'Create New Training Group'
                  : 'Confirm Group Roster'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {step === 'build' ? 'Organize users into training cohorts' : `${selectedStudents.length} student(s) selected`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'build' ? (
          <div className="p-6 space-y-4 text-xs overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Group Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cybersecurity Training Cohort 2026"
                  className="w-full pl-3 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
                />
                {errors.name && <p className="text-rose-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Max Students</label>
                <select
                  value={maxSize}
                  onChange={(e) => setMaxSize(Number(e.target.value))}
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  {MAX_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} students</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Description / Training Focus</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of training goals, department, or skill tier..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
              />
            </div>

            {isEditMode && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="font-bold text-slate-700 dark:text-slate-300 mb-2">Current Members ({currentMembers.length})</p>

                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      onKeyDown={handleMemberSearchKeyDown}
                      placeholder='Search by name, or type "all" + Enter to select everyone...'
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveSelectedMembers}
                    disabled={selectedToRemove.size === 0 || removing}
                    title={selectedToRemove.size > 0 ? `Remove ${selectedToRemove.size} selected member(s) from group` : 'Select members to remove'}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 enabled:hover:text-rose-600 enabled:hover:bg-rose-50 dark:enabled:hover:bg-rose-950/40 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="max-h-40 overflow-y-auto">
                    {filteredCurrentMembers.length === 0 ? (
                      <p className="p-3 text-center text-slate-400 text-xs">No current members match.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredCurrentMembers.map((s) => {
                          const dbId = getDbId(s);
                          const checked = selectedToRemove.has(dbId);
                          return (
                            <div
                              key={dbId}
                              onClick={() => toggleMemberToRemove(dbId)}
                              className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${checked ? 'bg-rose-50 dark:bg-rose-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                            >
                              {checked && <CheckCircle2 className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />}
                              <span className="font-semibold text-slate-800 dark:text-slate-100">{s.fullName}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Click a name to select, or type "all" and press Enter to select everyone — then use the trash icon to remove them from this group.
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="font-bold text-slate-700 dark:text-slate-300 mb-2">Add Students</p>

              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isRangeQuery) {
                        e.preventDefault();
                        applyRangeSelection();
                      }
                    }}
                    placeholder="Search by name, roll number, dept — or S.No e.g. 1-4,7,9-12"
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
                  />
                </div>
                {isRangeQuery && (
                  <button
                    type="button"
                    onClick={applyRangeSelection}
                    title="Apply S.No range as selection"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white transition-colors cursor-pointer"
                  >
                    <MousePointerClick className="w-4 h-4" />
                  </button>
                )}
                {trimmedSearch !== '' && (
                  <button
                    type="button"
                    onClick={() => setStudentSearch('')}
                    title="Clear search"
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wide sticky top-0">
                      <tr>
                        <th className="p-2 w-10 text-center">#</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">Roll No.</th>
                        <th className="p-2">Dept</th>
                        <th className="p-2">Year</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {candidates.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400">No ungrouped students match.</td>
                        </tr>
                      ) : (
                        candidates.map((s, idx) => {
                          const dbId = getDbId(s);
                          const checked = selectedIds.has(dbId);
                          return (
                            <tr
                              key={dbId}
                              onClick={() => toggleOne(dbId)}
                              className={`cursor-pointer transition-colors ${checked ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                            >
                              <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                              <td className="p-2 font-semibold text-slate-800 dark:text-slate-100">
                                <div className="flex items-center gap-2">
                                  {checked && <CheckCircle2 className="w-3.5 h-3.5 text-[#0052CC] flex-shrink-0" />}
                                  {s.fullName}
                                </div>
                              </td>
                              <td className="p-2 text-slate-500">{s.rollNumber || '-'}</td>
                              <td className="p-2 text-slate-500">{getDeptShortCode(s.department)}</td>
                              <td className="p-2 text-slate-500">{s.year || '-'}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {selectedIds.size} / {maxSize} selected. Click rows to toggle, or type an S.No range (e.g. 1-4,7,9-12) and press Enter.
              </p>
            </div>

            {selectedStudents.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedPanelOpen((o) => !o)}
                  className="w-full flex items-center justify-between mb-2 cursor-pointer"
                >
                  <p className="font-bold text-slate-700 dark:text-slate-300">Selected to Add ({selectedStudents.length})</p>
                  {selectedPanelOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {selectedPanelOpen && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedStudents.map((s) => {
                        const dbId = getDbId(s);
                        return (
                          <div
                            key={dbId}
                            onClick={() => toggleOne(dbId)}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#0052CC] flex-shrink-0" />
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{s.fullName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Click a name here to unselect it.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-3 text-xs overflow-y-auto">
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl p-3 text-slate-700 dark:text-slate-300">
              Creating <strong>{name}</strong> with <strong>{selectedStudents.length}</strong> student(s). Please review the roster before confirming.
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wide sticky top-0">
                    <tr>
                      <th className="p-2 w-10 text-center">#</th>
                      <th className="p-2">Full Name</th>
                      <th className="p-2">Dept</th>
                      <th className="p-2">Year</th>
                      <th className="p-2">Roll No.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedStudents.map((s, idx) => (
                      <tr key={getDbId(s)}>
                        <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2 font-semibold text-slate-800 dark:text-slate-100">{s.fullName}</td>
                        <td className="p-2 text-slate-500">{getDeptShortCode(s.department)}</td>
                        <td className="p-2 text-slate-500">{s.year || '-'}</td>
                        <td className="p-2 text-slate-500">{s.rollNumber || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-800/40">
          {step === 'build' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleContinueToConfirm}
                className="px-5 py-2 rounded-xl bg-[#0052CC] hover:bg-blue-600 text-white font-bold transition-colors shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                Review & Confirm <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('build')}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={handleFinalConfirm}
                className="px-5 py-2 rounded-xl bg-[#28A745] hover:bg-emerald-600 text-white font-bold transition-colors shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirm & Create Group
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
