import React, { useState } from 'react';
import type { PlatformUser, UserRole, AccountStatus } from '../../types/admin';
import { X, UserPlus, Save } from 'lucide-react';

interface UserAddModalProps {
  userToEdit?: PlatformUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Partial<PlatformUser>) => void;
}

export const UserAddModal: React.FC<UserAddModalProps> = ({
  userToEdit,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  const isEditMode = !!userToEdit;

  const [fullName, setFullName] = useState(userToEdit?.fullName || '');
  const [email, setEmail] = useState(userToEdit?.email || '');
  const [role, setRole] = useState<UserRole>(userToEdit?.role || 'User');
  const [groupName, setGroupName] = useState(userToEdit?.groupName || 'Red Team Cohort 2026');
  const [status, setStatus] = useState<AccountStatus>(userToEdit?.status || 'Active');
  const [errors, setErrors] = useState<{ fullName?: string; email?: string }>({});

  const validate = () => {
    const errs: { fullName?: string; email?: string } = {};
    if (!fullName.trim()) errs.fullName = 'Full name is required.';
    if (!email.trim() || !email.includes('@')) errs.email = 'Valid email is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      id: userToEdit?.id || `usr-${Date.now()}`,
      fullName,
      email,
      role,
      groupName,
      status,
      score: userToEdit?.score || 0,
      completedLabsCount: userToEdit?.completedLabsCount || 0,
      joinedDate: userToEdit?.joinedDate || 'Just now',
      lastActive: 'Active now',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 text-[#0052CC]">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {isEditMode ? 'Edit User Credentials' : 'Add New Platform User'}
              </h2>
              <p className="text-xs text-slate-500">Assign role permissions and training group</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Full Name */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Full Name</label>
            <div className="relative">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Sarah Connor"
                className="w-full pl-3 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
              />
            </div>
            {errors.fullName && <p className="text-rose-500 mt-1">{errors.fullName}</p>}
          </div>

          {/* Email Address */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Email Address</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. sarah@cyberrange.io"
                className="w-full pl-3 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
              />
            </div>
            {errors.email && <p className="text-rose-500 mt-1">{errors.email}</p>}
          </div>

          {/* Role & Status Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Platform Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none"
              >
                <option value="User">Regular User</option>
                <option value="Admin">Administrator</option>
                <option value="CIA">CIA (Cyber Infrastructure Administrator)</option>
                <option value="Instructor">Instructor</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Account Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AccountStatus)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending Invite</option>
              </select>
            </div>
          </div>

          {/* Training Group Selection */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Assign Training Group</label>
            <select
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none"
            >
              <option value="Red Team Cohort 2026">Red Team Cohort 2026</option>
              <option value="SOC Analysts Batch B">SOC Analysts Batch B</option>
              <option value="Blue Team Defense Alpha">Blue Team Defense Alpha</option>
              <option value="Executive Security Briefing">Executive Security Briefing</option>
              <option value="Unassigned">Unassigned</option>
            </select>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#0052CC] hover:bg-blue-700 text-white font-bold transition-colors shadow-xs inline-flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {isEditMode ? 'Update Account' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
