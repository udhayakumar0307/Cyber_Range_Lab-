import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import type { PlatformUser, UserGroup } from '../../types/admin';
import { UserAddModal } from '../../components/admin/UserAddModal';
import { BulkImportModal } from '../../components/admin/BulkImportModal';
import { GroupCreateModal } from '../../components/admin/GroupCreateModal';
import { getDeptShortCode } from '../../utils/deptMapping';
import { parseRangeSelection } from '../../utils/rangeSelect';
import {
  UserPlus,
  FileSpreadsheet,
  Search,
  AlertTriangle,
  UsersRound,
  Plus,
  Calendar,
  Users,
  Edit3,
  Trash2,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

import { getRoleDisplayName } from '../../utils/roleMapping';

export const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || searchParams.get('q') || '';

  // Filtering & Search state
  const [searchQuery, setSearchQuery] = useState(urlSearch);
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');

  // Sync with URL search params changes (e.g. from top nav search)
  useEffect(() => {
    setSearchQuery(urlSearch);
  }, [urlSearch]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (val.trim()) {
      setSearchParams({ search: val });
    } else {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('search');
      newParams.delete('q');
      setSearchParams(newParams);
    }
  };

  const [availableGroups, setAvailableGroups] = useState<UserGroup[]>([]);

  const fetchUsersAndGroups = async () => {
    const token = localStorage.getItem('token');
    try {
      const [uRes, gRes] = await Promise.all([
        fetch('/api/v1/admin/users', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch('/api/v1/admin/groups', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      ]);
      if (uRes.ok) {
        const data = await uRes.json();
        if (Array.isArray(data)) setUsers(data);
      }
      if (gRes.ok) {
        const gData = await gRes.json();
        if (Array.isArray(gData)) setAvailableGroups(gData);
      }
    } catch (err) {
      console.error('Error fetching users/groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndGroups();

    // Re-fetch whenever the admin comes back to this tab/page. Students can
    // complete their profile (roll number, department, year) at any time in
    // a separate session, and this roster must reflect that without the
    // admin needing to remember to hit a manual refresh.
    const onFocus = () => fetchUsersAndGroups();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchUsersAndGroups();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Modal visibility states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<PlatformUser | null>(null);

  // Delete selection state
  const [selectedForDelete, setSelectedForDelete] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const getUserDbId = (u: PlatformUser) => u.db_id ?? Number(String(u.id).replace('usr-', ''));

  const toggleUserSelection = (u: PlatformUser) => {
    const dbId = getUserDbId(u);
    setSelectedForDelete((prev) => {
      const next = new Set(prev);
      if (next.has(dbId)) next.delete(dbId);
      else next.add(dbId);
      return next;
    });
  };

  // Group panel state
  const [groupSearch, setGroupSearch] = useState('');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<UserGroup | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<UserGroup | null>(null);

  // Base dataset (excluding internal platform SYSTEM_ADMIN / sysadmin accounts), dept/year filtered
  const baseUsers = users.filter((u) => {
    const roleLower = (u.role || '').toLowerCase();
    const nameLower = (u.fullName || '').toLowerCase();
    const emailLower = (u.email || '').toLowerCase();

    const isSysAdmin =
      roleLower.includes('sysadmin') ||
      roleLower.includes('system_admin') ||
      nameLower.includes('sysadmin') ||
      nameLower.includes('sys admin') ||
      emailLower.includes('sysadmin');

    if (isSysAdmin) return false;

    // Normalize both sides to the same short code (e.g. "Information Technology"
    // and "it" both become "IT") so the fixed dropdown options match whatever
    // casing/abbreviation was actually stored for the student.
    const matchesDept =
      selectedDept === 'All' || getDeptShortCode(u.department) === getDeptShortCode(selectedDept);
    const matchesYear =
      selectedYear === 'All' || (u.year || '').trim().toLowerCase() === selectedYear.trim().toLowerCase();
    return matchesDept && matchesYear;
  });

  const trimmedQuery = searchQuery.trim();
  // A query made up only of digits/commas/hyphens/spaces is treated as an
  // S.No range (e.g. "1-4,7,9-12") over the currently filtered list, instead
  // of a name/roll/email/department text search.
  const isSnoQuery = trimmedQuery !== '' && /^[\d,\-\s]+$/.test(trimmedQuery);

  const filteredUsers = isSnoQuery
    ? (() => {
        const sNos = parseRangeSelection(trimmedQuery, baseUsers.length);
        return baseUsers.filter((_, idx) => sNos.has(idx + 1));
      })()
    : baseUsers.filter((u) => {
        const q = trimmedQuery.toLowerCase();
        return !q ||
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.rollNumber || '').toLowerCase().includes(q) ||
          (u.department || '').toLowerCase().includes(q);
      });

  const filteredGroups = availableGroups.filter(
    (g) =>
      (g.name || '').toLowerCase().includes(groupSearch.toLowerCase()) ||
      (g.description || '').toLowerCase().includes(groupSearch.toLowerCase())
  );

  const parseErrorMessage = (errData: any): string => {
    if (!errData) return 'An unexpected error occurred.';
    if (typeof errData.detail === 'string') return errData.detail;
    if (errData.detail && typeof errData.detail === 'object') {
      if (Array.isArray(errData.detail)) {
        return errData.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
      }
      const msg = errData.detail.message || '';
      const errs = Array.isArray(errData.detail.errors) ? errData.detail.errors.join(' ') : '';
      return `${msg} ${errs}`.trim() || 'Invalid request payload.';
    }
    if (errData.message && typeof errData.message === 'string') return errData.message;
    return 'Failed to execute action.';
  };

  // Action Handlers
  const handleSaveUser = async (userData: Partial<PlatformUser> & { password?: string }) => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const targetGroupId = userData.groupId ? Number(String(userData.groupId).replace('grp-', '')) : null;

    if (userToEdit) {
      const dbId = userToEdit.db_id || Number(String(userToEdit.id).replace('usr-', ''));
      try {
        const res = await fetch(`/api/v1/admin/users/${dbId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            name: userData.fullName,
            role: userData.role ? userData.role.toLowerCase() : undefined,
            is_active: userData.status === 'Active',
            group_id: targetGroupId,
            year: userData.year,
            department: userData.department,
            roll_number: userData.rollNumber
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          alert(parseErrorMessage(errData));
          return;
        }
        await fetchUsersAndGroups();
      } catch (err) {
        console.error('Error updating user:', err);
        alert('An error occurred while updating user.');
      }
    } else {
      try {
        const res = await fetch('/api/v1/admin/users', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: userData.fullName,
            email: userData.email,
            password: userData.password || 'CyberRange#2026!',
            role: userData.role ? userData.role.toLowerCase() : 'user',
            group_id: targetGroupId,
            year: userData.year,
            department: userData.department,
            roll_number: userData.rollNumber
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          alert(parseErrorMessage(errData));
          return;
        }
        await fetchUsersAndGroups();
      } catch (err) {
        console.error('Error creating user:', err);
        alert('An error occurred while creating user.');
      }
    }
  };

  const handleBulkImport = () => {
    fetchUsersAndGroups();
  };

  const handleBulkDelete = async () => {
    if (isBulkDeleting) return;

    const idsToDelete = Array.from(selectedForDelete);
    if (idsToDelete.length === 0) return;

    setIsBulkDeleting(true);
    setBulkDeleteOpen(false);

    const token = localStorage.getItem('token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    let successCount = 0;

    try {
      for (const dbId of idsToDelete) {
        try {
          const res = await fetch(`/api/v1/admin/users/${dbId}`, {
            method: 'DELETE',
            headers
          });

          if (res.ok) {
            successCount++;
          } else {
            console.error(
              `Failed deleting user ID ${dbId}: HTTP ${res.status}`
            );
          }
        } catch (err) {
          console.error(`Error deleting user ID ${dbId}:`, err);
        }
      }

      setSelectedForDelete(new Set());
      await fetchUsersAndGroups();

      if (successCount < idsToDelete.length) {
        alert(
          `Deleted ${successCount} of ${idsToDelete.length} selected student(s). Some deletions failed.`
        );
      }
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Group handlers
  const handleSaveGroup = async (groupData: Partial<UserGroup>, memberIds: number[]) => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    try {
      let groupDbId: number | undefined = groupData.db_id;

      if (groupToEdit) {
        groupDbId = groupToEdit.db_id || Number(String(groupToEdit.id).replace('grp-', ''));
        const res = await fetch(`/api/v1/admin/groups/${groupDbId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            name: groupData.name,
            description: groupData.description,
            max_size: groupData.maxSize
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          alert(parseErrorMessage(errData));
          return;
        }
      } else {
        const res = await fetch('/api/v1/admin/groups', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: groupData.name,
            description: groupData.description,
            max_size: groupData.maxSize
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          alert(parseErrorMessage(errData));
          return;
        }
        const created = await res.json();
        groupDbId = created.group_id;
      }

      if (groupDbId && memberIds.length > 0) {
        const memberRes = await fetch(`/api/v1/admin/groups/${groupDbId}/members/bulk`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ user_ids: memberIds })
        });
        if (!memberRes.ok) {
          const errData = await memberRes.json().catch(() => ({}));
          alert(`Group saved, but adding students failed: ${parseErrorMessage(errData)}`);
        }
      }

      await fetchUsersAndGroups();
    } catch (err) {
      console.error('Failed to save group:', err);
      alert('An error occurred while saving the group.');
    }
  };

  const handleConfirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/admin/groups/${groupToDelete.db_id || groupToDelete.id.replace('grp-', '')}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        await fetchUsersAndGroups();
      }
    } catch (err) {
      console.error('Failed to delete group:', err);
    } finally {
      setGroupToDelete(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      {/* ───────────────────────── LEFT 60% — Student Management ───────────────────────── */}
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
          {/* Row 1: Import / Add buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Import Student CSV
            </button>
            <button
              onClick={() => {
                setUserToEdit(null);
                setIsAddModalOpen(true);
              }}
              className="flex-1 px-4 py-2 rounded-xl bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Add Student
            </button>
          </div>

          {/* Row 2: Search + Dept + Year */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative w-full sm:flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by Name, Roll Number, Dept — or S.No e.g. 1-4,7,9-12"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
              />
            </div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full sm:w-36 py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="All">All Depts</option>
              <option value="Cyber Security">Cyber Security</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Information Technology">Information Technology</option>
              <option value="ECE">ECE</option>
              <option value="EEE">EEE</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Civil">Civil</option>
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full sm:w-32 py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="All">All Years</option>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
              <option value="3rd Year">3rd Year</option>
              <option value="4th Year">4th Year</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Showing <strong className="text-slate-900 dark:text-slate-100">{filteredUsers.length}</strong> enrolled students
              {selectedForDelete.size > 0 && (
                <span className="ml-2 text-[#0052CC] dark:text-blue-400">({selectedForDelete.size} selected)</span>
              )}
            </span>
            <button
              onClick={() => selectedForDelete.size > 0 && setBulkDeleteOpen(true)}
              disabled={selectedForDelete.size === 0}
              title={selectedForDelete.size > 0 ? `Delete ${selectedForDelete.size} selected student(s)` : 'Select students to delete'}
              className="p-1.5 rounded-lg text-slate-400 enabled:hover:text-rose-600 enabled:hover:bg-rose-50 dark:enabled:hover:bg-rose-950/40 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compact Student List — scrollable, no pagination */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-auto max-h-[560px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-sm text-slate-600 dark:text-slate-300 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-8 text-center">#</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Dept</th>
                  <th className="p-3">Year</th>
                  <th className="p-3">Roll No.</th>
                  <th className="p-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 dark:text-slate-500 text-xs">
                      No matching students found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u, idx) => {
                    const dbId = getUserDbId(u);
                    const checked = selectedForDelete.has(dbId);
                    return (
                      <tr
                        key={u.id}
                        onClick={() => toggleUserSelection(u)}
                        className={`cursor-pointer transition-colors ${checked ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'}`}
                      >
                        <td className="p-3 text-center text-slate-400 dark:text-slate-500 font-mono">{idx + 1}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {checked ? (
                              <div className="w-7 h-7 rounded-full bg-[#0052CC] text-white flex items-center justify-center flex-shrink-0">
                                <CheckCircle2 className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-[#0052CC] text-white flex items-center justify-center font-bold text-[10px] shadow-xs flex-shrink-0">
                                {u.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                              </div>
                            )}
                            <span className="font-bold text-slate-900 dark:text-slate-100 leading-tight">{u.fullName}</span>
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                          {getDeptShortCode(u.department)}
                        </td>
                        <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                          {u.year || '-'}
                        </td>
                        <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                          {u.rollNumber || '-'}
                        </td>
                        <td className="p-3 text-right">
                          <Link
                            to={`/admin/student-management/student/${u.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="px-2.5 py-1 rounded-lg bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-[11px] shadow-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ───────────────────────── RIGHT 40% — Groups Panel ───────────────────────── */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
          <button
            onClick={() => {
              setGroupToEdit(null);
              setIsGroupModalOpen(true);
            }}
            className="w-full px-4 py-2.5 rounded-xl bg-[#FFA500] hover:bg-amber-500 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Group
          </button>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              placeholder="Search groups..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
            />
          </div>
        </div>

        <div className="space-y-3">
          {filteredGroups.length === 0 ? (
            <div className="py-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
              <UsersRound className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Groups Yet</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Create a group to get started.</p>
            </div>
          ) : (
            filteredGroups.map((g) => (
              <div
                key={g.id}
                onClick={() => navigate(`/admin/groups/${g.id}`)}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{g.name}</h3>
                    <span className="text-[11px] font-bold bg-blue-50 dark:bg-blue-950/50 text-[#0052CC] dark:text-blue-400 border border-blue-100 dark:border-blue-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-1.5">
                      <Users className="w-3 h-3" /> {g.memberCount}/{g.maxSize || 40} students
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setGroupToEdit(g);
                        setIsGroupModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-[#0052CC] hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Edit Group"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setGroupToDelete(g);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Delete Group"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {g.createdDate}
                  </span>
                  <span className="text-[#0052CC] dark:text-blue-400 font-bold inline-flex items-center gap-1">
                    Open <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <UserAddModal
        userToEdit={userToEdit}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveUser}
      />

      <BulkImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onImportUsers={handleBulkImport}
      />

      <GroupCreateModal
        groupToEdit={groupToEdit}
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onSave={handleSaveGroup}
        allStudents={users}
        onMembersChanged={fetchUsersAndGroups}
      />

      {/* Bulk Student Deletion Confirmation Dialog */}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 p-6 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Remove Selected Students?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <span className="font-bold text-slate-800">{selectedForDelete.size}</span> selected student(s)? This action will revoke access and archive lab progress.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setBulkDeleteOpen(false)}
                className="py-2 px-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs"
              >
                {isBulkDeleting ? 'Deleting...' : 'Delete Selected'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Deletion Confirmation Dialog */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 p-6 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Delete Training Group?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <span className="font-bold text-slate-800">{groupToDelete.name}</span>?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setGroupToDelete(null)}
                className="py-2 px-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteGroup}
                className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
              >
                Delete Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
