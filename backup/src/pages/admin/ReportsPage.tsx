import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Download, FileText } from 'lucide-react';

interface LabAssignmentReport {
  group_id: number;
  group_name: string;
  lab_name: string;
  assigned_date: string;
  end_date: string;
  total_students: number;
  participated: number;
  total_modules: number;
  avg_score: number;
  status: string;
}

export const ReportsPage: React.FC = () => {
  const [reports, setReports] = useState<LabAssignmentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReports = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/admin/reports/lab-assignments', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setReports(data);
      }
    } catch (err) {
      console.error('Error fetching lab assignment reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleExport = (groupId: number, format: 'csv' | 'pdf') => {
    const token = localStorage.getItem('token');
    const url = `/api/v1/admin/groups/${groupId}/lab-report/export?format=${format}`;
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

  const filteredReports = reports.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    return !q || r.group_name.toLowerCase().includes(q) || r.lab_name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 text-xs text-slate-800 dark:text-slate-200">
      <div>
        <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">Lab Assignment Reports</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          The most recent lab assigned to each training group, with participation and downloadable reports.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by group or lab name..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 font-medium">Loading reports...</div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-400 font-extrabold uppercase text-[10px]">
                  <th className="p-4">Group Name</th>
                  <th className="p-4">Lab Name</th>
                  <th className="p-4 text-center">Assigned Date</th>
                  <th className="p-4 text-center">End Date</th>
                  <th className="p-4 text-center">Participated</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                      No lab assignment reports available yet.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((r) => (
                    <tr key={r.group_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="p-4 font-extrabold text-slate-900 dark:text-slate-100">{r.group_name}</td>
                      <td className="p-4 font-bold text-slate-700 dark:text-slate-200">{r.lab_name}</td>
                      <td className="p-4 text-center text-slate-500">{r.assigned_date}</td>
                      <td className="p-4 text-center text-slate-500">{r.end_date}</td>
                      <td className="p-4 text-center font-bold">{r.participated}/{r.total_students}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[9px] border ${
                          r.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : r.status === 'Running' ? 'bg-blue-50 text-blue-600 border-blue-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                        <Link
                          to={`/admin/reports/groups/${r.group_id}`}
                          className="px-2.5 py-1 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer inline-block"
                        >
                          View Detail
                        </Link>
                        <button
                          onClick={() => handleExport(r.group_id, 'csv')}
                          title="Download CSV"
                          className="px-2 py-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 inline" />
                        </button>
                        <button
                          onClick={() => handleExport(r.group_id, 'pdf')}
                          title="Download PDF"
                          className="px-2 py-1.5 rounded-lg text-slate-500 hover:text-[#0052CC] hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 inline" />
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
    </div>
  );
};
