import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  UsersRound,
  Bell,
  Trophy,
  CircleDot,
  Hourglass,
  CheckCircle2,
  Download,
  FileText,
} from 'lucide-react';

interface StudentLabStat {
  user_id: number;
  name: string;
  modules_completed: number;
  total_modules: number;
  score: number;
  time_taken_seconds: number;
  status: 'not_started' | 'in_progress' | 'completed';
}

interface LabStatus {
  assigned: boolean;
  lab_name?: string;
  start_datetime?: string;
  end_datetime?: string;
  total_students?: number;
  not_started?: number;
  in_progress?: number;
  completed?: number;
  leaderboard?: { user_id: number; name: string; score: number }[];
  students?: StudentLabStat[];
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds) return '0m';

  const mins = Math.floor(totalSeconds / 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  const secs = Math.floor(totalSeconds % 60);

  if (hrs > 0) return `${hrs}h ${remMins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export const ReportGroupDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [groupName, setGroupName] = useState('');
  const [labStatus, setLabStatus] = useState<LabStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const dbId = (groupId || '').replace('grp-', '');

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      try {
        const [gRes, sRes] = await Promise.all([
          fetch(`/api/v1/admin/groups/${dbId}`, { headers }),
          fetch(`/api/v1/admin/groups/${dbId}/lab-status`, { headers }),
        ]);
        if (gRes.ok) {
          const g = await gRes.json();
          setGroupName(g.name);
        }
        if (sRes.ok) setLabStatus(await sRes.json());
      } catch (err) {
        console.error('Error fetching report detail:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [groupId]);

  const handleExport = (format: 'csv' | 'pdf') => {
    const token = localStorage.getItem('token');
    const url = `/api/v1/admin/groups/${dbId}/lab-report/export?format=${format}`;
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => res.blob())
      .then((blob) => {
        const objUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = `lab-report.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(objUrl);
      })
      .catch((err) => {
        console.error('Export failed:', err);
        alert('Failed to export report.');
      });
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading report...</div>;
  }

  if (!labStatus?.assigned) {
    return (
      <div className="p-10 text-center">
        <p className="text-slate-500 text-sm">No lab assignment record found for this group.</p>
        <Link to="/admin/reports" className="mt-3 text-[#0052CC] font-bold text-xs hover:underline inline-block">
          Back to Reports
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/admin/reports"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Reports
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-[#0052CC] dark:text-blue-400 flex items-center justify-center">
            <UsersRound className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">{groupName}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{labStatus.lab_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="px-3 py-2 rounded-lg bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {labStatus.start_datetime ? new Date(labStatus.start_datetime).toLocaleString() : '-'}
            {' '}&rarr;{' '}
            {labStatus.end_datetime ? new Date(labStatus.end_datetime).toLocaleString() : '-'}
          </span>
          <span title="Notification sent to all verified students" className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
            <Bell className="w-3 h-3" /> Notified
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
            <CircleDot className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <p className="text-lg font-black text-slate-800 dark:text-slate-100">{labStatus.not_started ?? 0}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Not Started</p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-center">
            <Hourglass className="w-4 h-4 text-[#0052CC] mx-auto mb-1" />
            <p className="text-lg font-black text-[#0052CC] dark:text-blue-400">{labStatus.in_progress ?? 0}</p>
            <p className="text-[10px] font-bold text-blue-500 uppercase">In Progress</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center">
            <CheckCircle2 className="w-4 h-4 text-[#28A745] mx-auto mb-1" />
            <p className="text-lg font-black text-[#28A745]">{labStatus.completed ?? 0}</p>
            <p className="text-[10px] font-bold text-emerald-600 uppercase">Completed</p>
          </div>
        </div>

        {labStatus.leaderboard && labStatus.leaderboard.length > 0 && (
          <div>
            <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-500" /> Top Performers
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              {labStatus.leaderboard.map((entry, idx) => (
                <div
                  key={entry.user_id}
                  className={`flex-1 flex items-center gap-2 p-2.5 rounded-xl border ${
                    idx === 0 ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                    : idx === 1 ? 'bg-slate-50 border-slate-200 dark:bg-slate-800/60 dark:border-slate-700'
                    : 'bg-orange-50/60 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs text-white flex-shrink-0 ${
                    idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : 'bg-orange-400'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{entry.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{entry.score} pts</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Roster */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
            Student Roster ({labStatus.students?.length ?? 0})
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold uppercase tracking-wider">
              <tr>
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3">Name</th>
                <th className="p-3">Progress</th>
                <th className="p-3">Time Taken</th>
                <th className="p-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(labStatus.students || []).map((s, idx) => (
                <tr key={s.user_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                  <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{s.name}</td>
                  <td className="p-3">
                    <span className={`font-bold ${
                      s.status === 'completed' ? 'text-[#28A745]' : s.status === 'in_progress' ? 'text-[#0052CC]' : 'text-slate-400'
                    }`}>
                      {s.modules_completed}/{s.total_modules}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{formatDuration(s.time_taken_seconds)}</td>
                  <td className="p-3 text-right">
                    <Link
                      to={`/admin/groups/${dbId}/students/${s.user_id}/report`}
                      className="px-2.5 py-1 rounded-lg bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-[11px] shadow-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      View Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
