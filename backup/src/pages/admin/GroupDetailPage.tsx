import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { GroupDetail } from '../../types/admin';
import { getDeptShortCode } from '../../utils/deptMapping';
import { AssignLabModal } from '../../components/admin/AssignLabModal';
import {
  ArrowLeft,
  UsersRound,
  ChevronDown,
  ChevronUp,
  Rocket,
  Bell,
  Trophy,
  Hourglass,
  CircleDot,
  CheckCircle2,
  Download,
  FileText,
  Info,
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
  assignment_id?: number;
  lab_name?: string;
  start_datetime?: string;
  end_datetime?: string;
  status?: string;
  seconds_until_start?: number;
  total_students?: number;
  total_modules?: number;
  not_started?: number;
  in_progress?: number;
  completed?: number;
  leaderboard?: { user_id: number; name: string; score: number }[];
  students?: StudentLabStat[];
}

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return 'Live now';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds) return '0m';
  const mins = Math.floor(totalSeconds / 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`;
}

export const GroupDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [membersOpen, setMembersOpen] = useState(true);
  const [assignLabOpen, setAssignLabOpen] = useState(false);
  const [labStatus, setLabStatus] = useState<LabStatus | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [killConfirmOpen, setKillConfirmOpen] = useState(false);
  const [killing, setKilling] = useState(false);
  const tickRef = useRef<number | null>(null);

  const dbId = (groupId || '').replace('grp-', '');

  const fetchGroup = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/admin/groups/${dbId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) setGroup(await res.json());
    } catch (err) {
      console.error('Error fetching group detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLabStatus = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/admin/groups/${dbId}/lab-status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setLabStatus(data);
        if (data.assigned) setCountdown(data.seconds_until_start);
      }
    } catch (err) {
      console.error('Error fetching lab status:', err);
    }
  };

  useEffect(() => {
    fetchGroup();
    fetchLabStatus();
  }, [groupId]);

  // Live countdown ticker
  useEffect(() => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [labStatus?.assignment_id]);

  // Periodically refresh real progress/leaderboard data from the server
  useEffect(() => {
    const poll = window.setInterval(fetchLabStatus, 20000);
    return () => window.clearInterval(poll);
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

  const handleKillLab = async () => {
    setKilling(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/admin/groups/${dbId}/kill-lab`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.detail || 'Failed to end the lab.');
      } else {
        await fetchLabStatus();
      }
    } catch (err) {
      console.error('Error ending lab:', err);
      alert('Failed to end the lab.');
    } finally {
      setKilling(false);
      setKillConfirmOpen(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading group...</div>;
  }

  if (!group) {
    return (
      <div className="p-10 text-center">
        <p className="text-slate-500 text-sm">Group not found.</p>
        <Link to="/admin/users" className="mt-3 text-[#0052CC] font-bold text-xs hover:underline inline-block">
          Back to Student Management
        </Link>
      </div>
    );
  }

  const now = Date.now();
  const endTime = labStatus?.end_datetime ? new Date(labStatus.end_datetime).getTime() : null;
  const isLabFinished = !!(
    endTime && (now > endTime || (labStatus?.total_students && labStatus.completed === labStatus.total_students))
  );
  // The completed lab's summary disappears 1 hour after it ended, per policy.
  const isPastVisibilityWindow = !!(endTime && now > endTime + 1 * 60 * 60 * 1000);
  const showLabPanel = labStatus?.assigned && !isPastVisibilityWindow;

  return (
    <div className="space-y-6">
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Student Management
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-[#0052CC] dark:text-blue-400 flex items-center justify-center">
            <UsersRound className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">{group.name}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {group.members.length} / {group.maxSize} students &middot; Created {group.createdDate}
            </p>
          </div>
        </div>

        <button
          onClick={() => setAssignLabOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-2 self-start sm:self-center cursor-pointer"
        >
          <Rocket className="w-4 h-4" /> Assign Lab
        </button>
      </div>

      {/* Active / Recent Lab Status */}
      {showLabPanel && isLabFinished && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <Info className="w-4 h-4" /> Lab completed. This summary will disappear 1 hour after the lab ended, and you can also start a new lab for this group at any time.
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-bold text-xs inline-flex items-center gap-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {showLabPanel && !isLabFinished && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">{labStatus.lab_name}</h2>
                <span title="Notification sent to all verified students" className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  <Bell className="w-3 h-3" /> Notified
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Scheduled start: {labStatus.start_datetime ? new Date(labStatus.start_datetime).toLocaleString() : '-'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2">
                <Hourglass className="w-4 h-4 text-[#0052CC] dark:text-blue-400" />
                <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                  {formatCountdown(countdown)}
                </span>
              </div>
              <button
                onClick={() => setKillConfirmOpen(true)}
                className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer"
              >
                Kill Lab
              </button>
            </div>
          </div>

          {/* Progress counts */}
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

          {/* Leaderboard */}
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
      )}

      {/* Student Roster */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <button
          onClick={() => setMembersOpen((o) => !o)}
          className="w-full flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 cursor-pointer"
        >
          <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
            Student Roster ({group.members.length})
          </span>
          {membersOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {membersOpen && (
          <div className="overflow-x-auto">
            {showLabPanel && labStatus?.students ? (
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
                  {labStatus.students.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">No students in this group yet.</td>
                    </tr>
                  ) : (
                    labStatus.students.map((s, idx) => (
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
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold uppercase tracking-wider">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">Full Name</th>
                    <th className="p-3">Dept</th>
                    <th className="p-3">Year</th>
                    <th className="p-3">Roll No.</th>
                    <th className="p-3">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {group.members.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">No students in this group yet.</td>
                    </tr>
                  ) : (
                    group.members.map((m, idx) => (
                      <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{m.fullName}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{getDeptShortCode(m.department)}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{m.year || '-'}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{m.rollNumber || '-'}</td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">{m.email}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {!labStatus?.assigned && (
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center text-xs text-slate-400">
          No lab assigned yet. Click "Assign Lab" above to schedule one for this group.
        </div>
      )}

      <AssignLabModal
        isOpen={assignLabOpen}
        onClose={() => setAssignLabOpen(false)}
        groupId={Number(dbId)}
        groupName={group.name}
        memberCount={group.members.length}
        onAssigned={() => {
          fetchLabStatus();
        }}
      />

      {killConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-4">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Kill this lab?</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This immediately ends "{labStatus?.lab_name}" for <strong>{group.name}</strong>. Students will no longer be able to access it, and the lab will be marked completed. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setKillConfirmOpen(false)}
                disabled={killing}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleKillLab}
                disabled={killing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                {killing ? 'Ending...' : 'Yes, Kill Lab'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
