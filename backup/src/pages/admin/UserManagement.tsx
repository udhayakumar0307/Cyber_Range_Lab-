import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import type { PlatformUser } from '../../types/admin';
import { UserAddModal } from '../../components/admin/UserAddModal';
import { BulkImportModal } from '../../components/admin/BulkImportModal';
import { 
  Users, 
  UserPlus, 
  FileSpreadsheet, 
  Search, 
  Edit3, 
  Trash2, 
  UserCheck, 
  AlertTriangle,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { downloadAuthenticatedFile } from '../../utils/exportUtils';

import { getRoleDisplayName } from '../../utils/roleMapping';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || searchParams.get('q') || '';

  // Filtering & Search state
  const [searchQuery, setSearchQuery] = useState(urlSearch);
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Bulk Actions & Drawer State
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [drawerUser, setDrawerUser] = useState<PlatformUser | null>(null);

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

  const [availableGroups, setAvailableGroups] = useState<any[]>([]);

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
  }, []);

  // Modal visibility states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<PlatformUser | null>(null);

  // Delete modal state
  const [userToDelete, setUserToDelete] = useState<PlatformUser | null>(null);

  // Filtered dataset (excluding internal platform SYSTEM_ADMIN / sysadmin accounts)
  const filteredUsers = users.filter((u) => {
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

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.groupName || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q);
    const matchesGroup = selectedGroup === 'All' || u.groupName === selectedGroup;
    const matchesRole = selectedRole === 'All' || u.role === selectedRole;
    const matchesStatus = selectedStatus === 'All' || u.status === selectedStatus;
    return matchesSearch && matchesGroup && matchesRole && matchesStatus;
  });

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
      // Edit mode update
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
      // Add mode create
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

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    const token = localStorage.getItem('token');
    const dbId = userToDelete.db_id || Number(String(userToDelete.id).replace('usr-', ''));
    try {
      const res = await fetch(`/api/v1/admin/users/${dbId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id && u.db_id !== dbId));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || 'Failed to delete user.');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
    } finally {
      setUserToDelete(null);
    }
  };

  const handleToggleStatus = async (user: PlatformUser) => {
    const token = localStorage.getItem('token');
    const dbId = user.db_id || Number(String(user.id).replace('usr-', ''));
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await fetch(`/api/v1/admin/users/${dbId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          is_active: newStatus === 'Active'
        })
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id ? { ...u, status: newStatus } : u
          )
        );
      }
    } catch (err) {
      console.error('Error toggling user status:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Single Horizontal Row Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search bar (~55-60% width) */}
          <div className="relative w-full md:w-[58%]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search student by Name, Roll Number, Email or Department..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
            />
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-[14%]">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Year Filter */}
          <div className="w-full md:w-[14%]">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="All">All Years</option>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
              <option value="3rd Year">3rd Year</option>
              <option value="4th Year">4th Year</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="w-full md:w-[14%]">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
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
          </div>
        </div>

        {/* Action Buttons Toolbar Below */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Showing <strong className="text-slate-900 dark:text-slate-100">{filteredUsers.length}</strong> enrolled students
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Import Student CSV
            </button>

            <button
              onClick={() => {
                setUserToEdit(null);
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Add Student
            </button>

            <button
              onClick={() => {
                if (selectedUserIds.length === 0) alert('Select at least one student first.');
                else alert(`Assigning group cohort to ${selectedUserIds.length} students`);
              }}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs transition-colors cursor-pointer"
            >
              Assign Group
            </button>

            <button
              onClick={() => {
                if (selectedUserIds.length === 0) alert('Select students to delete.');
                else {
                  if (confirm(`Delete ${selectedUserIds.length} selected students? This action cannot be undone.`)) {
                    setUsers(prev => prev.filter(u => !selectedUserIds.includes(String(u.id))));
                    setSelectedUserIds([]);
                  }
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-100 transition-colors cursor-pointer"
            >
              Delete Selected
            </button>
          </div>
        </div>
      </div>

      {/* 5.2 Comprehensive User Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">            <thead className="bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-extrabold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-4 w-10 text-center">
                  <input 
                    type="checkbox"
                    checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedUserIds(filteredUsers.map(u => String(u.id)));
                      else setSelectedUserIds([]);
                    }}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="p-4">Student Name</th>
                <th className="p-4">Roll Number</th>
                <th className="p-4">Department</th>
                <th className="p-4">Year</th>
                <th className="p-4">Email</th>
                <th className="p-4">Status</th>
                <th className="p-4">Last Activity</th>
                <th className="p-4 text-right">View Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                    No matching students found for current filter selections.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 text-center">
                        <input 
                          type="checkbox"
                          checked={selectedUserIds.includes(String(u.id))}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedUserIds(prev => [...prev, String(u.id)]);
                            else setSelectedUserIds(prev => prev.filter(id => id !== String(u.id)));
                          }}
                          className="rounded border-slate-300"
                        />
                      </td>

                      {/* Student Name */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#0052CC] text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
                            {u.fullName.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <span className="font-bold text-slate-900 leading-tight">{u.fullName}</span>
                        </div>
                      </td>

                      {/* Roll Number */}
                      <td className="p-4 text-xs font-semibold text-slate-700">
                        {u.rollNumber || '22BCS104'}
                      </td>

                      {/* Department */}
                      <td className="p-4 text-xs font-semibold text-slate-700">
                        {u.department || 'Cyber Security'}
                      </td>

                      {/* Year */}
                      <td className="p-4 text-xs font-semibold text-slate-700">
                        {u.year || 'III Year'}
                      </td>

                      {/* Email */}
                      <td className="p-4 text-xs text-slate-600 font-medium">
                        {u.email}
                      </td>

                      {/* Status Chip */}
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            u.status === 'Active'
                              ? 'bg-emerald-50 text-[#28A745] border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              u.status === 'Active' ? 'bg-[#28A745]' : 'bg-slate-400'
                            }`}
                          ></span>
                          {u.status}
                        </span>
                      </td>

                      {/* Last Activity */}
                      <td className="p-4 text-xs text-slate-500 font-medium">
                        {u.lastActive || 'Today 10:30 AM'}
                      </td>

                      {/* View Details Button */}
                      <td className="p-4 text-right">
                        <Link
                          to={`/admin/student-management/student/${u.id}`}
                          className="px-3 py-1.5 rounded-lg bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Pagination */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Showing 1-5 of {filteredUsers.length} entries</span>
          <div className="flex items-center gap-1">
            <button disabled className="p-1 rounded text-slate-300">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 py-0.5 rounded bg-[#0052CC] text-white font-bold">1</span>
            <button disabled className="p-1 rounded text-slate-300">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
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

      {/* 5.5 User Deletion Confirmation Dialog */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 p-6 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">Remove Platform User?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <span className="font-bold text-slate-800">{userToDelete.fullName}</span>? This action will revoke access and archive lab progress.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setUserToDelete(null)}
                className="py-2 px-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
