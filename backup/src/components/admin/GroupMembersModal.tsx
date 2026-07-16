import React, { useState } from 'react';
import type { UserGroup, PlatformUser } from '../../types/admin';
import { X, UserPlus, Trash2, Search } from 'lucide-react';

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

  // Mock initial assigned group members
  const [members, setMembers] = useState<PlatformUser[]>([
    {
      id: 'usr-1',
      fullName: 'Sarah Connor',
      email: 's.connor@cybersec.io',
      role: 'Admin',
      groupName: group.name,
      groupId: group.id,
      status: 'Active',
      joinedDate: '2026-01-15',
      lastActive: '5 mins ago',
      score: 2450,
      completedLabsCount: 8,
    },
    {
      id: 'usr-4',
      fullName: 'Elena Rostova',
      email: 'elena@cyber-academy.edu',
      role: 'User',
      groupName: group.name,
      groupId: group.id,
      status: 'Inactive',
      joinedDate: '2026-04-05',
      lastActive: '3 days ago',
      score: 840,
      completedLabsCount: 3,
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

  const filteredMembers = members.filter(
    (m) =>
      m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRemoveMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    const newMember: PlatformUser = {
      id: `usr-${Date.now()}`,
      fullName: newUserName,
      email: newUserEmail,
      role: 'User',
      groupName: group.name,
      groupId: group.id,
      status: 'Active',
      joinedDate: 'Just now',
      lastActive: 'Active now',
      score: 0,
      completedLabsCount: 0,
    };

    setMembers((prev) => [...prev, newMember]);
    setNewUserName('');
    setNewUserEmail('');
    setIsAddingUser(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <span className="text-[11px] font-bold bg-blue-50 text-[#0052CC] px-2.5 py-0.5 rounded-full border border-blue-100">
              Cohort Roster ({members.length} Users)
            </span>
            <h2 className="text-base font-extrabold text-slate-900 mt-1">{group.name}</h2>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Top Search & Add Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter cohort members..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
              />
            </div>

            <button
              onClick={() => setIsAddingUser(!isAddingUser)}
              className="px-3 py-1.5 rounded-lg bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Member
            </button>
          </div>

          {/* Quick Add Form Inline */}
          {isAddingUser && (
            <form onSubmit={handleAddMember} className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-[#0052CC]">Quick Assign User to {group.name}</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="p-2 bg-white border border-slate-200 rounded-md focus:outline-none"
                />
                <input
                  type="email"
                  placeholder="User Email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="p-2 bg-white border border-slate-200 rounded-md focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsAddingUser(false)}
                  className="px-3 py-1 text-slate-500 hover:text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-[#0052CC] text-white rounded-md font-bold hover:bg-blue-700"
                >
                  Save to Cohort
                </button>
              </div>
            </form>
          )}

          {/* Members List */}
          <div className="space-y-2">
            {filteredMembers.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No users assigned to this cohort.
              </div>
            ) : (
              filteredMembers.map((m) => (
                <div
                  key={m.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#0052CC] text-white flex items-center justify-center font-bold">
                      {m.fullName.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{m.fullName}</p>
                      <p className="text-[11px] text-slate-500">{m.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#0052CC]">{m.score} pts</span>
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                      title="Remove from group"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs"
          >
            Close Roster
          </button>
        </div>
      </div>
    </div>
  );
};
