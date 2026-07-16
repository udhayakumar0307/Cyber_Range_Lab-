import React, { useState } from 'react';
import type { UserGroup } from '../../types/admin';
import { GroupCreateModal } from '../../components/admin/GroupCreateModal';
import { GroupMembersModal } from '../../components/admin/GroupMembersModal';
import { 
  UsersRound, 
  Plus, 
  Search, 
  Users, 
  Layers, 
  Edit3, 
  Trash2, 
  Calendar, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const GroupManagement: React.FC = () => {
  const navigate = useNavigate();

  // Mock Groups
  const [groups, setGroups] = useState<UserGroup[]>([
    {
      id: 'grp-1',
      name: 'Red Team Cohort 2026',
      description: 'Advanced penetration testing and offensive cyber operations cohort.',
      memberCount: 42,
      createdDate: '2026-01-10',
    },
    {
      id: 'grp-2',
      name: 'Blue Team Defense Alpha',
      description: 'Defensive SOC monitoring, threat hunting, and incident response team.',
      memberCount: 35,
      createdDate: '2026-02-14',
    },
    {
      id: 'grp-3',
      name: 'SOC Analysts Batch B',
      description: 'Junior Security Operations Center analysts training program.',
      memberCount: 28,
      createdDate: '2026-03-01',
    },
    {
      id: 'grp-4',
      name: 'Executive Security Briefing',
      description: 'Leadership overview and cloud compliance assessment cohort.',
      memberCount: 15,
      createdDate: '2026-04-20',
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<UserGroup | null>(null);

  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<UserGroup | null>(null);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  const [groupToDelete, setGroupToDelete] = useState<UserGroup | null>(null);

  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveGroup = (groupData: Partial<UserGroup>) => {
    if (groupToEdit) {
      setGroups((prev) =>
        prev.map((g) => (g.id === groupToEdit.id ? ({ ...g, ...groupData } as UserGroup) : g))
      );
    } else {
      setGroups((prev) => [groupData as UserGroup, ...prev]);
    }
  };

  const handleConfirmDelete = () => {
    if (groupToDelete) {
      setGroups((prev) => prev.filter((g) => g.id !== groupToDelete.id));
      setGroupToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <UsersRound className="w-7 h-7 text-[#0052CC]" />
            User Group Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Organize users into training cohorts and manage lab allocations per group.
          </p>
        </div>

        <button
          onClick={() => {
            setGroupToEdit(null);
            setIsCreateModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create New Group
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search group cohorts by name or description..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
          />
        </div>
      </div>

      {/* Group Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredGroups.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300">
            <UsersRound className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">No Groups Found</h3>
            <p className="text-xs text-slate-400 mt-1">Try clearing your search terms.</p>
          </div>
        ) : (
          filteredGroups.map((g) => (
            <div
              key={g.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold bg-blue-50 text-[#0052CC] border border-blue-100 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> {g.memberCount} Enrolled Users
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setGroupToEdit(g);
                        setIsCreateModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-[#0052CC] hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Group"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setGroupToDelete(g)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-extrabold text-slate-900">{g.name}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{g.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Created {g.createdDate}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedGroupForMembers(g);
                      setIsMembersModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold transition-colors"
                  >
                    View Members
                  </button>

                  <button
                    onClick={() => navigate('/admin/allocations')}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#0052CC] hover:bg-blue-100 font-bold border border-blue-200 transition-colors inline-flex items-center gap-1"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Allocations <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <GroupCreateModal
        groupToEdit={groupToEdit}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleSaveGroup}
      />

      <GroupMembersModal
        group={selectedGroupForMembers}
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 p-6 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Delete User Group?</h3>
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
                onClick={handleConfirmDelete}
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
