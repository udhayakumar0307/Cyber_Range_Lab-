import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  User,
  ArrowLeft,
  Award,
  Clock,
  CheckCircle2,
  Trophy,
  FlaskConical,
  Calendar,
  Edit3,
  Trash2,
  Save,
  X,
  AlertTriangle,
  FileCheck,
  Activity,
  Zap,
  Flame,
  Star,
  TrendingUp,
  Crown,
  Shield,
  Medal
} from 'lucide-react';

const toXY = (angle: number, r: number, cx: number, cy: number) => ({
  x: cx + r * Math.sin(angle),
  y: cy - r * Math.cos(angle),
});

export const StudentDetailsPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '', email: '', rollNumber: '', department: '', year: '', phone: '', status: 'Active'
  });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [analytics, setAnalytics] = useState<any>(null);
  // Live stats from user statistics endpoint
  const [liveStats, setLiveStats] = useState<any>(null);
  const [activityGraph, setActivityGraph] = useState<any>(null);
  const [completedLabs, setCompletedLabs] = useState<any[]>([]);

  const fetchStudentDetails = async () => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const [userRes, analyticsRes, statsRes, graphRes, labsRes] = await Promise.all([
        fetch(`/api/v1/admin/users/${studentId}`, { headers }),
        fetch(`/api/v1/admin/users/${studentId}/analytics`, { headers }),
        fetch(`/api/v1/admin/users/${studentId}/statistics`, { headers }),
        fetch(`/api/v1/admin/users/${studentId}/activity-graph`, { headers }),
        fetch(`/api/v1/admin/users/${studentId}/completed-labs`, { headers }),
      ]);

      if (userRes.ok) {
        const data = await userRes.json();
        setStudent(data);
        // Prefill the edit form with the REAL stored value only. A field left
        // blank by the admin's import (or not yet filled in by the student)
        // must stay blank here — falling back to a plausible-looking fake
        // value would let an admin unknowingly save that fake value as if it
        // were the student's real data.
        setEditForm({
          fullName: data.fullName || data.name || '',
          email: data.email || '',
          rollNumber: data.rollNumber || '',
          department: data.department || '',
          year: data.year || '',
          phone: data.phone || '',
          status: data.status || 'Active'
        });
      }
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (statsRes.ok) setLiveStats(await statsRes.json());
      if (graphRes.ok) setActivityGraph(await graphRes.json());
      if (labsRes.ok) setCompletedLabs(await labsRes.json());
    } catch (err) {
      console.error('Error fetching student details & analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) fetchStudentDetails();

    // Re-fetch when the admin returns to this tab — the student may have
    // completed their own profile (roll number/department/year) in the
    // meantime, and this page must reflect that live data, not a stale copy.
    const onFocus = () => { if (studentId) fetchStudentDetails(); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && studentId) fetchStudentDetails();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [studentId]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    const token = localStorage.getItem('token');
    try {
      // The backend's UserUpdateRequest expects snake_case / its own field
      // names (name, roll_number, is_active) — editForm uses the UI's
      // camelCase keys, so it must be translated here, not sent as-is.
      // (Previously this sent `fullName`/`rollNumber`/`status` verbatim,
      // which Pydantic silently ignored as unknown fields — so Full Name,
      // Roll Number, Phone, and Status edits were never actually saved.)
      const res = await fetch(`/api/v1/admin/users/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          name: editForm.fullName,
          roll_number: editForm.rollNumber,
          department: editForm.department,
          year: editForm.year,
          phone: editForm.phone,
          is_active: editForm.status === 'Active',
        })
      });
      if (res.ok) { setIsEditing(false); fetchStudentDetails(); }
    } catch (err) {
      console.error('Failed to update student:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteStudent = async () => {
    setActionLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/admin/users/${studentId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) navigate('/admin/users');
    } catch (err) {
      console.error('Failed to delete student:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-[#0052CC] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-semibold">Loading student profile & analytics...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-sm font-bold text-slate-600">Student record not found.</p>
        <Link to="/admin/users" className="text-xs font-bold text-[#0052CC] hover:underline">Return to Student Roster</Link>
      </div>
    );
  }

  const name = student.fullName || student.name || 'Student';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  // Radar data — use live stats if available, fallback to analytics
  const radarLabels = activityGraph?.labels ?? ['Labs', 'Flags', 'Hours', 'Score', 'Active'];
  const radarValues: number[] = activityGraph?.values ?? [0, 0, 0, 0, 0];
  const radarRaw: Record<string, number> = activityGraph?.raw ?? {};
  const radarRawKeys = ['labs', 'flags', 'hours', 'score', 'active_days'];

  const totalScore = liveStats?.total_score ?? analytics?.score ?? student.score ?? 0;
  const globalRank = liveStats?.global_rank ?? '--';
  const trainingHours = liveStats?.training_hours ?? analytics?.training_hours ?? 0;
  const completedCount = liveStats?.labs_completed ?? analytics?.completedLabsCount ?? student.completedLabsCount ?? 0;
  const challengesSolved = liveStats?.challenges_solved ?? 0;
  const activeDays = liveStats?.current_streak_days ?? 0;
  const avgSession = liveStats?.avg_session_duration ?? analytics?.avg_session_duration ?? 0;

  // Radar chart render
  const RadarChart = () => {
    const size = 240; const cx = size / 2; const cy = size / 2; const R = 82;
    const n = radarLabels.length;
    const angles = radarLabels.map((_: any, i: number) => (2 * Math.PI * i) / n);
    const gridPts = [25, 50, 75, 100].map((lvl: number) =>
      angles.map((a: number) => { const p = toXY(a, (lvl / 100) * R, cx, cy); return `${p.x},${p.y}`; }).join(' ')
    );
    const dataPts = angles.map((a: number, i: number) => {
      const p = toXY(a, ((radarValues[i] || 0) / 100) * R, cx, cy); return `${p.x},${p.y}`;
    });
    return (
      <div className="flex flex-col items-center gap-4">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ overflow: 'visible' }}>
          {gridPts.map((pts: string, li: number) => (
            <polygon key={li} points={pts} fill="none" stroke="#E2E8F0" strokeWidth="0.8" strokeDasharray="3,3" />
          ))}
          {angles.map((a: number, i: number) => {
            const p = toXY(a, R, cx, cy);
            return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E2E8F0" strokeWidth="0.8" />;
          })}
          <polygon points={dataPts.join(' ')} fill="rgba(0,82,204,0.15)" stroke="#0052CC" strokeWidth="2" strokeLinejoin="round" />
          {angles.map((a: number, i: number) => {
            const p = toXY(a, ((radarValues[i] || 0) / 100) * R, cx, cy);
            return <circle key={i} cx={p.x} cy={p.y} r="4" fill="#0052CC" stroke="white" strokeWidth="2" />;
          })}
          {angles.map((a: number, i: number) => {
            const lp = toXY(a, R + 22, cx, cy);
            return (
              <g key={i}>
                <text x={lp.x} y={lp.y - 4} textAnchor="middle" style={{ fontSize: '8px', fontWeight: 700, fill: '#64748B' }}>{radarLabels[i]}</text>
                <text x={lp.x} y={lp.y + 7} textAnchor="middle" style={{ fontSize: '7.5px', fontWeight: 900, fill: '#0052CC' }}>{radarRaw[radarRawKeys[i]] ?? 0}</text>
              </g>
            );
          })}
        </svg>
        <div className="grid grid-cols-3 gap-2 w-full">
          {radarLabels.map((label: string, i: number) => (
            <div key={label} className="text-center p-1.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
              <p className="text-[8px] font-bold text-slate-400 uppercase">{label}</p>
              <p className="text-sm font-black text-[#0052CC]">{radarRaw[radarRawKeys[i]] ?? 0}</p>
              <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-[#0052CC] rounded-full" style={{ width: `${radarValues[i] || 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      {/* Breadcrumb + Actions */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/admin/users')} className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#0052CC] transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back to Student Management Roster
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsEditing(!isEditing)} className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs">
            <Edit3 className="w-3.5 h-3.5 text-[#0052CC]" /> Edit Profile
          </button>
          <button onClick={() => setIsDeleteModalOpen(true)} className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Profile Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 border-b pb-2">Edit Student Roster Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {[
                { label: 'Full Name', key: 'fullName', type: 'text', required: true },
                { label: 'Roll Number', key: 'rollNumber', type: 'text' },
                { label: 'Department', key: 'department', type: 'text' },
                { label: 'Year', key: 'year', type: 'text' },
                { label: 'Email Address (login — not editable here)', key: 'email', type: 'email', required: true, readOnly: true },
                { label: 'Phone Number', key: 'phone', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={(editForm as any)[f.key]}
                    onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                    className={`w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#0052CC] ${f.readOnly ? 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-800'}`}
                    required={f.required}
                    readOnly={f.readOnly}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 text-xs pt-2">
              <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Cancel</button>
              <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-[#0052CC] text-white font-bold rounded-lg hover:bg-blue-600 cursor-pointer disabled:opacity-60">
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-[#0052CC] text-white flex items-center justify-center font-black text-xl shadow-md">{initials}</div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{name}</h1>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#28A745] border border-emerald-200">{student.status || 'Active'}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{student.email}{student.phone ? ` • ${student.phone}` : ''}</p>
                {/* Fields the admin left blank at import (or the student hasn't
                    filled in yet) show as "Not provided" — never a fabricated
                    placeholder that could be mistaken for real student data. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-600 dark:text-slate-400 mt-2">
                  <span><strong>Roll:</strong> {student.rollNumber || <span className="italic text-slate-400 dark:text-slate-500 font-medium">Not provided</span>}</span>
                  <span>•</span>
                  <span><strong>Dept:</strong> {student.department || <span className="italic text-slate-400 dark:text-slate-500 font-medium">Not provided</span>}</span>
                  <span>•</span>
                  <span><strong>Year:</strong> {student.year || <span className="italic text-slate-400 dark:text-slate-500 font-medium">Not provided</span>}</span>
                  <span>•</span>
                  <span><strong>Cohort:</strong> {student.groupName || 'Unassigned'}</span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <p className="text-slate-500"><strong>Registered:</strong> {student.joinedDate || '--'}</p>
              <p className="text-slate-500"><strong>Last Active:</strong> {student.lastActive || '--'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Live Statistics KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Score', value: `${totalScore.toLocaleString()}`, sub: 'pts', color: 'text-[#0052CC]', bg: 'bg-blue-50', icon: <Trophy className="w-4 h-4" /> },
          { label: 'Global Rank', value: `#${globalRank}`, sub: 'platform', color: 'text-amber-500', bg: 'bg-amber-50', icon: <Zap className="w-4 h-4" /> },
          { label: 'Labs Done', value: `${completedCount}`, sub: 'labs', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <Award className="w-4 h-4" /> },
          { label: 'Training Hrs', value: `${trainingHours}`, sub: 'hours', color: 'text-indigo-600', bg: 'bg-indigo-50', icon: <Clock className="w-4 h-4" /> },
          { label: 'Challenges', value: `${challengesSolved}`, sub: 'flags', color: 'text-violet-600', bg: 'bg-violet-50', icon: <Shield className="w-4 h-4" /> },
          { label: 'Active Days', value: `${activeDays}`, sub: 'streak', color: 'text-orange-500', bg: 'bg-orange-50', icon: <Flame className="w-4 h-4" /> },
        ].map(m => (
          <div key={m.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs flex flex-col gap-1.5">
            <div className={`w-8 h-8 rounded-xl ${m.bg} ${m.color} flex items-center justify-center`}>{m.icon}</div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{m.label}</p>
            <p className={`text-base font-black ${m.color}`}>{m.value} <span className="text-[10px] font-semibold text-slate-400">{m.sub}</span></p>
          </div>
        ))}
      </div>

      {/* Radar + Domain Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Spiderweb Activity Radar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Activity className="w-5 h-5 text-[#0052CC]" /> Activity Radar
          </h3>
          <RadarChart />
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <p className="text-[9px] text-slate-400 font-bold uppercase">Avg Session</p>
              <p className="font-black text-[#0052CC]">{avgSession} min</p>
            </div>
            <div className="text-center p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <p className="text-[9px] text-slate-400 font-bold uppercase">Completion</p>
              <p className="font-black text-emerald-600">{liveStats?.completion_rate ?? analytics?.completionRate ?? 0}%</p>
            </div>
            <div className="text-center p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <p className="text-[9px] text-slate-400 font-bold uppercase">Badges</p>
              <p className="font-black text-amber-500">{liveStats?.badges_unlocked ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Lab Domain Progress */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <FlaskConical className="w-5 h-5 text-[#0052CC]" /> Lab Domain Progress
          </h3>
          <div className="space-y-3 text-xs">
            {(!analytics?.domainProgress || analytics.domainProgress.length === 0) ? (
              <p className="text-slate-400 font-medium py-4 text-center">No lab domain progress available yet.</p>
            ) : (
              analytics.domainProgress.map((dp: any, idx: number) => {
                const colors = ['bg-[#0052CC]', 'bg-[#28A745]', 'bg-[#6F42C1]', 'bg-[#FFA500]', 'bg-rose-500'];
                const tColors = ['text-[#0052CC]', 'text-[#28A745]', 'text-[#6F42C1]', 'text-[#FFA500]', 'text-rose-500'];
                return (
                  <div key={dp.domain}>
                    <div className="flex justify-between font-bold mb-1">
                      <span className="text-slate-800 dark:text-slate-200 truncate pr-2">{dp.domain}</span>
                      <span className={`${tColors[idx % tColors.length]} flex-shrink-0`}>{dp.completed_modules}/{dp.total_modules} ({dp.percentage}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${colors[idx % colors.length]} rounded-full`} style={{ width: `${dp.percentage}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Completed Labs + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Completed Labs List */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Trophy className="w-5 h-5 text-amber-500" /> Completed Labs
            {completedLabs.length > 0 && <span className="ml-auto bg-[#0052CC] text-white text-[9px] font-black rounded-full px-2 py-0.5">{completedLabs.length}</span>}
          </h3>
          {completedLabs.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <div className="text-3xl mb-2">🔬</div>
              <p className="text-xs font-semibold">No completed labs yet.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {completedLabs.map((lab: any, idx: number) => {
                const dc = lab.difficulty === 'EASY' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : lab.difficulty === 'MEDIUM' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-rose-600 bg-rose-50 border-rose-200';
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm flex-shrink-0">🧪</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{lab.name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {lab.difficulty && <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${dc}`}>{lab.difficulty}</span>}
                        <span className="text-[10px] text-slate-400">{lab.category}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-black text-[#0052CC]">+{lab.score ?? 0} pts</p>
                      <p className="text-[9px] text-slate-400">{lab.completed_at || '--'}</p>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Learning Activity Timeline */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Clock className="w-5 h-5 text-[#28A745]" /> Recent Learning Activity
          </h3>
          <div className="space-y-2.5 text-xs max-h-64 overflow-y-auto pr-1">
            {(!analytics?.recentActivity || analytics.recentActivity.length === 0) ? (
              <div className="py-8 text-center text-slate-400 font-medium">No learning activity available yet.</div>
            ) : (
              analytics.recentActivity.map((act: any, idx: number) => (
                <div key={`act-${idx}`} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{act.labName} — {act.moduleName}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">Score: {act.score} • {act.timeTaken} • {act.timestamp}</p>
                  </div>
                  <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] flex-shrink-0 ${act.status === 'Completed' ? 'bg-emerald-50 text-[#28A745] border border-emerald-200' : 'bg-blue-50 text-[#0052CC] border border-blue-200'}`}>
                    {act.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 p-6 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Delete Student Account?</h3>
              <p className="text-xs text-slate-500 mt-1">Are you sure you want to permanently delete <span className="font-bold text-slate-800">{name}</span>? This will remove all group memberships, lab assignments, and analytics records.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => setIsDeleteModalOpen(false)} className="py-2 px-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer">Cancel</button>
              <button onClick={handleDeleteStudent} disabled={actionLoading} className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer">
                {actionLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
