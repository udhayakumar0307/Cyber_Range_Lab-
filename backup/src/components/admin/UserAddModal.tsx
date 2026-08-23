import React, { useState } from 'react';
import type { PlatformUser } from '../../types/admin';
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
  const isEditMode = !!userToEdit;

  const [fullName, setFullName] = useState(userToEdit?.fullName || '');
  const [email, setEmail] = useState(userToEdit?.email || '');
  const [year, setYear] = useState<string>(userToEdit?.year || 'III Year');
  const [department, setDepartment] = useState<string>(userToEdit?.department || 'Cyber Security');
  const [rollNumber, setRollNumber] = useState<string>(userToEdit?.rollNumber || '');
  const [errors, setErrors] = useState<{ fullName?: string; email?: string }>({});

  if (!isOpen) return null;

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
      db_id: userToEdit?.db_id || userToEdit?.id,
      fullName,
      email,
      role: userToEdit?.role || 'User',
      groupName: userToEdit?.groupName || 'Unassigned',
      groupId: userToEdit?.groupId,
      status: userToEdit?.status || 'Active',
      year,
      department,
      rollNumber,
      score: userToEdit?.score || 0,
      completedLabsCount: userToEdit?.completedLabsCount || 0,
      joinedDate: userToEdit?.joinedDate || 'Just now',
      lastActive: 'Active now',
    } as any);

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 text-[#0052CC]">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {isEditMode ? 'Edit Student Details' : 'Add New Student'}
              </h2>
              <p className="text-xs text-slate-500">Basic academic details for this student</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Full Name */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Sarah Connor"
              className="w-full pl-3 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
            />
            {errors.fullName && <p className="text-rose-500 mt-1">{errors.fullName}</p>}
          </div>

          {/* Email Address */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. sarah@cyberrange.io"
              className="w-full pl-3 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
            />
            {errors.email && <p className="text-rose-500 mt-1">{errors.email}</p>}
          </div>

          {/* Academic Year & Department Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Academic Year</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none"
              >
                <option value="I Year">I Year</option>
                <option value="II Year">II Year</option>
                <option value="III Year">III Year</option>
                <option value="IV Year">IV Year</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none"
              >
                <option value="Cyber Security">Cyber Security</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Electronics & Communication">Electronics & Communication</option>
                <option value="Electrical Engineering">Electrical Engineering</option>
                <option value="Mechanical Engineering">Mechanical Engineering</option>
                <option value="Civil Engineering">Civil Engineering</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Roll Number Field */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Roll Number / Student ID (Optional)</label>
            <input
              type="text"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="e.g. 22BCS015"
              className="w-full pl-3 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
            />
          </div>

          {!isEditMode && (
            <p className="text-[11px] text-slate-400 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              A default password will be generated automatically and can be reset later from the student's profile.
            </p>
          )}

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
              {isEditMode ? 'Update Student' : 'Create Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
