import React, { useState, useEffect } from 'react';
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

  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<UserGroup | null>(null);

  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<UserGroup | null>(null);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  const fetchGroups = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/admin/groups', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setGroups(data);
        }
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const [groupToDelete, setGroupToDelete] = useState<UserGroup | null>(null);

  const filteredGroups = groups.filter(
    (g) =>
      (g.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveGroup = async (groupData: Partial<UserGroup>) => {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    try {
      if (groupToEdit) {
        // Edit group
        const res = await fetch(`/api/v1/admin/groups/${groupToEdit.db_id || groupToEdit.id.replace('grp-', '')}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            name: groupData.name,
            description: groupData.description
          })
        });
        if (res.ok) fetchGroups();
      } else {
        // Create new group
        const res = await fetch('/api/v1/admin/groups', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: groupData.name,
            description: groupData.description
          })
        });
        if (res.ok) fetchGroups();
      }
    } catch (err) {
      console.error('Failed to save group:', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!groupToDelete) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/admin/groups/${groupToDelete.db_id || groupToDelete.id.replace('grp-', '')}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        fetchGroups();
      }
    } catch (err) {
      console.error('Failed to delete group:', err);
    } finally {
      setGroupToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <UsersRound className="w-5 h-5 text-[#0052CC] dark:text-blue-400" />
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Training Group Management</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Organize users into training groups and manage lab allocations per group.
          </p>
        </div>

        <button
          onClick={() => {
            setGroupToEdit(null);
            setIsCreateModalOpen(true);
          }}
          className="bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 self-start sm:self-center cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create New Group
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search training groups by name or description..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
          />
        </div>
      </div>

      {/* Group Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredGroups.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
            <UsersRound className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">No Groups Found</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try clearing your search terms.</p>
          </div>
        ) : (
          filteredGroups.map((g) => (
            <div
              key={g.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold bg-blue-50 dark:bg-blue-950/50 text-[#0052CC] dark:text-blue-400 border border-blue-100 dark:border-blue-800 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> {g.memberCount} Enrolled {g.memberCount === 1 ? 'User' : 'Users'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setGroupToEdit(g);
                        setIsCreateModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-[#0052CC] hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Edit Group"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setGroupToDelete(g)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Delete Group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{g.name}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{g.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Created {g.createdDate}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedGroupForMembers(g);
                      setIsMembersModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-colors cursor-pointer"
                  >
                    View Members
                  </button>

                  <button
                    onClick={() => navigate('/admin/allocations')}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#0052CC] dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-bold border border-blue-200 dark:border-blue-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
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
        onClose={() => {
          setIsMembersModalOpen(false);
          fetchGroups();
        }}
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
