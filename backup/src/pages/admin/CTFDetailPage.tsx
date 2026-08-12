import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import type { CtfEvent, CtfChallenge } from '../../types/ctf';
import { ChallengeFormModal } from './ChallengeFormModal';
import {
  ArrowLeft,
  Plus,
  Play,
  Square,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  Users,
  Trophy,
  Activity,
  AlertCircle,
  FileText,
} from 'lucide-react';

export const CTFDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const ctfId = Number(id);

  const [ctf, setCtf] = useState<CtfEvent | null>(null);
  const [challenges, setChallenges] = useState<CtfChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Challenge Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<CtfChallenge | null>(null);

  const fetchCtfDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      // Fetch CTF
      const ctfRes = await fetch(`/api/v1/ctf/${ctfId}`, { headers });
      if (!ctfRes.ok) throw new Error('CTF details not found.');
      const ctfData = await ctfRes.json();
      setCtf(ctfData);

      // Fetch Challenges
      const chRes = await fetch(`/api/v1/ctf/${ctfId}/challenges`, { headers });
      if (!chRes.ok) throw new Error('Failed to load challenges.');
      const chData = await chRes.json();
      setChallenges(chData);
    } catch (err: any) {
      setError(err.message || 'Error occurred while loading data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCtfDetails();
  }, [ctfId]);

  const handleStart = async () => {
    if (!ctf) return;
    if (!window.confirm('Start this CTF? Active students will be enrolled.')) return;
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/v1/ctf/${ctf.id}/start`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed to start CTF.');
      fetchCtfDetails();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStop = async () => {
    if (!ctf) return;
    if (!window.confirm('Stop this CTF? This will close all target URLs.')) return;
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/v1/ctf/${ctf.id}/stop`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed to stop CTF.');
      fetchCtfDetails();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleVisibility = async (cid: number) => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/v1/ctf/${ctfId}/challenge/${cid}/visibility`, {
        method: 'PATCH',
        headers,
      });
      if (!res.ok) throw new Error('Failed to toggle visibility.');
      
      setChallenges(
        challenges.map((c) => (c.id === cid ? { ...c, is_hidden: !c.is_hidden } : c))
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteChallenge = async (cid: number) => {
    if (!window.confirm('Are you sure you want to permanently delete this challenge and all uploaded attachments?')) return;
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/v1/ctf/${ctfId}/challenge/${cid}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error('Failed to delete challenge.');
      
      setChallenges(challenges.filter((c) => c.id !== cid));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openAddModal = () => {
    setEditingChallenge(null);
    setIsModalOpen(true);
  };

  const openEditModal = (ch: CtfChallenge) => {
    setEditingChallenge(ch);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-12 text-slate-400 font-semibold">
          Loading CTF Details...
        </div>
      </AdminLayout>
    );
  }

  if (!ctf) {
    return (
      <AdminLayout>
        <div className="text-center py-12 text-rose-500 font-semibold">
          CTF Event not found.
        </div>
      </AdminLayout>
    );
  }

  const getStatusBadge = (status: CtfEvent['status']) => {
    switch (status) {
      case 'active':
        return <span className="text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] border border-emerald-100 dark:border-emerald-900/35">Live</span>;
      case 'completed':
        return <span className="text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] border border-slate-200 dark:border-slate-700">Concluded</span>;
      case 'paused':
        return <span className="text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] border border-amber-100 dark:border-amber-900/35">Paused</span>;
      default:
        return <span className="text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] border border-indigo-100 dark:border-indigo-900/35">Scheduled</span>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Link
            to="/admin/ctf"
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-indigo-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Event List
          </Link>
          <div className="flex gap-2">
            <Link
              to={`/admin/ctf/${ctfId}/progress`}
              className="flex items-center gap-1 bg-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              <Activity className="w-3.5 h-3.5" />
              Live Progress
            </Link>
            <Link
              to={`/admin/ctf/${ctfId}/audit`}
              className="flex items-center gap-1 bg-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              <FileText className="w-3.5 h-3.5" />
              Audit Log
            </Link>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{ctf.title}</h2>
              {getStatusBadge(ctf.status)}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{ctf.description || 'No description provided.'}</p>
          </div>
          <div className="flex gap-2">
            {ctf.status === 'scheduled' && (
              <button
                onClick={handleStart}
                className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-all shadow-md shadow-emerald-500/25"
              >
                <Play className="w-4 h-4" />
                Start CTF
              </button>
            )}
            {ctf.status === 'active' && (
              <button
                onClick={handleStop}
                className="flex items-center gap-1 bg-rose-500 hover:bg-rose-650 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-all shadow-md shadow-rose-500/25"
              >
                <Square className="w-4 h-4" />
                Stop CTF
              </button>
            )}
            <Link
              to={`/admin/ctf/${ctf.id}/edit`}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm px-4 py-2 rounded-xl transition-all border border-slate-200 dark:border-slate-700"
            >
              Configure
            </Link>
          </div>
        </div>

        {/* Challenges Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Challenge Quest Bank</h3>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-indigo-500/25"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Challenge
          </button>
        </div>

        {challenges.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <Trophy className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400">No Challenges Configured</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Add your first binary, web, or forensics puzzle to compile the tournament board.
            </p>
            <button
              onClick={openAddModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl mt-4 transition-all shadow-sm"
            >
              Add Challenge
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 bg-slate-50/50 dark:bg-slate-950/20">
                    <th className="px-6 py-4">Title / Target Target</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Scoring Mode</th>
                    <th className="px-6 py-4">Current Value</th>
                    <th className="px-6 py-4">Solves</th>
                    <th className="px-6 py-4">Visibility</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                  {challenges.map((ch) => (
                    <tr key={ch.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-colors">
                      <td className="px-6 py-4 max-w-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{ch.title}</span>
                        {ch.connection_string && (
                          <span className="text-[10px] text-slate-400 font-mono block mt-1">
                            {ch.connection_string}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                          {ch.category || 'Web'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block font-bold text-xs uppercase ${ch.scoring_mode === 'dynamic' ? 'text-indigo-600' : 'text-slate-500'}`}>
                          {ch.scoring_mode}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {ch.scoring_mode === 'static' ? ch.static_points : ch.current_points} pts
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {ch.solve_count} solve{ch.solve_count !== 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleVisibility(ch.id)}
                          className={`flex items-center gap-1 text-xs font-semibold p-1.5 rounded-lg border transition-colors ${
                            ch.is_hidden
                              ? 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                              : 'bg-indigo-50/50 text-indigo-600 border-indigo-100 hover:bg-indigo-100/50'
                          }`}
                        >
                          {ch.is_hidden ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              Hidden
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              Visible
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(ch)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteChallenge(ch.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Challenge Form Modal */}
      <ChallengeFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ctfId={ctfId}
        challenge={editingChallenge}
        onSave={fetchCtfDetails}
      />
    </AdminLayout>
  );
};
