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
  FileCheck
} from 'lucide-react';

export const StudentDetailsPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    rollNumber: '',
    department: '',
    year: '',
    phone: '',
    status: 'Active'
  });

  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [analytics, setAnalytics] = useState<any>(null);

  const fetchStudentDetails = async () => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const [userRes, analyticsRes] = await Promise.all([
        fetch(`/api/v1/admin/users/${studentId}`, { headers }),
        fetch(`/api/v1/admin/users/${studentId}/analytics`, { headers })
      ]);

      if (userRes.ok) {
        const data = await userRes.json();
        setStudent(data);
        setEditForm({
          fullName: data.fullName || data.name || '',
          email: data.email || '',
          rollNumber: data.rollNumber || '22BCS104',
          department: data.department || 'Cyber Security',
          year: data.year || 'III Year',
          phone: data.phone || '+91 98765 43210',
          status: data.status || 'Active'
        });
      }

      if (analyticsRes.ok) {
        const aData = await analyticsRes.json();
        setAnalytics(aData);
      }
    } catch (err) {
      console.error('Error fetching student details & analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) fetchStudentDetails();
  }, [studentId]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/v1/admin/users/${studentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(editForm)
      });

      if (res.ok) {
        setIsEditing(false);
        fetchStudentDetails();
      }
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

      if (res.ok) {
        navigate('/admin/users');
      }
    } catch (err) {
      console.error('Failed to delete student:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs font-bold text-slate-400">
        Loading student profile & learning analytics...
      </div>
    );
  }

  if (!student) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-sm font-bold text-slate-600">Student record not found.</p>
        <Link to="/admin/users" className="text-xs font-bold text-[#0052CC] hover:underline">
          Return to Student Roster
        </Link>
      </div>
    );
  }

  const name = student.fullName || student.name || 'Student';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/users')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#0052CC] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Student Management Roster
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#0052CC]" /> Edit Student Profile
          </button>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Student
          </button>
        </div>
      </div>

      {/* Section 1: Student Profile Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 border-b pb-2">Edit Student Roster Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Roll Number</label>
                <input
                  type="text"
                  value={editForm.rollNumber}
                  onChange={(e) => setEditForm({ ...editForm, rollNumber: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Department</label>
                <input
                  type="text"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Year</label>
                <input
                  type="text"
                  value={editForm.year}
                  onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Email Address</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 font-bold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 bg-[#0052CC] text-white font-bold rounded-lg hover:bg-blue-600 cursor-pointer"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-[#0052CC] text-white flex items-center justify-center font-black text-xl shadow-md">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{name}</h1>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#28A745] border border-emerald-200">
                    {student.status || 'Active'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{student.email} • {student.phone || '+91 98765 43210'}</p>
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400 mt-2">
                  <span><strong>Roll No:</strong> {student.rollNumber || '22BCS104'}</span>
                  <span>•</span>
                  <span><strong>Dept:</strong> {student.department || 'Cyber Security'}</span>
                  <span>•</span>
                  <span><strong>Year:</strong> {student.year || 'III Year'}</span>
                  <span>•</span>
                  <span><strong>Cohort:</strong> {student.groupName || 'Unassigned'}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <p className="text-slate-500"><strong>Registered:</strong> {student.joinedDate || '2026-01-15'}</p>
              <p className="text-slate-500"><strong>Last Active:</strong> {student.lastActive || 'Today 10:30 AM'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Section 2 & 3: Performance Summary & Current Assigned Labs */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-400">Overall Score</span>
          <div className="text-2xl font-black text-[#0052CC] mt-1">{(student.score || 850).toLocaleString()} pts</div>
          <p className="text-[11px] text-slate-500 mt-1">Rank #4 in Cohort</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-400">Completed Labs</span>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{student.completedLabsCount || 8} Modules</div>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">78.5% Completion Rate</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-400">Total Time Spent</span>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">18h 45m</div>
          <p className="text-[11px] text-slate-500 mt-1">Across 12 lab sessions</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-400">Certificates Earned</span>
          <div className="text-2xl font-black text-purple-600 mt-1">3 Verifiable</div>
          <p className="text-[11px] text-slate-500 mt-1">Network & Web Defense</p>
        </div>
      </div>

      {/* Section 4 & 5: CyberRange Lab Domain Progress & Recent Learning Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 4: CyberRange Lab Domain Progress (Calculated from DB) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <FlaskConical className="w-5 h-5 text-[#0052CC]" />
            CyberRange Lab Domain Progress
          </h3>

          <div className="space-y-3 text-xs">
            {(!analytics?.domainProgress || analytics.domainProgress.length === 0) ? (
              <p className="text-slate-400 font-medium py-4 text-center">No lab domain progress available yet.</p>
            ) : (
              analytics.domainProgress.map((dp: any, idx: number) => {
                const colors = ['bg-[#0052CC]', 'bg-[#28A745]', 'bg-[#6F42C1]', 'bg-[#FFA500]'];
                const textColors = ['text-[#0052CC]', 'text-[#28A745]', 'text-[#6F42C1]', 'text-[#FFA500]'];
                const color = colors[idx % colors.length];
                const textColor = textColors[idx % textColors.length];

                return (
                  <div key={dp.domain}>
                    <div className="flex justify-between font-bold mb-1">
                      <span className="text-slate-800 dark:text-slate-200">{dp.domain}</span>
                      <span className={textColor}>
                        {dp.completed_modules} / {dp.total_modules} modules ({dp.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full`} style={{ width: `${dp.percentage}%` }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Section 5: Recent Learning Activity Timeline (PostgreSQL DB) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Clock className="w-5 h-5 text-[#28A745]" />
            Recent Learning Activity
          </h3>

          <div className="space-y-3 text-xs">
            {(!analytics?.recentActivity || analytics.recentActivity.length === 0) ? (
              <div className="py-8 text-center text-slate-400 font-medium">
                No learning activity available yet.
              </div>
            ) : (
              analytics.recentActivity.map((act: any, idx: number) => (
                <div
                  key={`act-${idx}`}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{act.labName} — {act.moduleName}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Score: {act.score} • {act.timeTaken} • {act.timestamp}
                    </p>
                  </div>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                      act.status === 'Completed'
                        ? 'bg-emerald-50 text-[#28A745] border border-emerald-200'
                        : 'bg-blue-50 text-[#0052CC] border border-blue-200'
                    }`}
                  >
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
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently delete <span className="font-bold text-slate-800">{name}</span>? This will remove all group memberships, lab assignments, and analytics records.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="py-2 px-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteStudent}
                disabled={actionLoading}
                className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
