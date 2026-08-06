import React, { useState, useEffect } from 'react';
import type { UserGroup, PlatformUser } from '../../types/admin';
import { X, UserPlus, Trash2, Search, CheckCircle } from 'lucide-react';

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

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const fetchGroupMembersAndOrgStudents = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      // 1. Fetch all students in org
      const studentsRes = await fetch('/api/v1/admin/users', { headers });
      if (studentsRes.ok) {
        const usersData = await studentsRes.json();
        const allUsers: PlatformUser[] = Array.isArray(usersData) ? usersData : (usersData.users || []);
        
        // Filter members belonging to this group vs available org students
        const currentMembers = allUsers.filter(u => u.groupId === group.id || u.groupName === group.name);
        setMembers(currentMembers);
        setAvailableStudents(allUsers.filter(u => u.groupId !== group.id));
      }
    } catch (err) {
      console.error('Error fetching group members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupMembersAndOrgStudents();
  }, [group.id]);

  const filteredMembers = members.filter((m) => {
    const query = searchQuery.toLowerCase();
    return (
      (m.fullName || '').toLowerCase().includes(query) ||
      (m.email || '').toLowerCase().includes(query) ||
      (m.rollNumber || '').toLowerCase().includes(query) ||
      (m.department || '').toLowerCase().includes(query)
    );
  });

  const handleRemoveMember = async (userId: string) => {
    setActionLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/admin/groups/${group.db_id || group.id.replace('grp-', '')}/members/${userId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setMembers(prev => prev.filter(m => String(m.id) !== String(userId)));
        fetchGroupMembersAndOrgStudents();
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Client-side real-time filter for available roster
  const filteredAvailable = availableStudents.filter(s => {
    const term = subSearchQuery.toLowerCase();
    const nameMatch = (s.fullName || '').toLowerCase().includes(term);
    const emailMatch = (s.email || '').toLowerCase().includes(term);
    const deptMatch = (s.department || '').toLowerCase().includes(term);
    const rollMatch = (s.rollNumber || '').toLowerCase().includes(term);
    const matchesSearch = nameMatch || emailMatch || deptMatch || rollMatch;

    const matchesDept = selectedDept === 'All' || s.department === selectedDept;
    const matchesYear = selectedYear === 'All' || s.year === selectedYear;

    return matchesSearch && matchesDept && matchesYear;
  });

  const handleAddSelectedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) return;

    setActionLoading(true);
    setErrorMsg('');
    const token = localStorage.getItem('token');

    try {
      // Loop through all selected and add them using database transaction mapping
      await Promise.all(
        selectedStudentIds.map(sid =>
          fetch(`/api/v1/admin/groups/${group.db_id || group.id.replace('grp-', '')}/members`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ user_id: Number(sid) })
          }).then(res => {
            if (!res.ok) {
              throw new Error('Unable to add students. Please try again.');
            }
          })
        )
      );

      setIsAddingUser(false);
      setSelectedStudentIds([]);
      fetchGroupMembersAndOrgStudents();
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to add students. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full h-[82vh] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col justify-between">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div>
            <span className="text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-[#0052CC] dark:text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">
              Cohort Roster ({members.length} Students)
            </span>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-1">{group.name}</h2>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body with fixed header search inside it but scrolling roster */}
        <div className="p-6 flex-1 flex flex-col overflow-hidden space-y-4">
          {/* Top Search & Add Toolbar (Fixed inside flex-col) */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter cohort members by name, roll number, department, or email..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
              />
            </div>

            <button
              onClick={() => setIsAddingUser(!isAddingUser)}
              className="px-3.5 py-2 rounded-lg bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Student
            </button>
          </div>

          {/* Two-Column Side-by-Side Add Member Panel */}
          {isAddingUser && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 animate-in fade-in duration-200 text-xs">
              
              {/* Left Side: Available Students */}
              <div className="space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">Available Students</h4>
                  
                  {/* Search and Filters */}
                  <div className="space-y-2 mb-3">
                    <input
                      type="text"
                      value={subSearchQuery}
                      onChange={(e) => setSubSearchQuery(e.target.value)}
                      placeholder="Search available students..."
                      className="w-full p-2 bg-white dark:bg-slate-900 border rounded-lg text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                        className="p-1.5 bg-white dark:bg-slate-900 border rounded text-xs"
                      >
                        <option value="All">All Departments</option>
                        <option value="Computer Science">Computer Science</option>
                        <option value="Cyber Security">Cyber Security</option>
                        <option value="Information Technology">IT</option>
                      </select>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="p-1.5 bg-white dark:bg-slate-900 border rounded text-xs"
                      >
                        <option value="All">All Years</option>
                        <option value="1st Year">I Year</option>
                        <option value="2nd Year">II Year</option>
                        <option value="3rd Year">III Year</option>
                        <option value="4th Year">IV Year</option>
                      </select>
                    </div>
                  </div>

                  {/* Scrollable list */}
                  <div className="max-h-[220px] overflow-y-auto border rounded-xl bg-white dark:bg-slate-900 divide-y p-2 space-y-1">
                    {filteredAvailable.length === 0 ? (
                      <p className="text-slate-400 text-center py-6">No matching students found.</p>
                    ) : (
                      filteredAvailable.map(s => {
                        const isChecked = selectedStudentIds.includes(String(s.id));
                        return (
                          <label key={s.id} className="flex items-start gap-3.5 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedStudentIds(prev => [...prev, String(s.id)]);
                                else setSelectedStudentIds(prev => prev.filter(id => id !== String(s.id)));
                              }}
                              className="rounded border-slate-300 mt-1 cursor-pointer"
                            />
                            <div>
                              <p className="font-extrabold text-slate-800 dark:text-slate-200">{s.fullName || s.email}</p>
                              <p className="text-[10px] text-slate-500 font-medium">
                                {s.rollNumber || '22BCS014'} • {s.department || 'Cyber Security'} • {s.year || 'III Year'}
                              </p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-200/60">
                  <button
                    onClick={() => setIsAddingUser(false)}
                    className="px-3 py-2 text-slate-500 hover:text-slate-700 font-bold bg-white border border-slate-200 rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Right Side: Selected Panel */}
              <div className="border-l border-slate-200 dark:border-slate-700 pl-4 flex flex-col justify-between h-full">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center justify-between">
                    <span>Selected Students</span>
                    <span className="bg-blue-100 text-[#0052CC] font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                      {selectedStudentIds.length} Chosen
                    </span>
                  </h4>

                  {errorMsg && <p className="text-xs text-rose-600 font-bold mb-2">{errorMsg}</p>}

                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                    {selectedStudentIds.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 font-medium bg-white dark:bg-slate-900 border border-dashed rounded-xl">
                        Select students on the left to add
                      </div>
                    ) : (
                      selectedStudentIds.map(sid => {
                        const student = availableStudents.find(s => String(s.id) === sid);
                        if (!student) return null;
                        return (
                          <div key={sid} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-200">{student.fullName || student.email}</p>
                              <p className="text-[9px] text-slate-500">{student.rollNumber || '22BCS014'}</p>
                            </div>
                            <button
                              onClick={() => setSelectedStudentIds(prev => prev.filter(id => id !== sid))}
                              className="text-xs font-bold text-rose-500 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-slate-200/60 mt-3">
                  <button
                    disabled={selectedStudentIds.length === 0 || actionLoading}
                    onClick={handleAddSelectedSubmit}
                    className="w-full md:w-auto px-5 py-2.5 bg-[#0052CC] hover:bg-blue-600 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                  >
                    {actionLoading ? 'Adding...' : `Add ${selectedStudentIds.length} Students`}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* Members List (Strictly Scrollable Area) */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                Loading database cohort roster...
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No students currently assigned to this cohort.
              </div>
            ) : (
              filteredMembers.map((m) => {
                const name = m.fullName || 'Student';
                const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                return (
                  <div
                    key={m.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-[#0052CC] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        {initials}
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          {m.rollNumber || '22BCS014'} • {m.department || 'Cyber Security'} • {m.year || 'III Year'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Active
                      </span>

                      <button
                        onClick={() => handleRemoveMember(String(m.id))}
                        disabled={actionLoading}
                        className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg font-bold border border-rose-100 dark:border-rose-900/40 cursor-pointer"
                        title="Remove from group"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 text-right flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl font-bold text-xs cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

