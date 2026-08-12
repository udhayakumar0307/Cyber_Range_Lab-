import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import type { CtfEvent } from '../../types/ctf';
import { Plus, Play, Square, Settings, Eye, Users, Calendar, AlertCircle, Trash2 } from 'lucide-react';

export const CTFListPage: React.FC = () => {
  const [events, setEvents] = useState<CtfEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/v1/ctf', { headers });
      if (!res.ok) throw new Error('Failed to fetch CTF list.');
      const data = await res.json();
      setEvents(data);
    } catch (err: any) {
      setError(err.message || 'Error loading CTF events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleStart = async (ctfId: number) => {
    if (!window.confirm('Are you sure you want to manually activate this CTF? All active students will be enrolled.')) return;
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/v1/ctf/${ctfId}/start`, { method: 'POST', headers });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to start CTF.');
      }
      fetchEvents();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStop = async (ctfId: number) => {
    if (!window.confirm('Are you sure you want to manually stop this CTF? This will disable all challenge URLs.')) return;
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/v1/ctf/${ctfId}/stop`, { method: 'POST', headers });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to stop CTF.');
      }
      fetchEvents();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (ctfId: number) => {
    if (!window.confirm('Are you sure you want to delete this CTF event? This action is permanent and will delete all submissions and participation records.')) return;
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/v1/ctf/${ctfId}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to delete CTF.');
      }
      fetchEvents();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const formatDateTime = (iso: string) => {
    // Append 'Z' if missing so the browser treats the timestamp as UTC
    // and converts to the user's local timezone automatically.
    const utcIso = iso && !iso.endsWith('Z') && !iso.includes('+') ? iso + 'Z' : iso;
    return new Date(utcIso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const getStatusBadge = (status: CtfEvent['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/35 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide">
            Live
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide">
            Concluded
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 text-amber-500 dark:text-amber-400 border border-amber-200 dark:border-amber-900/35 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide">
            Paused
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/35 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide">
            Scheduled
          </span>
        );
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        
        {/* Header Block */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Capture The Flag Module</h2>
            <p className="text-xs text-slate-400 mt-1">Admin panel to schedule events and configure challenge environments</p>
          </div>
          <Link
            to="/admin/ctf/new"
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-500/25"
          >
            <Plus className="w-4 h-4" />
            Create Event
          </Link>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 p-3.5 border border-rose-500/20 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm font-semibold">
            Loading CTF events...
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No CTF Events Scheduled</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Get started by creating your first automated Capture The Flag target zone.
            </p>
            <Link
              to="/admin/ctf/new"
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl mt-4 transition-all shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Event
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 bg-slate-50/50 dark:bg-slate-950/20">
                    <th className="px-6 py-4">CTF Event Name</th>
                    <th className="px-6 py-4">Schedule (Start / End)</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Visibility</th>
                    <th className="px-6 py-4 text-center">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                  {events.map((event) => (
                    <tr key={event.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-colors">
                      <td className="px-6 py-5 max-w-sm">
                        <Link to={`/admin/ctf/${event.id}`} className="font-bold text-slate-800 dark:text-slate-200 hover:text-indigo-600 transition-colors block">
                          {event.title}
                        </Link>
                        <span className="text-xs text-slate-400 line-clamp-1 mt-1 block">
                          {event.description || 'No description provided.'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0" />
                            {formatDateTime(event.start_time ?? '')}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full flex-shrink-0" />
                            {formatDateTime(event.end_time ?? '')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">{getStatusBadge(event.status)}</td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center font-bold text-xs ${event.is_public ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {event.is_public ? 'Public' : 'Hidden'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            to={`/admin/ctf/${event.id}`}
                            className="flex items-center gap-1 font-semibold text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors text-slate-600 dark:text-slate-300"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </Link>
                          
                          {event.status === 'scheduled' && (
                            <button
                              onClick={() => handleStart(event.id)}
                              className="flex items-center gap-1 font-semibold text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                            >
                              <Play className="w-3.5 h-3.5" />
                              Start
                            </button>
                          )}
                          
                          {event.status === 'active' && (
                            <button
                              onClick={() => handleStop(event.id)}
                              className="flex items-center gap-1 font-semibold text-xs bg-rose-500 hover:bg-rose-650 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                            >
                              <Square className="w-3.5 h-3.5" />
                              Stop
                            </button>
                          )}

                          <Link
                            to={`/admin/ctf/${event.id}/edit`}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => handleDelete(event.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-450 transition-colors"
                            title="Delete Event"
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
    </AdminLayout>
  );
};
