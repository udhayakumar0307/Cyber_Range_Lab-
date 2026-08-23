import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDeptShortCode } from '../../utils/deptMapping';
import {
  ArrowLeft,
  User,
  Clock,
  Target,
  Repeat,
  Award,
  Activity,
} from 'lucide-react';

interface ModuleBreakdown {
  module_id: string;
  title: string;
  track: string;
  max_points: number;
  score: number;
  attempts: number;
  time_taken_seconds: number;
  status: string;
  flag_correct: boolean;
}

interface StudentReport {
  student: {
    id: number;
    name: string;
    email: string;
    department: string;
    year: string;
    roll_number: string;
  };
  lab_name: string;
  assignment_id: number;
  total_modules: number;
  modules_completed: number;
  total_score: number;
  total_time_seconds: number;
  total_attempts: number;
  modules: ModuleBreakdown[];
  radar_labels: string[];
  radar_values: number[];
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds) return '0m';
  const mins = Math.floor(totalSeconds / 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  const secs = totalSeconds % 60;
  if (hrs > 0) return `${hrs}h ${remMins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

const RadarChart: React.FC<{ labels: string[]; values: number[] }> = ({ labels, values }) => {
  const R = 80;
  const cx = 130;
  const cy = 110;
  const n = Math.max(labels.length, 3);
  const angles = labels.map((_, i) => (2 * Math.PI * i) / n);

  const toXY = (angle: number, r: number) => ({
    x: cx + r * Math.sin(angle),
    y: cy - r * Math.cos(angle),
  });

  const rings = [20, 40, 60, 80, 100];
  const ringPaths = rings.map((pct) =>
    angles.map((a) => {
      const pt = toXY(a, (pct / 100) * R);
      return `${pt.x},${pt.y}`;
    }).join(' ')
  );

  const valPoints = angles.map((a, i) => {
    const v = values[i] ?? 0;
    const pt = toXY(a, (v / 100) * R);
    return `${pt.x},${pt.y}`;
  }).join(' ');

  return (
    <svg className="w-full h-[260px] max-w-[300px] mx-auto overflow-visible">
      {ringPaths.map((pts, idx) => (
        <polygon key={idx} points={pts} fill="none" stroke="#E2E8F0" strokeWidth="1" className="dark:stroke-slate-800" />
      ))}
      {angles.map((a, i) => {
        const pt = toXY(a, R);
        return <line key={i} x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke="#E2E8F0" strokeWidth="1" className="dark:stroke-slate-800" />;
      })}
      <polygon points={valPoints} fill="rgba(0, 82, 204, 0.15)" stroke="#0052CC" strokeWidth="2.5" />
      {angles.map((a, i) => {
        const v = values[i] ?? 0;
        const pt = toXY(a, (v / 100) * R);
        return <circle key={i} cx={pt.x} cy={pt.y} r="4" fill="#0052CC" stroke="white" strokeWidth="1.5" className="dark:stroke-slate-900" />;
      })}
      {angles.map((a, i) => {
        const lp = toXY(a, R + 20);
        const align = Math.abs(a) < 0.1 || Math.abs(a - Math.PI) < 0.1 ? 'middle' : (a < Math.PI ? 'start' : 'end');
        return (
          <g key={i}>
            <text x={lp.x} y={lp.y} textAnchor={align} className="text-[9px] font-extrabold fill-slate-500 dark:fill-slate-400">
              {labels[i]}
            </text>
            <text x={lp.x} y={lp.y + 10} textAnchor={align} className="text-[8px] font-black fill-[#0052CC]">
              {values[i]}%
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export const StudentLabReportPage: React.FC = () => {
  const { groupId, userId } = useParams<{ groupId: string; userId: string }>();
  const [report, setReport] = useState<StudentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      const dbGroupId = (groupId || '').replace('grp-', '');
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(`/api/v1/admin/groups/${dbGroupId}/students/${userId}/report`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          setReport(await res.json());
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.detail || 'Failed to load report.');
        }
      } catch (err) {
        console.error('Error fetching student report:', err);
        setError('An error occurred while loading the report.');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [groupId, userId]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading report...</div>;
  }

  if (error || !report) {
    return (
      <div className="p-10 text-center">
        <p className="text-slate-500 text-sm">{error || 'Report not found.'}</p>
        <Link to={`/admin/groups/${groupId}`} className="mt-3 text-[#0052CC] font-bold text-xs hover:underline inline-block">
          Back to Group
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link
        to={`/admin/groups/${groupId}`}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Group
      </Link>

      {/* Student Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#0052CC] text-white flex items-center justify-center font-black text-lg flex-shrink-0">
          {report.student.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </div>
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">{report.student.name}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {getDeptShortCode(report.student.department)} &middot; {report.student.year} &middot; {report.student.roll_number} &middot; {report.student.email}
          </p>
          <p className="text-xs text-[#0052CC] dark:text-blue-400 font-bold mt-1">{report.lab_name}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Modules</span>
            <span className="text-xl font-black text-slate-800 dark:text-slate-100">{report.modules_completed}/{report.total_modules}</span>
          </div>
          <Target className="w-7 h-7 text-slate-300" />
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Score</span>
            <span className="text-xl font-black text-[#0052CC]">{report.total_score}</span>
          </div>
          <Award className="w-7 h-7 text-blue-200" />
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Time Taken</span>
            <span className="text-xl font-black text-slate-800 dark:text-slate-100">{formatDuration(report.total_time_seconds)}</span>
          </div>
          <Clock className="w-7 h-7 text-slate-300" />
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Attempts</span>
            <span className="text-xl font-black text-slate-800 dark:text-slate-100">{report.total_attempts}</span>
          </div>
          <Repeat className="w-7 h-7 text-slate-300" />
        </div>
      </div>

      {/* Radar + Module breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center shadow-xs">
          <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5 self-start">
            <Activity className="w-4 h-4 text-[#0052CC]" /> Skill Area Breakdown
          </h3>
          <RadarChart labels={report.radar_labels} values={report.radar_values} />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
            <User className="w-4 h-4 text-[#0052CC]" /> Per-Module Detail
          </h3>
          <div className="overflow-y-auto max-h-[300px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide sticky top-0">
                <tr>
                  <th className="p-2.5">Module</th>
                  <th className="p-2.5">Score</th>
                  <th className="p-2.5">Attempts</th>
                  <th className="p-2.5">Time</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.modules.map((m) => (
                  <tr key={m.module_id}>
                    <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-100">{m.title}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300">{m.score}/{m.max_points}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300">{m.attempts}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300">{formatDuration(m.time_taken_seconds)}</td>
                    <td className="p-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        m.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : m.status === 'STARTED' ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {m.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
