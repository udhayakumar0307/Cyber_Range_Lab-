import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import type { CtfEvent, CtfSubmission } from '../../types/ctf';
import { ArrowLeft, RefreshCw, FileText, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export const CTFAuditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const ctfId = Number(id);

  const [ctf, setCtf] = useState<CtfEvent | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const fetchAuditData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Fetch CTF details
      const ctfRes = await fetch(`/api/v1/ctf/${ctfId}`, { headers });
      if (!ctfRes.ok) throw new Error('CTF details not found.');
      const ctfData = await ctfRes.json();
      setCtf(ctfData);

      // 2. Fetch Paginated Submissions Audit Log
      const subRes = await fetch(`/api/v1/ctf/${ctfId}/submissions?page=${page}&limit=${limit}`, { headers });
      if (!subRes.ok) throw new Error('Failed to load submissions audit log.');
      const subData = await subRes.json();
      
      setSubmissions(subData.entries || []);
      setTotal(subData.total || 0);
    } catch (err: any) {
      setError(err.message || 'Error occurred while loading submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [ctfId, page]);

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <AdminLayout>
      <div className="space-y-6">
        
        {/* Navigation / Header */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Link
            to={`/admin/ctf/${ctfId}`}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-indigo-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Event Detail
          </Link>
          <button
            onClick={fetchAuditData}
            className="flex items-center gap-1 bg-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Log
          </button>
        </div>

        {/* CTF Summary Info */}
        {ctf && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Flag Submissions & Hint Audit Log</h2>
              <span className="text-xs text-slate-400 font-medium">({ctf.title})</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Audit log of all correct, incorrect, first-blood submissions, and hint unlock events</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 p-3.5 border border-rose-500/20 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400 font-semibold">
            Loading submission logs...
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-slate-400 text-xs font-semibold">
            No submissions registered for this CTF event yet.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 bg-slate-50/50 dark:bg-slate-950/20">
                      <th className="px-6 py-4">Timestamp</th>
                      <th className="px-6 py-4">Participant</th>
                      <th className="px-6 py-4">Challenge Target</th>
                      <th className="px-6 py-4">Submission Status</th>
                      <th className="px-6 py-4">Points Awarded</th>
                      <th className="px-6 py-4">Hint Penalty Used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                    {submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="px-6 py-4 text-slate-400 font-mono">
                          {formatDateTime(sub.submitted_at)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">
                          {sub.participant_name}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400">
                          {sub.challenge_title}
                        </td>
                        <td className="px-6 py-4">
                          {sub.is_correct ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/35 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[9px]">
                              {sub.is_first_blood ? '🩸 First Blood' : '✅ Correct'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/35 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[9px]">
                              ❌ Incorrect
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 font-mono">
                          {sub.points_credited} pts
                        </td>
                        <td className="px-6 py-4 font-mono font-semibold text-slate-400">
                          {sub.is_correct && sub.hint_penalty_percent > 0 ? (
                            <span className="text-amber-500 font-bold">-{sub.hint_penalty_percent}%</span>
                          ) : (
                            '0%'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
                <span className="text-slate-500 font-medium">
                  Showing page {page} of {totalPages} ({total} entries total)
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="flex items-center gap-1 font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 px-3.5 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                    className="flex items-center gap-1 font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 px-3.5 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </AdminLayout>
  );
};
