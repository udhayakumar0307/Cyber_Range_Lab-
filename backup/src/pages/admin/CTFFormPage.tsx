import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AlertCircle, Calendar, Save, ArrowLeft } from 'lucide-react';

export const CTFFormPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  // Convert backend datetime string to datetime-local input format (YYYY-MM-DDTHH:MM in LOCAL time).
  // Backend always stores UTC, but may omit the 'Z' suffix — append it so the
  // browser treats the value as UTC and converts to local time correctly.
  const toLocalInputFormat = (isoString: string) => {
    if (!isoString) return '';
    const utcIso = !isoString.endsWith('Z') && !isoString.includes('+') ? isoString + 'Z' : isoString;
    const date = new Date(utcIso);
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  useEffect(() => {
    if (isEdit) {
      const fetchCTF = async () => {
        try {
          const token = localStorage.getItem('token');
          const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
          const res = await fetch(`/api/v1/ctf/${id}`, { headers });
          if (!res.ok) throw new Error('Failed to fetch CTF details.');
          const data = await res.json();
          setTitle(data.title);
          setDescription(data.description || '');
          setStartTime(toLocalInputFormat(data.start_time));
          setEndTime(toLocalInputFormat(data.end_time));
          setIsPublic(data.is_public);
        } catch (err: any) {
          setError(err.message || 'Error fetching CTF.');
        } finally {
          setFetching(false);
        }
      };
      fetchCTF();
    }
  }, [id, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      setError('End time must be after the start time.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const payload = {
        title,
        description: description || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        is_public: isPublic,
      };

      const url = isEdit ? `/api/v1/ctf/${id}` : '/api/v1/ctf';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to save CTF event.');
      }

      navigate('/admin/ctf');
    } catch (err: any) {
      setError(err.message || 'Error occurred while saving CTF.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <AdminLayout>
        <div className="text-center py-12 text-slate-400 font-semibold">
          Loading CTF Event Form...
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Navigation / Header */}
        <div className="flex items-center gap-4">
          <Link
            to="/admin/ctf"
            className="p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {isEdit ? 'Edit CTF Event' : 'Schedule New CTF Event'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Set schedules and rules for the Jeopardy tournament
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 p-3.5 border border-rose-500/20 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
          
          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">CTF Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual Cyber Security Blitz 2026"
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide rules, background context, prizes, or rules of engagement..."
              rows={4}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
            />
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Start Time</label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2.5 text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">End Time</label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2.5 text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
              />
              <div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">Make CTF Event Public</span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  If public, the event will appear in students' dashboard list when active.
                </span>
              </div>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-5">
            <Link
              to="/admin/ctf"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-800 px-4 py-2 rounded-xl transition-all"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2 rounded-xl transition-all shadow-md disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Event'}
            </button>
          </div>

        </form>

      </div>
    </AdminLayout>
  );
};
