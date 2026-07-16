import React, { useState } from 'react';
import type { UserGroup } from '../../types/admin';
import { X, UsersRound, Save } from 'lucide-react';

interface GroupCreateModalProps {
  groupToEdit?: UserGroup | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (group: Partial<UserGroup>) => void;
}

export const GroupCreateModal: React.FC<GroupCreateModalProps> = ({
  groupToEdit,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  const isEditMode = !!groupToEdit;

  const [name, setName] = useState(groupToEdit?.name || '');
  const [description, setDescription] = useState(groupToEdit?.description || '');
  const [errors, setErrors] = useState<{ name?: string }>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrors({ name: 'Group name is required.' });
      return;
    }

    onSave({
      id: groupToEdit?.id || `grp-${Date.now()}`,
      name,
      description: description || 'Training group cohort for cybersecurity exercises.',
      memberCount: groupToEdit?.memberCount || 0,
      createdDate: groupToEdit?.createdDate || 'Just now',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-100 text-[#FFA500]">
              <UsersRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {isEditMode ? 'Edit Training Group' : 'Create New Training Group'}
              </h2>
              <p className="text-xs text-slate-500">Organize users into training cohorts</p>
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
          <div>
            <label className="font-bold text-slate-700 block mb-1">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SOC Analysts Batch C 2026"
              className="w-full pl-3 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
            />
            {errors.name && <p className="text-rose-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Description / Training Focus</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of training goals, department, or skill tier..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
            />
          </div>

          {/* Actions */}
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
              {isEditMode ? 'Update Group' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
