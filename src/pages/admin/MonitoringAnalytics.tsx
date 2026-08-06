import React, { useState, useEffect } from 'react';
import { 
  Folder,
  User as UserIcon,
  Search,
  Filter,
  Download,
  BarChart2,
  ChevronRight,
  ArrowLeft,
  X
} from 'lucide-react';
import { downloadAuthenticatedFile } from '../../utils/exportUtils';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';

export const MonitoringAnalytics: React.FC = () => {
  const [analyticsTab, setAnalyticsTab] = useState<'group' | 'individual'>('group');
  
  // Navigation states
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  // Data states
  const [groups, setGroups] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [groupDetails, setGroupDetails] = useState<any>(null);
  const [labAnalytics, setLabAnalytics] = useState<any>(null);
  const [studentBreakdown, setStudentBreakdown] = useState<any>(null);

  // Search & Filter states for individual student listings
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const token = localStorage.getItem('token');
  const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

  // Fetch initial group list with active assignments and student lists
  const fetchInitialData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [gRes, sRes] = await Promise.all([
        fetch('/api/v1/reporting/analytics/groups', { headers }),
        fetch('/api/v1/reporting/analytics/students', { headers })
      ]);

      if (gRes.ok) {
        const groupsData = await gRes.json();
        setGroups(groupsData);
      }
      if (sRes.ok) {
        const studentsData = await sRes.json();
        setStudents(studentsData);
      }
    } catch (err) {
      setErrorMsg('Failed to load analytics catalogs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [analyticsTab]);

  // Fetch Group specific active lab details
  const loadGroupDetails = async (groupId: number) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/v1/reporting/analytics/groups/${groupId}`, { headers });
      if (res.ok) {
        setGroupDetails(await res.json());
        setSelectedGroupId(groupId);
      } else {
        setErrorMsg('No analytics available.');
      }
    } catch (err) {
      setErrorMsg('No analytics available.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch dynamic metrics for an assignment
  const loadLabAnalytics = async (assignmentId: number, labId: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/v1/admin/assignments/${assignmentId}/analytics`, { headers });
      if (res.ok) {
        setLabAnalytics(await res.json());
        setSelectedLabId(labId);
        setSelectedAssignmentId(assignmentId);
      } else {
        setErrorMsg('No analytics available.');
      }
    } catch (err) {
      setErrorMsg('No analytics available.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Student module breakdowns on a specific lab
  const loadStudentBreakdown = async (studentId: number, labId: string, assignmentId: number) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/v1/reporting/analytics/students/${studentId}/labs/${labId}`, { headers });
      if (res.ok) {
        setStudentBreakdown(await res.json());
        setSelectedStudentId(studentId);
        setSelectedAssignmentId(assignmentId);
        setSelectedLabId(labId);
      } else {
        setErrorMsg('No analytics available.');
      }
    } catch (err) {
      setErrorMsg('No analytics available.');
    } finally {
      setLoading(false);
    }
  };

  // CSV Group Export helper
  const handleGroupExportCSV = async () => {
    if (!selectedGroupId || !selectedLabId) return;
    try {
      await downloadAuthenticatedFile(
        `/api/v1/reporting/analytics/groups/${selectedGroupId}/labs/${selectedLabId}/export`,
        `group_${selectedGroupId}_lab_${selectedLabId}_analytics.csv`
      );
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Student PDF Generation helper
  const handleStudentExportPDF = async (studentId: number, labId: string) => {
    try {
      await downloadAuthenticatedFile(
        `/api/v1/reporting/analytics/students/${studentId}/labs/${labId}/pdf`,
        `student_${studentId}_lab_${labId}_analytics.pdf`
      );
    } catch (err: any) {
      alert(`PDF download failed: ${err.message}`);
    }
  };

  // Dynamic dropdown calculations
  const uniqueDepts = Array.from(new Set(students.map((s) => s.department).filter(Boolean)));
  const uniqueYears = Array.from(new Set(students.map((s) => s.year).filter(Boolean)));

  const filteredStudents = students.filter((s) => {
    const matchesSearch = 
      !searchQuery || 
      (s.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = !selectedDept || s.department === selectedDept;
    const matchesYear = !selectedYear || s.year === selectedYear;
    return matchesSearch && matchesDept && matchesYear;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-xs text-slate-800 dark:text-slate-200">
      
      {/* Navigation Breadcrumb bar if drilled down */}
      {(selectedGroupId || selectedStudentId || selectedLabId) && (
        <button
          onClick={() => {
            if (selectedStudentId) {
              setSelectedStudentId(null);
              setStudentBreakdown(null);
            } else if (selectedLabId) {
              setSelectedLabId(null);
              setSelectedAssignmentId(null);
              setLabAnalytics(null);
            } else {
              setSelectedGroupId(null);
              setGroupDetails(null);
            }
          }}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 font-extrabold cursor-pointer border px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-850 w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      )}

      {/* Main Tabs Navigation */}
      {!selectedGroupId && !selectedStudentId && !selectedLabId && (
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-xs">
          <button
            onClick={() => setAnalyticsTab('group')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              analyticsTab === 'group'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Group Analytics
          </button>
          <button
            onClick={() => setAnalyticsTab('individual')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              analyticsTab === 'individual'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Student Analytics
          </button>
        </div>
      )}

      {loading && <div className="py-12 text-center text-slate-400 font-medium">Loading analytics indexes...</div>}
      {errorMsg && <div className="py-12 text-center text-rose-500 font-bold">{errorMsg}</div>}

      {!loading && !errorMsg && (
        <>
          {/* GROUP ANALYTICS INITIAL VIEW */}
          {analyticsTab === 'group' && !selectedGroupId && !selectedStudentId && !selectedLabId && (
            <div className="space-y-4">
              <h2 className="text-sm font-extrabold text-slate-700 dark:text-slate-300">Active Group Analytics</h2>
              {groups.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-medium border border-dashed rounded-2xl">
                  No active group analytics available.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groups.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => loadGroupDetails(g.id)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer flex justify-between items-center"
                    >
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{g.name}</h4>
                        <p className="text-slate-500 font-semibold">{g.memberCount} Students • {g.activeLabsCount} Active Labs</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* GROUP DRILL DOWN DETAILS VIEW */}
          {selectedGroupId && !selectedLabId && groupDetails && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">{groupDetails.name}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Members</span>
                    <strong className="text-sm text-slate-800 dark:text-white">{groupDetails.member_count}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Assigned Labs</span>
                    <strong className="text-sm text-slate-800 dark:text-white">{groupDetails.assigned_labs_count}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Completion</span>
                    <strong className="text-sm text-emerald-600">{groupDetails.overall_completion}%</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Avg Score</span>
                    <strong className="text-sm text-blue-650 dark:text-blue-400">{groupDetails.average_score}%</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Avg Time</span>
                    <strong className="text-sm text-slate-800 dark:text-white">{groupDetails.average_time}</strong>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-extrabold text-sm text-slate-700 dark:text-slate-300">Assigned Labs</h3>
                <div className="space-y-3">
                  {groupDetails.labs.map((l: any) => (
                    <div
                      key={l.assignment_id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{l.lab_title}</h4>
                        <p className="text-slate-500 font-semibold">{l.status} • {l.student_count} Students</p>
                      </div>
                      <button
                        onClick={() => loadLabAnalytics(l.assignment_id, l.lab_id)}
                        className="px-4 py-2 bg-[#0052CC] hover:bg-blue-600 text-white font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                      >
                        <BarChart2 className="w-4 h-4" /> View Analytics
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* LAB ANALYTICS MEMBER DETAILS TABLE VIEW */}
          {selectedLabId && selectedAssignmentId && labAnalytics && !selectedStudentId && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-slate-100">{labAnalytics.lab_title}</h2>
                    <p className="text-slate-500 font-semibold mt-1">
                      Assigned: {labAnalytics.assignment_date} ➔ Due: {labAnalytics.due_date}
                    </p>
                  </div>
                  <button
                    onClick={handleGroupExportCSV}
                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" /> Export CSV
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Started</span>
                    <strong className="text-sm text-slate-800 dark:text-white">{labAnalytics.started_count}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Completed</span>
                    <strong className="text-sm text-emerald-600">{labAnalytics.completed_count}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Not Started</span>
                    <strong className="text-sm text-slate-500">{labAnalytics.not_started_count}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Failed</span>
                    <strong className="text-sm text-rose-500">{labAnalytics.failed_count}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Avg Score</span>
                    <strong className="text-sm text-slate-800 dark:text-white">{labAnalytics.average_score}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Completion %</span>
                    <strong className="text-sm text-emerald-600">{labAnalytics.completion_percentage}%</strong>
                  </div>
                </div>
              </div>

              {/* Members Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase">
                        <th className="p-4">Student Name</th>
                        <th className="p-4">Department</th>
                        <th className="p-4">Year</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Started Time</th>
                        <th className="p-4">Completed Time</th>
                        <th className="p-4">Time Taken</th>
                        <th className="p-4 text-center">Overall Score</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {labAnalytics.members?.map((m: any) => (
                        <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                          <td className="p-4 font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500">
                              {m.fullName?.charAt(0) || 'S'}
                            </div>
                            {m.fullName}
                          </td>
                          <td className="p-4 font-semibold text-slate-500">{m.department}</td>
                          <td className="p-4 font-semibold text-slate-500">{m.year}</td>
                          <td className="p-4">
                            <span className={`inline-block px-2 py-0.5 rounded-full font-bold border text-[9px] ${
                              m.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40' :
                              m.status === 'Running' ? 'bg-blue-50 text-[#0052CC] border-blue-200 dark:bg-blue-950/40' :
                              m.status === 'Failed' ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40' :
                              'bg-slate-50 text-slate-550 border-slate-200 dark:bg-slate-800'
                            }`}>
                              {m.status}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500">{m.started_time}</td>
                          <td className="p-4 text-slate-500">{m.completed_time}</td>
                          <td className="p-4 text-slate-500">{m.time_taken}</td>
                          <td className="p-4 text-center font-bold text-slate-900 dark:text-slate-100">{m.overall_score}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => loadStudentBreakdown(m.id, selectedLabId || 'lab-system-hardening', selectedAssignmentId)}
                              className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-bold rounded-lg cursor-pointer"
                            >
                              Analytics
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* INDIVIDUAL STUDENT ANALYTICS SELECTION TAB */}
          {analyticsTab === 'individual' && !selectedStudentId && !selectedLabId && (
            <div className="space-y-4">
              <h2 className="text-sm font-extrabold text-slate-700 dark:text-slate-300">Active Student Analytics</h2>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search students by name or email..."
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none w-full sm:max-w-xs text-xs"
                />
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-xs cursor-pointer"
                >
                  <option value="">All Departments</option>
                  {uniqueDepts.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-xs cursor-pointer"
                >
                  <option value="">All Years</option>
                  {uniqueYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {filteredStudents.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-medium border border-dashed rounded-2xl">
                  No active student analytics available.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStudents.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => loadStudentBreakdown(s.id, s.lab_id, s.active_assignment_id)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer flex justify-between items-center"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#0052CC] flex items-center justify-center font-bold">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{s.fullName}</h4>
                          <p className="text-slate-500 font-semibold">{s.department} • {s.year}</p>
                          <p className="text-[#0052CC] font-bold text-[9px] mt-1">{s.lab_id?.replace('-', ' ').title()}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STUDENT DETAILED LAB REPORT VIEW WITH MODULE BREAKDOWN & SPIDER CHART */}
          {selectedStudentId && studentBreakdown && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Metadata and Module breakdowns */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
                        {studentBreakdown.student?.fullName}
                      </h2>
                      <p className="text-slate-500 font-semibold mt-1">
                        {studentBreakdown.student?.department} • {studentBreakdown.student?.year}
                      </p>
                    </div>
                    <button
                      onClick={() => handleStudentExportPDF(selectedStudentId, selectedLabId || 'lab-system-hardening')}
                      className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Download className="w-4 h-4" /> Download PDF Report
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Overall Score</span>
                      <strong className="text-sm text-slate-800 dark:text-white">{studentBreakdown.overall_score}</strong>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Completion %</span>
                      <strong className="text-sm text-emerald-600">{studentBreakdown.completion_percentage}%</strong>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Time Taken</span>
                      <strong className="text-sm text-slate-800 dark:text-white">{studentBreakdown.total_time_taken}</strong>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-slate-700 dark:text-slate-300">Modules Performance Breakdown</h3>
                  <div className="space-y-3">
                    {studentBreakdown.modules?.map((m: any) => (
                      <div
                        key={m.module_id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{m.name}</h4>
                          <p className="text-slate-500 font-semibold">{m.attempts} • Time: {m.time_taken}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`inline-block px-2 py-0.5 rounded-full font-bold border text-[9px] ${
                            m.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40' :
                            m.status === 'RUNNING' ? 'bg-blue-50 text-[#0052CC] border-blue-200 dark:bg-blue-950/40' :
                            'bg-slate-50 text-slate-550 border-slate-200 dark:bg-slate-800'
                          }`}>
                            {m.status}
                          </span>
                          <strong className="text-sm text-slate-800 dark:text-white">{m.score} pts</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Visual Radar Spider Skill Analytics */}
              <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-100 dark:border-slate-800">
                    Skill Vectors Radar Matrix
                  </h3>
                  <div className="w-full h-64 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={studentBreakdown.spider_chart}>
                        <PolarGrid stroke="#E2E8F0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94A3B8', fontSize: 8, fontWeight: 700 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 8 }} />
                        <Radar name="Student" dataKey="score" stroke="#0052CC" fill="#3B82F6" fillOpacity={0.4} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 mt-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Instructor Review</span>
                  <p className="text-slate-650 leading-relaxed font-semibold">
                    The radar display outlines student proficiency based on cumulative validation checkouts computed dynamically across active modules.
                  </p>
                </div>
              </div>

            </div>
          )}
        </>
      )}

    </div>
  );
};
