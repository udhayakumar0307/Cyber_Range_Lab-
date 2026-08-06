import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Search, 
  Filter, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Award,
  ChevronLeft,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { downloadAuthenticatedFile } from '../../utils/exportUtils';

export const ReportsPage: React.FC = () => {
  const [reportsTab, setReportsTab] = useState<'group' | 'individual'>('group');
  
  // Drill-down states
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);

  // Data states
  const [groupReports, setGroupReports] = useState<any[]>([]);
  const [individualReports, setIndividualReports] = useState<any[]>([]);
  const [viewReportData, setViewReportData] = useState<any>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedLab, setSelectedLab] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dropdown list options fetched dynamically or fallback standard
  const [departmentList, setDepartmentList] = useState<string[]>([]);
  const yearList = ['I Year', 'II Year', 'III Year', 'IV Year'];

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const token = localStorage.getItem('token');
  const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

  // Fetch distinct departments from backend database users
  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/v1/reporting/analytics/students', { headers });
      if (res.ok) {
        const data = await res.json();
        const depts = Array.from(new Set(data.map((s: any) => s.department).filter(Boolean))) as string[];
        setDepartmentList(depts.length > 0 ? depts : ['Cyber Security', 'Computer Science', 'Information Technology']);
      } else {
        setDepartmentList(['Cyber Security', 'Computer Science', 'Information Technology']);
      }
    } catch {
      setDepartmentList(['Cyber Security', 'Computer Science', 'Information Technology']);
    }
  };

  // Fetch reports from backend using search & filters parameters
  const fetchReports = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const queryParams = new URLSearchParams({
        tab: reportsTab,
        search: searchQuery,
        department: selectedDept,
        year: selectedYear,
        lab: selectedLab,
        start_date: startDate,
        end_date: endDate
      });

      const res = await fetch(`/api/v1/reporting/reports?${queryParams.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (reportsTab === 'group') {
          setGroupReports(data);
        } else {
          setIndividualReports(data);
        }
      } else {
        setGroupReports([]);
        setIndividualReports([]);
      }
    } catch (err) {
      setErrorMsg('Failed to load historical reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [reportsTab, searchQuery, selectedDept, selectedYear, selectedLab, startDate, endDate]);

  const loadViewReportDetails = async (assignmentId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/reporting/reports/${assignmentId}`, { headers });
      if (res.ok) {
        setViewReportData(await res.json());
        setSelectedAssignmentId(assignmentId);
      }
    } catch (err) {
      console.error('Error fetching report details:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleDownloadGroupReport = async (assignmentId: number, format: 'pdf' | 'csv') => {
    try {
      await downloadAuthenticatedFile(
        `/api/v1/reporting/reports/group/${assignmentId}/export?format=${format}`,
        `group_report_${assignmentId}.${format}`
      );
      showToast(`Successfully downloaded group report in ${format.toUpperCase()} format.`);
    } catch (err: any) {
      showToast(`Export download failed: ${err.message}`);
    }
  };

  const handleDownloadIndividualReport = async (studentId: number, assignmentId: number, format: 'pdf' | 'csv') => {
    try {
      await downloadAuthenticatedFile(
        `/api/v1/reporting/reports/student/${studentId}/${assignmentId}/export?format=${format}`,
        `student_report_${studentId}_${assignmentId}.${format}`
      );
      showToast(`Successfully downloaded student report in ${format.toUpperCase()} format.`);
    } catch (err: any) {
      showToast(`Export download failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-xs text-slate-800 dark:text-slate-200">
      
      {/* Drill-down Go Back bar */}
      {selectedAssignmentId && (
        <button
          onClick={() => {
            setSelectedAssignmentId(null);
            setViewReportData(null);
          }}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 font-extrabold cursor-pointer border px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-850 w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back to Reports Archive
        </button>
      )}

      {/* Tab Navigation */}
      {!selectedAssignmentId && (
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-xs">
          <button
            onClick={() => {
              setReportsTab('group');
              setSearchQuery('');
              setSelectedDept('');
              setSelectedYear('');
              setSelectedLab('');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              reportsTab === 'group'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Group Reports
          </button>
          <button
            onClick={() => {
              setReportsTab('individual');
              setSearchQuery('');
              setSelectedDept('');
              setSelectedYear('');
              setSelectedLab('');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              reportsTab === 'individual'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Individual Reports
          </button>
        </div>
      )}

      {/* Search & Backend Filter Bar */}
      {!selectedAssignmentId && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports by student, group, lab or department..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none cursor-pointer"
          >
            <option value="">All Departments</option>
            {departmentList.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none cursor-pointer"
          >
            <option value="">All Years</option>
            {yearList.map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>

          <input
            type="text"
            value={selectedLab}
            onChange={(e) => setSelectedLab(e.target.value)}
            placeholder="Lab ID (e.g. lab-hardening)"
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
          />

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold uppercase text-[9px]">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
            <span className="text-slate-400 font-bold uppercase text-[9px]">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>
        </div>
      )}

      {loading && <div className="py-12 text-center text-slate-400 font-medium">Loading reports...</div>}

      {!loading && !selectedAssignmentId && (
        <>
          {/* GROUP REPORTS TAB LISTING */}
          {reportsTab === 'group' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-400 font-extrabold uppercase text-[10px]">
                      <th className="p-4">Group Name</th>
                      <th className="p-4">Lab Name</th>
                      <th className="p-4 text-center">Assigned Date</th>
                      <th className="p-4 text-center">End Date</th>
                      <th className="p-4 text-center">Student Count</th>
                      <th className="p-4 text-center">Completion %</th>
                      <th className="p-4 text-center">Average Score</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                    {groupReports.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                          No historical reports available.
                        </td>
                      </tr>
                    ) : (
                      groupReports.map((r) => (
                        <tr key={r.assignment_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                          <td className="p-4 font-extrabold text-slate-900 dark:text-slate-100">{r.group_name}</td>
                          <td className="p-4 font-bold text-slate-850 dark:text-slate-200">{r.lab_title}</td>
                          <td className="p-4 text-center text-slate-500">{r.assigned_date}</td>
                          <td className="p-4 text-center text-slate-500">{r.end_date}</td>
                          <td className="p-4 text-center text-slate-500 font-bold">{r.student_count}</td>
                          <td className="p-4 text-center text-emerald-600 font-bold">{r.completion_pct}%</td>
                          <td className="p-4 text-center text-blue-650 dark:text-blue-400 font-bold">{r.avg_score}</td>
                          <td className="p-4 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 font-bold text-[9px]">
                              {r.status}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => loadViewReportDetails(r.assignment_id)}
                              className="px-2.5 py-1 border rounded-lg hover:bg-slate-100 font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              View Report
                            </button>
                            <button
                              onClick={() => handleDownloadGroupReport(r.assignment_id, 'pdf')}
                              className="px-2.5 py-1 bg-blue-50 text-[#0052CC] hover:bg-blue-100 font-bold rounded-lg cursor-pointer"
                            >
                              PDF
                            </button>
                            <button
                              onClick={() => handleDownloadGroupReport(r.assignment_id, 'csv')}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-650 hover:bg-emerald-100 font-bold rounded-lg cursor-pointer"
                            >
                              CSV
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* INDIVIDUAL REPORTS TAB LISTING */}
          {reportsTab === 'individual' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-400 font-extrabold uppercase text-[10px]">
                      <th className="p-4">Student Name</th>
                      <th className="p-4">Department</th>
                      <th className="p-4">Year</th>
                      <th className="p-4">Lab</th>
                      <th className="p-4 text-center">Final Score</th>
                      <th className="p-4 text-center">Completion Time</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                    {individualReports.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                          No historical reports available.
                        </td>
                      </tr>
                    ) : (
                      individualReports.map((r) => (
                        <tr key={`${r.student_id}-${r.assignment_id}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                          <td className="p-4 font-extrabold text-slate-900 dark:text-slate-100">{r.student_name}</td>
                          <td className="p-4 font-semibold text-slate-500">{r.department}</td>
                          <td className="p-4 font-semibold text-slate-500">{r.year}</td>
                          <td className="p-4 font-bold text-slate-850 dark:text-slate-200">{r.lab_title}</td>
                          <td className="p-4 text-center font-bold text-slate-800 dark:text-white">{r.final_score}</td>
                          <td className="p-4 text-center text-slate-500">{r.completion_time}</td>
                          <td className="p-4 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[9px] border">
                              {r.status}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleDownloadIndividualReport(r.student_id, r.assignment_id, 'pdf')}
                              className="px-2.5 py-1 bg-blue-50 text-[#0052CC] hover:bg-blue-100 font-bold rounded-lg cursor-pointer"
                            >
                              Transcript PDF
                            </button>
                            <button
                              onClick={() => handleDownloadIndividualReport(r.student_id, r.assignment_id, 'csv')}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-650 hover:bg-emerald-100 font-bold rounded-lg cursor-pointer"
                            >
                              CSV
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* VIEW HISTORICAL REPORT DETAILS PANEL */}
      {selectedAssignmentId && viewReportData && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="border-b pb-4 border-slate-100 dark:border-slate-800 flex justify-between items-start">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
                Gradebook Report: {viewReportData.lab_title}
              </h2>
              <p className="text-slate-500 font-semibold mt-1">
                Instructor: {viewReportData.instructor || 'Admin'} • Generated Time: {viewReportData.generated_time}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDownloadGroupReport(selectedAssignmentId, 'pdf')}
                className="px-3 py-1.5 bg-blue-50 text-[#0052CC] hover:bg-blue-100 font-bold rounded-xl flex items-center gap-1 cursor-pointer"
              >
                Download PDF
              </button>
              <button
                onClick={() => handleDownloadGroupReport(selectedAssignmentId, 'csv')}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-650 hover:bg-emerald-100 font-bold rounded-xl flex items-center gap-1 cursor-pointer"
              >
                Download CSV
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-slate-700 dark:text-slate-300">Student Grade Transcript</h3>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b text-[10px] font-bold text-slate-400 uppercase">
                    <th className="p-3">Student Name</th>
                    <th className="p-3 text-center">Module Scores</th>
                    <th className="p-3 text-center">Final Score</th>
                    <th className="p-3 text-center">Completion Time</th>
                    <th className="p-3 text-center">Attempts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {viewReportData.students?.map((s: any) => (
                    <tr key={s.id}>
                      <td className="p-3 font-bold text-slate-850 dark:text-slate-100">{s.fullName}</td>
                      <td className="p-3 text-center text-slate-500">{s.module_scores}</td>
                      <td className="p-3 text-center font-bold text-slate-900 dark:text-white">{s.final_score}</td>
                      <td className="p-3 text-center text-slate-500">{s.completion_time}</td>
                      <td className="p-3 text-center text-slate-500">{s.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-slate-900 dark:bg-slate-800 text-white border border-slate-700 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-5 z-50">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          {toastMsg}
        </div>
      )}

    </div>
  );
};
