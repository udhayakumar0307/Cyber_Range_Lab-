import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context';
import { 
  Settings, 
  User, 
  Lock, 
  MessageSquare, 
  History, 
  Info, 
  LogOut,
  Save, 
  CheckCircle2,
  AlertTriangle,
  Monitor,
  ExternalLink
} from 'lucide-react';
import { FEEDBACK_GOOGLE_FORM_URL, FEEDBACK_FORM_CONFIGURED } from '../../config/feedbackForm';

const FEEDBACK_CATEGORIES = ['Lab', 'Puzzle', 'CTF', 'Other'] as const;

export const AdminSettings: React.FC = () => {
  const { user, logout } = useAuth();

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState<typeof FEEDBACK_CATEGORIES[number]>('Lab');

  // Feedback form state
  const [subject, setSubject] = useState('');
  const [feedback, setFeedback] = useState('');

  // Tables & Info states
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [serverStatus, setServerStatus] = useState('Online');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const token = localStorage.getItem('token');
  const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

  // Fetch Login History
  const fetchLoginHistory = async () => {
    try {
      const res = await fetch('/api/v1/reporting/login-history', { headers });
      if (res.ok) {
        setLoginHistory(await res.json());
      }
    } catch (err) {
      console.error('Failed to load login history', err);
    }
  };

  useEffect(() => {
    fetchLoginHistory();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleSaveTheme = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('theme', theme);
    
    // Apply theme change
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    showToast('Theme preference updated successfully!');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.');
      return;
    }

    try {
      const res = await fetch('/api/v1/reporting/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      if (res.ok) {
        showToast('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        showToast(data.detail || 'Password change failed.');
      }
    } catch {
      showToast('Password change failed.');
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/reporting/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ subject: `[${feedbackCategory}] ${subject}`, feedback })
      });

      if (res.ok) {
        showToast('Feedback submitted successfully.');
        setSubject('');
        setFeedback('');
      } else {
        showToast('Failed to submit feedback.');
      }
    } catch {
      showToast('Failed to submit feedback.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200 text-xs text-slate-800 dark:text-slate-200">
      
      {/* LEFT COLUMN: Profile & Details */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center shadow-xs">
          <div className="w-20 h-20 bg-[#0052CC]/10 text-[#0052CC] dark:text-blue-400 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-4 border border-[#0052CC]/25">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <h2 className="text-base font-black text-slate-900 dark:text-slate-100">{user?.name || 'Administrator'}</h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-wider">{user?.role || 'SYSTEM ADMIN'}</p>
          
          <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 text-left space-y-3 font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Email:</span>
              <span className="text-slate-900 dark:text-slate-250 font-bold">{user?.email || 'admin@cyberrange.io'}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Login:</span>
              <span className="text-slate-900 dark:text-slate-250 font-bold">Today</span>
            </div>
          </div>
        </div>

        {/* About App Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Info className="w-4 h-4 text-[#0052CC] dark:text-blue-400" />
            About CyberRange
          </h3>
          <div className="space-y-3 font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Version:</span>
              <span className="text-slate-900 dark:text-white font-bold">v3.4.1</span>
            </div>
            <div className="flex justify-between">
              <span>Database:</span>
              <span className="text-slate-900 dark:text-white font-bold">PostgreSQL 16</span>
            </div>
            <div className="flex justify-between">
              <span>Server Status:</span>
              <span className="text-emerald-600 font-bold">Online</span>
            </div>
            <div className="flex justify-between">
              <span>Build Version:</span>
              <span className="text-slate-900 dark:text-white font-bold">build_2026_08</span>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/45 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <LogOut className="w-4 h-4" /> End Admin Session
          </button>
        </div>

      </div>

      {/* RIGHT COLUMN: Settings Forms & Logs */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Theme Settings */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Monitor className="w-4 h-4 text-[#0052CC] dark:text-blue-400" />
            Display Theme Preference
          </h3>
          <form onSubmit={handleSaveTheme} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex gap-2">
              {['light', 'dark', 'system'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t as any)}
                  className={`px-4 py-2 border rounded-xl font-bold uppercase text-[10px] cursor-pointer transition-all ${
                    theme === t
                      ? 'bg-[#0052CC] border-[#0052CC] text-white'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-350 hover:bg-slate-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              type="submit"
              className="px-5 py-2 bg-[#0052CC] hover:bg-blue-600 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" /> Save Theme
            </button>
          </form>
        </div>

        {/* Change Password Settings */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Lock className="w-4 h-4 text-[#0052CC] dark:text-blue-400" />
            Security & Credentials Update
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="font-bold text-slate-500 block mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-slate-500 block mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-slate-500 block mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 bg-[#0052CC] hover:bg-blue-600 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" /> Change Password
              </button>
            </div>
          </form>
        </div>

        {/* Feedback Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <MessageSquare className="w-4 h-4 text-[#0052CC] dark:text-blue-400" />
            Platform Feedback & Bug Reports
          </h3>
          {FEEDBACK_FORM_CONFIGURED && (
            <a
              href={FEEDBACK_GOOGLE_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl hover:bg-blue-100/70 dark:hover:bg-blue-950/50 transition-colors"
            >
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">Open the full feedback form</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Covers Lab, Puzzle, CTF, and other issues in one place.</span>
              </div>
              <ExternalLink className="w-4 h-4 text-[#0052CC] shrink-0" />
            </a>
          )}
          <form onSubmit={handleSubmitFeedback} className="space-y-4">
            <div>
              <label className="font-bold text-slate-500 block mb-1">Category</label>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFeedbackCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      feedbackCategory === cat
                        ? 'bg-[#0052CC] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-500 block mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Lab telemetry latency issue"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="font-bold text-slate-500 block mb-1">Feedback Description</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Detail your experience or issues encountered..."
                rows={4}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-xs"
                required
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 bg-[#0052CC] hover:bg-blue-600 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                Submit Feedback
              </button>
            </div>
          </form>
        </div>

        {/* Login Audit Trail Log */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs space-y-3 p-6">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <History className="w-4 h-4 text-[#0052CC] dark:text-blue-400" />
            Recent Login Audit Log
          </h3>
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b text-[10px] font-bold text-slate-400 uppercase">
                  <th className="p-3">Date</th>
                  <th className="p-3">Time</th>
                  <th className="p-3">IP Address</th>
                  <th className="p-3">Browser</th>
                  <th className="p-3">Device</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loginHistory.map((h, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <td className="p-3 text-slate-600 dark:text-slate-350">{h.date}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-350">{h.time}</td>
                    <td className="p-3 font-semibold text-slate-850 dark:text-slate-200">{h.ip_address}</td>
                    <td className="p-3 text-slate-500">{h.browser}</td>
                    <td className="p-3 text-slate-500">{h.device}</td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold text-[9px]">
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl text-center">
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">End Active Session?</h4>
              <p className="text-slate-500 font-semibold leading-relaxed">
                Are you sure you want to log out and terminate your administrator session?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 border rounded-xl font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer"
              >
                Log Out
              </button>
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
