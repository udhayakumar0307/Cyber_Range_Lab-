import React, { useState, useEffect } from 'react';
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

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtering & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('/api/v1/admin/users', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setUsers(data);
          }
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Modal visibility states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<PlatformUser | null>(null);

  // Delete modal state
  const [userToDelete, setUserToDelete] = useState<PlatformUser | null>(null);

  // Filtered dataset
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = selectedGroup === 'All' || u.groupName === selectedGroup;
    const matchesRole = selectedRole === 'All' || u.role === selectedRole;
    const matchesStatus = selectedStatus === 'All' || u.status === selectedStatus;
    return matchesSearch && matchesGroup && matchesRole && matchesStatus;
  });

  // Action Handlers
  const handleSaveUser = (userData: Partial<PlatformUser>) => {
    if (userToEdit) {
      // Edit mode update
      setUsers((prev) =>
        prev.map((u) => (u.id === userToEdit.id ? ({ ...u, ...userData } as PlatformUser) : u))
      );
    } else {
      // Add mode append
      setUsers((prev) => [userData as PlatformUser, ...prev]);
    }
  };

  const handleBulkImport = (newUsers: PlatformUser[]) => {
    setUsers((prev) => [...newUsers, ...prev]);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setUserToDelete(null);
    }
  };

  const handleToggleStatus = (user: PlatformUser) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } : u
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-[#0052CC]" />
            User Management & Access Controls
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Provision platform users, organize training cohorts, and manage security role permissions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#6F42C1]" />
            Bulk CSV Import
          </button>

          <button
            onClick={() => {
              setUserToEdit(null);
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      {/* 5.1 Search & Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search bar */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by user name or email address..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
            />
          </div>

          {/* Group Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none"
            >
              <option value="All">All Groups</option>
              <option value="Red Team Cohort 2026">Red Team Cohort 2026</option>
              <option value="SOC Analysts Batch B">SOC Analysts Batch B</option>
              <option value="Blue Team Defense Alpha">Blue Team Defense Alpha</option>
            </select>
          </div>

          {/* Role Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none"
            >
              <option value="All">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Instructor">Instructor</option>
              <option value="User">Regular User</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 font-semibold">
          <span>Showing {filteredUsers.length} of {users.length} registered platform users</span>
          <button
            onClick={() => alert('Exporting users roster report to CSV format...')}
            className="text-[#0052CC] dark:text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" /> Export Users CSV Report
          </button>
        </div>
      </div>

      {/* 5.2 Comprehensive User Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-extrabold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-4">User Metadata</th>
                <th className="p-4">Role Permission</th>
                <th className="p-4">Assigned Group</th>
                <th className="p-4">Account Status</th>
                <th className="p-4">Score & Labs</th>
                <th className="p-4">Last Activity</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                    No matching users found for current filter selections.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleBadgeStyles = {
                    Admin: 'bg-blue-50 text-[#0052CC] border-blue-200',
                    Instructor: 'bg-purple-50 text-[#6F42C1] border-purple-200',
                    User: 'bg-slate-100 text-slate-700 border-slate-200',
                  };

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Avatar */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#0052CC] text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
                            {u.fullName.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{u.fullName}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="p-4">
                        <span
                          className={`text-xs font-bold border px-2.5 py-1 rounded-full ${
                            roleBadgeStyles[u.role]
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      {/* Group */}
                      <td className="p-4 text-xs font-semibold text-slate-700">
                        {u.groupName}
                      </td>

                      {/* Status Chip */}
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
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

                      {/* Score & Labs */}
                      <td className="p-4 text-xs">
                        <div className="font-bold text-[#0052CC]">{u.score.toLocaleString()} pts</div>
                        <div className="text-[11px] text-slate-500">{u.completedLabsCount} labs completed</div>
                      </td>

                      {/* Last Active */}
                      <td className="p-4 text-xs text-slate-500 font-medium">
                        {u.lastActive}
                      </td>

                      {/* Action Dropdown Menu */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setUserToEdit(u);
                              setIsAddModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-[#0052CC] hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit User"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.status === 'Active'
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-[#28A745] hover:bg-emerald-50'
                            }`}
                            title={u.status === 'Active' ? 'Deactivate User' : 'Activate User'}
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setUserToDelete(u)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
