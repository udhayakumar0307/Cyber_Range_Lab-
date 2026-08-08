import React, { useState, useEffect } from 'react';
import type { UserGroup, PlatformUser } from '../../types/admin';
import { X, Trash2, Search, AlertCircle, ChevronLeft, ChevronRight, User, Plus } from 'lucide-react';

interface GroupMembersModalProps {
  group: UserGroup | null;
  isOpen: boolean;
  onClose: () => void;
}

export const GroupMembersModal: React.FC<GroupMembersModalProps> = ({
  group,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !group) return null;

  const [members, setMembers] = useState<PlatformUser[]>([]);
  const [availableStudents, setAvailableStudents] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Right panel states
  const [rightSearchQuery, setRightSearchQuery] = useState('');
  const [checkedAvailableIds, setCheckedAvailableIds] = useState<string[]>([]);

  // Selection states for Left side bulk remove
  const [checkedMemberIds, setCheckedMemberIds] = useState<string[]>([]);

  // Drag visual highlights
  const [isDraggingOverLeft, setIsDraggingOverLeft] = useState(false);
  const [isDraggingOverRight, setIsDraggingOverRight] = useState(false);

  const fetchGroupMembersAndOrgStudents = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const studentsRes = await fetch('/api/v1/admin/users', { headers });
      if (studentsRes.ok) {
        const usersData = await studentsRes.json();
        const allUsers: PlatformUser[] = Array.isArray(usersData) ? usersData : (usersData.users || []);
        
        const targetGroupId = Number(String(group.db_id || group.id).replace('grp-', ''));
        
        // Members belonging to this group
        const currentMembers = allUsers.filter(u => {
          const uGroupId = u.groupId ? Number(String(u.groupId).replace('grp-', '')) : null;
          return uGroupId === targetGroupId;
        });
        setMembers(currentMembers);

        // Available students (only users with 'user' role who are not in this group)
        const available = allUsers.filter(u => {
          const uGroupId = u.groupId ? Number(String(u.groupId).replace('grp-', '')) : null;
          const isStudent = (u.role || '').toLowerCase() === 'user';
          return uGroupId !== targetGroupId && isStudent;
        });
        setAvailableStudents(available);
      }
    } catch (err) {
      console.error('Error fetching group members:', err);
    } finally {
      setLoading(false);
      setCheckedMemberIds([]);
      setCheckedAvailableIds([]);
      setRightSearchQuery('');
    }
  };

  useEffect(() => {
    fetchGroupMembersAndOrgStudents();
  }, [group.id]);

  // Filters for Available Students list (Right side)
  const filteredAvailable = availableStudents.filter(s => {
    const term = rightSearchQuery.toLowerCase();
    if (!term) return true; // Show all available students when search query is empty!
    const nameMatch = (s.fullName || '').toLowerCase().includes(term);
    const emailMatch = (s.email || '').toLowerCase().includes(term);
    const rollMatch = (s.rollNumber || '').toLowerCase().includes(term);
    const deptMatch = (s.department || '').toLowerCase().includes(term);
    return nameMatch || emailMatch || rollMatch || deptMatch;
  });

  const getDbUserId = (sid: string): number => {
    const found = availableStudents.find(s => String(s.id) === String(sid)) || members.find(m => String(m.id) === String(sid));
    if (found && found.db_id) return found.db_id;
    const cleaned = sid.replace('usr-', '');
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const getDbGroupId = (): number => {
    if (group.db_id) return group.db_id;
    const cleaned = String(group.id).replace('grp-', '');
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // Single Add student
  const handleSingleAddStudent = async (sid: string) => {
    setActionLoading(true);
    setErrorMsg('');
    const token = localStorage.getItem('token');
    const targetUserId = getDbUserId(sid);
    const targetGroupId = getDbGroupId();

    try {
      const res = await fetch(`/api/v1/admin/groups/${targetGroupId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ user_id: targetUserId })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = typeof errData.detail === 'string' ? errData.detail : (errData.detail?.message || 'Failed to add student to cohort.');
        throw new Error(msg);
      }
      fetchGroupMembersAndOrgStudents();
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to add student.');
    } finally {
      setActionLoading(false);
    }
  };

  // Single Remove member
  const handleSingleRemoveMember = async (sid: string) => {
    setActionLoading(true);
    const token = localStorage.getItem('token');
    const targetUserId = getDbUserId(sid);
    const targetGroupId = getDbGroupId();

    try {
      const res = await fetch(`/api/v1/admin/groups/${targetGroupId}/members/${targetUserId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('Failed to remove member.');
      fetchGroupMembersAndOrgStudents();
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to remove member.');
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk add checked students
  const handleBulkAddStudents = async () => {
    if (checkedAvailableIds.length === 0) return;
    setActionLoading(true);
    setErrorMsg('');
    const token = localStorage.getItem('token');
    const targetGroupId = getDbGroupId();

    try {
      await Promise.all(
        checkedAvailableIds.map(async (sid) => {
          const targetUserId = getDbUserId(sid);
          const res = await fetch(`/api/v1/admin/groups/${targetGroupId}/members`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ user_id: targetUserId })
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const msg = typeof errData.detail === 'string' ? errData.detail : (errData.detail?.message || 'Failed to add some students.');
            throw new Error(msg);
          }
        })
      );
      fetchGroupMembersAndOrgStudents();
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to add students.');
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk remove checked members
  const handleBulkRemoveMembers = async () => {
    if (checkedMemberIds.length === 0) return;
    setActionLoading(true);
    const token = localStorage.getItem('token');
    const targetGroupId = getDbGroupId();

    try {
      await Promise.all(
        checkedMemberIds.map(async (sid) => {
          const targetUserId = getDbUserId(sid);
          await fetch(`/api/v1/admin/groups/${targetGroupId}/members/${targetUserId}`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
        })
      );
      fetchGroupMembersAndOrgStudents();
    } catch (err) {
      console.error('Failed to remove members:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectAllMembersToggle = (checked: boolean) => {
    if (checked) {
      setCheckedMemberIds(members.map(m => String(m.id)));
    } else {
      setCheckedMemberIds([]);
    }
  };

  const handleSelectAllAvailableToggle = (checked: boolean) => {
    if (checked) {
      setCheckedAvailableIds(filteredAvailable.map(s => String(s.id)));
    } else {
      setCheckedAvailableIds([]);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, type: 'add' | 'remove', id: string) => {
    e.dataTransfer.setData('text/plain', `${type}:${id}`);
  };

  const handleDropOnLeft = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverLeft(false);
    const data = e.dataTransfer.getData('text/plain');
    if (data.startsWith('add:')) {
      const id = data.replace('add:', '');
      await handleSingleAddStudent(id);
    }
  };

  const handleDropOnRight = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverRight(false);
    const data = e.dataTransfer.getData('text/plain');
    if (data.startsWith('remove:')) {
      const id = data.replace('remove:', '');
      await handleSingleRemoveMember(id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-900/50 backdrop-blur-xs overflow-hidden p-0">
      {/* Container aligned to the right (justify-end) with exactly 200px gap */}
      <div className="w-full h-full flex justify-end items-stretch gap-[200px]">
        
        {/* Left Card: Student List (Strictly w-[500px] wide, starts at -700px from right end, 30px top/bottom gap, rounded) */}
        <div 
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOverLeft(true);
          }}
          onDragLeave={() => setIsDraggingOverLeft(false)}
          onDrop={handleDropOnLeft}
          className={`w-[500px] min-w-[500px] max-w-[500px] bg-white border border-slate-200 p-6 flex flex-col justify-between overflow-hidden ml-[20px] h-[calc(100vh-60px)] my-[30px] rounded-3xl shadow-sm transition-all duration-200 ${
            isDraggingOverLeft ? 'bg-blue-50/30 border-2 border-dashed border-blue-400' : ''
          }`}
        >
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header info */}
            <div className="mb-4">
              <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full border border-blue-100 uppercase tracking-wider">
                Cohort Roster ({members.length} Students)
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 mt-1">Student List</h2>
              <p className="text-xs text-slate-500">Manage students in this cohort</p>
            </div>

            {/* Bulk Actions Panel */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl mb-3 text-xs mt-2">
              <label className="flex items-center gap-2.5 font-bold text-slate-650 cursor-pointer">
                <input
                  type="checkbox"
                  checked={members.length > 0 && checkedMemberIds.length === members.length}
                  onChange={(e) => handleSelectAllMembersToggle(e.target.checked)}
                  className="rounded border-slate-355 cursor-pointer"
                />
                <span>Select All</span>
              </label>

              <button
                onClick={handleBulkRemoveMembers}
                disabled={checkedMemberIds.length === 0 || actionLoading}
                className="px-3.5 py-1.5 bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 hover:border-rose-300 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Selected ({checkedMemberIds.length})</span>
              </button>
            </div>

            {/* Roster List scrollable */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loading ? (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                  Loading database cohort roster...
                </div>
              ) : members.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No students currently assigned to this cohort.
                </div>
              ) : (
                members.map((m) => {
                  const isChecked = checkedMemberIds.includes(String(m.id));
                  return (
                    <div
                      key={m.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, 'remove', String(m.id))}
                      className={`p-3.5 border rounded-2xl flex items-center justify-between gap-4 text-xs transition-colors cursor-grab active:cursor-grabbing hover:shadow-xs hover:border-slate-300 ${
                        isChecked 
                          ? 'bg-blue-50/20 border-blue-200' 
                          : 'bg-white border-slate-150 hover:bg-slate-50/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setCheckedMemberIds(prev => [...prev, String(m.id)]);
                            else setCheckedMemberIds(prev => prev.filter(id => id !== String(m.id)));
                          }}
                          className="rounded border-slate-355 cursor-pointer"
                        />
                        <div>
                          <p className="font-extrabold text-slate-900 text-[13px]">{m.fullName || m.email}</p>
                          <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                            {m.rollNumber || 'No Roll'} • {m.department || 'No Dept'} • {m.year || 'III Year'}
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold text-[9px] uppercase tracking-wider">
                        Active
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer pagination */}
          <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-500 font-bold mt-3">
            <span>Showing {members.length} of {members.length} {members.length === 1 ? 'student' : 'students'}</span>
            
            <div className="flex items-center gap-1">
              <button disabled className="p-1 border border-slate-200 rounded-lg bg-slate-50 text-slate-405 opacity-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[11px] font-black">
                1
              </button>
              <button disabled className="p-1 border border-slate-200 rounded-lg bg-slate-50 text-slate-405 opacity-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Card: Add Student (Strictly w-[500px] wide, docked to right end, rounded-l curves, top/bottom/right 0px) */}
        <div 
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOverRight(true);
          }}
          onDragLeave={() => setIsDraggingOverRight(false)}
          onDrop={handleDropOnRight}
          className={`w-[500px] min-w-[500px] max-w-[500px] bg-white border border-slate-200 p-6 flex flex-col justify-between overflow-hidden relative mr-0 my-0 h-full rounded-l-3xl rounded-r-none shadow-xs transition-all duration-200 ${
            isDraggingOverRight ? 'bg-rose-50/10 border-2 border-dashed border-rose-300' : ''
          }`}
        >
          <div className="flex flex-col flex-1 overflow-hidden">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Add Student</h2>
                <p className="text-xs text-slate-500">Add a new student to this cohort</p>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-655 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-[11px] font-bold mb-4 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> {errorMsg}
              </div>
            )}

            {/* Form Input fields */}
            <div className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
              
              {/* Search Available Student Field */}
              <div className="relative">
                <label className="block text-slate-700 font-bold mb-1.5">Search Student <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={rightSearchQuery}
                    onChange={(e) => setRightSearchQuery(e.target.value)}
                    placeholder="Search by name, email, roll number, dept..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Bulk select checkbox bar for Available Students */}
              <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-150 rounded-xl text-xs">
                <label className="flex items-center gap-2 font-bold text-slate-650 cursor-pointer pl-1">
                  <input
                    type="checkbox"
                    checked={filteredAvailable.length > 0 && checkedAvailableIds.length === filteredAvailable.length}
                    onChange={(e) => handleSelectAllAvailableToggle(e.target.checked)}
                    className="rounded border-slate-355 scale-90"
                  />
                  <span>Select All</span>
                </label>

                <span className="text-[10px] text-slate-400 font-bold">{checkedAvailableIds.length} Selected</span>
              </div>

              {/* Scrollable list of available students with check boxes and Drag support */}
              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl bg-white divide-y p-2 space-y-1">
                {filteredAvailable.length === 0 ? (
                  <p className="text-slate-400 text-center py-12 font-medium">No available students found</p>
                ) : (
                  filteredAvailable.map(s => {
                    const isChecked = checkedAvailableIds.includes(String(s.id));
                    return (
                      <div 
                        key={s.id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'add', String(s.id))}
                        className={`flex items-start gap-2.5 p-2.5 hover:bg-slate-50 rounded-xl cursor-grab active:cursor-grabbing transition-colors ${
                          isChecked ? 'bg-blue-50/20 border border-blue-150' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setCheckedAvailableIds(prev => [...prev, String(s.id)]);
                            else setCheckedAvailableIds(prev => prev.filter(id => id !== String(s.id)));
                          }}
                          className="rounded border-slate-355 mt-0.5 scale-90"
                        />
                        <div className="flex-1 overflow-hidden">
                          <p className="font-extrabold text-slate-800 text-[12px] truncate">{s.fullName || s.email}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">
                            {s.rollNumber || 'No Roll'} • {s.department || 'No Dept'} • {s.year ? `${s.year} Year` : 'III Year'}
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium truncate mt-0.5">{s.email}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>

          {/* Action button at bottom */}
          <div className="pt-4 border-t border-slate-100 bg-white">
            <button
              disabled={checkedAvailableIds.length === 0 || actionLoading}
              onClick={handleBulkAddStudents}
              className="w-full py-3 bg-[#0052CC] hover:bg-blue-600 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {actionLoading ? 'Adding...' : `+ Add Selected Student to Cohort (${checkedAvailableIds.length})`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
