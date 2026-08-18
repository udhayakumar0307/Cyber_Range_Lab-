import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Settings as SettingsIcon, 
  Moon, 
  Sun, 
  ShieldCheck, 
  Bell, 
  Info, 
  Check, 
  Smartphone, 
  Key, 
  Layers, 
  Database, 
  Terminal,
  Cpu,
  Globe,
  CreditCard,
  Download,
  AlertCircle,
  ExternalLink,
  Send
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context';
import { downloadAuthenticatedFile } from '../../utils/exportUtils';
import { FEEDBACK_GOOGLE_FORM_URL, FEEDBACK_FORM_CONFIGURED } from '../../config/feedbackForm';

const FEEDBACK_CATEGORIES = ['Lab', 'Puzzle', 'CTF', 'Other'] as const;

export const SettingsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user, apiFetch } = useAuth();
  
  const isSso = user?.auth_type === 'SSO';
  const initialTab = searchParams.get('tab') || 'appearance';

  const [activeTab, setActiveTab] = useState<'paymentHistory' | 'appearance' | 'security' | 'notifications' | 'platform' | 'feedback'>(
    initialTab as any
  );

  const { theme, setTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [feedbackCategory, setFeedbackCategory] = useState<typeof FEEDBACK_CATEGORIES[number]>('Lab');
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackDescription, setFeedbackDescription] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmitFeedback = async () => {
    if (!feedbackSubject.trim() || !feedbackDescription.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Please fill in both subject and description.' });
      return;
    }
    setFeedbackSubmitting(true);
    setFeedbackMessage(null);
    try {
      const res = await apiFetch('/api/v1/reporting/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `[${feedbackCategory}] ${feedbackSubject}`,
          feedback: feedbackDescription
        })
      });
      if (res.ok) {
        setFeedbackMessage({ type: 'success', text: 'Feedback submitted. Thanks for letting us know!' });
        setFeedbackSubject('');
        setFeedbackDescription('');
      } else {
        setFeedbackMessage({ type: 'error', text: 'Failed to submit feedback.' });
      }
    } catch {
      setFeedbackMessage({ type: 'error', text: 'Failed to submit feedback.' });
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const [appearance, setAppearance] = useState({
    accent_color: '#2563EB',
    font_size: 'medium',
    compact_mode: false,
    animations: true
  });

  const [notifications, setNotifications] = useState({
    email_notifications: true,
    achievement_notifications: true,
    professor_assignments: true,
    leaderboard_updates: true,
    system_alerts: true,
    maintenance_alerts: true
  });

  const [security, setSecurity] = useState({
    current_ip: '127.0.0.1',
    current_user_agent: '',
    last_login: '',
    recent_login_history: [] as any[]
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [platformInfo, setPlatformInfo] = useState<any>({});
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  const fetchPaymentHistory = async () => {
    if (isSso) return;
    try {
      const res = await apiFetch('/api/v1/student/payments');
      if (res.ok) {
        setPaymentHistory(await res.json());
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [settingsRes, securityRes] = await Promise.all([
          apiFetch('/api/v1/user/settings'),
          apiFetch('/api/v1/user/security')
        ]);

        if (settingsRes.ok) {
          const sData = await settingsRes.json();
          if (sData.notification_settings) {
            setNotifications(sData.notification_settings);
          }
          if (sData.platform_info) {
            setPlatformInfo(sData.platform_info);
          }
        }

        if (securityRes.ok) {
          const secData = await securityRes.json();
          setSecurity(secData);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };

    fetchSettings();
    fetchPaymentHistory();
  }, [apiFetch, isSso]);

  const handleSaveAppearance = async (newTheme?: 'light' | 'dark') => {
    setSaving(true);
    setMessage(null);
    const targetTheme = newTheme || theme;

    try {
      await setTheme(targetTheme as any);
      setMessage({ type: 'success', text: `Appearance preferences saved in database! (Theme: ${targetTheme})` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Error saving appearance settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch('/api/v1/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_settings: notifications
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Notification preferences updated.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update preferences.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await apiFetch('/api/v1/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.detail || 'Failed to change password.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error updating password.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadInvoice = async (logId: number) => {
    try {
      await downloadAuthenticatedFile(
        `/api/v1/student/payments/${logId}/invoice`,
        `invoice_${logId}.pdf`
      );
    } catch (err: any) {
      alert(`Invoice download failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
          <SettingsIcon className="w-6 h-6 text-[#2563EB]" /> Settings & System Options
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage system preferences, appearance, security, notifications, and review platform info.
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
        }`}>
          <Check className="w-4 h-4" /> {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-xs font-bold w-full overflow-x-auto gap-1 transition-colors">
        <button
          onClick={() => setActiveTab('appearance')}
          className={`px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'appearance' ? 'bg-white dark:bg-slate-800 text-[#2563EB] dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Moon className="w-4 h-4" /> Appearance
        </button>

        {!isSso && (
          <button
            onClick={() => setActiveTab('paymentHistory')}
            className={`px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'paymentHistory' ? 'bg-white dark:bg-slate-800 text-[#2563EB] dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Payment History
          </button>
        )}

        <button
          onClick={() => setActiveTab('feedback')}
          className={`px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'feedback' ? 'bg-white dark:bg-slate-800 text-[#2563EB] dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <AlertCircle className="w-4 h-4" /> Feedback
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'security' ? 'bg-white dark:bg-slate-800 text-[#2563EB] dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Security
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'notifications' ? 'bg-white dark:bg-slate-800 text-[#2563EB] dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Bell className="w-4 h-4" /> Notifications
        </button>

        <button
          onClick={() => setActiveTab('platform')}
          className={`px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'platform' ? 'bg-white dark:bg-slate-800 text-[#2563EB] dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Info className="w-4 h-4" /> Platform Info
        </button>
      </div>

      {/* TAB CONTENT */}

      {/* TAB 1: PAYMENT HISTORY */}
      {!isSso && activeTab === 'paymentHistory' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-xs transition-colors">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
            Payment Records & Invoices
          </h2>

          {paymentHistory.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No payment history available.</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto leading-relaxed">
                Purchase a lab from the Available Labs page to view your payment records here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Lab Name</th>
                    <th className="px-4 py-3">Order ID</th>
                    <th className="px-4 py-3">Payment ID</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paymentHistory.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{item.timestamp}</td>
                      <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">{item.lab_name}</td>
                      <td className="px-4 py-3.5 font-mono text-slate-500 dark:text-slate-400">{item.order_id}</td>
                      <td className="px-4 py-3.5 font-mono text-slate-500 dark:text-slate-400">{item.payment_id}</td>
                      <td className="px-4 py-3.5 font-black text-[#0F172A] dark:text-white">₹{item.amount}</td>
                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleDownloadInvoice(item.id)}
                          className="bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Invoice</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: APPEARANCE */}
      {activeTab === 'appearance' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-xs transition-colors">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
            Appearance & Theme Selection (Persisted in PostgreSQL)
          </h2>

          <div className="space-y-4">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Theme Selection</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleSaveAppearance('light')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                  theme === 'light' ? 'border-[#2563EB] bg-blue-50/50 dark:bg-blue-950/20 text-[#2563EB]' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Sun className="w-6 h-6 text-amber-500" />
                <span className="font-bold text-xs">Light Mode</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveAppearance('dark')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                  theme === 'dark' ? 'border-[#2563EB] bg-blue-50/50 dark:bg-blue-950/20 text-[#2563EB]' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Moon className="w-6 h-6 text-indigo-500" />
                <span className="font-bold text-xs">Dark Mode</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Accent Brand Color</label>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={appearance.accent_color} 
                  onChange={(e) => setAppearance(prev => ({ ...prev, accent_color: e.target.value }))}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0" 
                />
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{appearance.accent_color}</span>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Font Scale Size</label>
              <select
                value={appearance.font_size}
                onChange={(e) => setAppearance(prev => ({ ...prev, font_size: e.target.value }))}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-semibold"
              >
                <option value="small">Small (Dense)</option>
                <option value="medium">Medium (Default)</option>
                <option value="large">Large (Comfortable)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs transition-colors">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Key className="w-4 h-4 text-[#2563EB]" /> Password & Credentials Management
            </h2>

            <form onSubmit={handlePasswordChange} className="space-y-4 text-xs max-w-md">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-semibold"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#2563EB] text-white font-bold rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {saving ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs transition-colors">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Smartphone className="w-4 h-4 text-[#2563EB]" /> Current Connection & Device Metadata
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <span className="text-slate-400 dark:text-slate-500 font-bold block text-[10px] uppercase">Client IP Address</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block">{security.current_ip}</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl sm:col-span-2">
                <span className="text-slate-400 dark:text-slate-500 font-bold block text-[10px] uppercase">User Agent String</span>
                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate mt-1 block">{security.current_user_agent || 'Mozilla/5.0 (Windows)'}</span>
              </div>
            </div>

            <div className="pt-4">
              <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300 mb-3">Recent Login & Audit History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 uppercase font-bold">
                      <th className="px-4 py-2">Action</th>
                      <th className="px-4 py-2">IP Address</th>
                      <th className="px-4 py-2">Device</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {security.recent_login_history.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200">{log.action}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">{log.ip_address}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{log.device}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 'SUCCESS' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500">{log.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-xs transition-colors">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
            Notification Alert Preferences
          </h2>

          <div className="space-y-4 text-xs">
            {Object.entries({
              email_notifications: ['Email Notifications', 'Receive emails regarding account security and updates.'],
              achievement_notifications: ['Achievement Alerts', 'Get alerted when unlocking new badges and milestones.'],
              professor_assignments: ['Professor Assignments', 'Notifications when new lab assignments are posted.'],
              leaderboard_updates: ['Leaderboard Updates', 'Weekly rank change notifications.'],
              system_alerts: ['System & Range Alerts', 'Critical range maintenance and environment alerts.']
            }).map(([key, [title, desc]]) => (
              <div key={key} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">{title}</span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">{desc}</span>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(notifications as any)[key]}
                    onChange={(e) => setNotifications(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2563EB]"></div>
                </label>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={handleSaveNotifications}
              disabled={saving}
              className="px-5 py-2.5 bg-[#2563EB] text-white rounded-lg font-bold text-xs hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Notification Toggles'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: PLATFORM INFORMATION */}
      {activeTab === 'platform' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-xs transition-colors">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
            Platform Environment Information (Read-Only)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase block flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#2563EB]" /> CyberRange Release
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-1 block">
                {platformInfo.version || 'CyberRange v1.0.0'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase block flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-indigo-500" /> Frontend Architecture
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-1 block">
                {platformInfo.frontend || 'React 18 + TS + Vite'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase block flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-emerald-500" /> Backend Engine
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-1 block">
                {platformInfo.backend || 'FastAPI (Python 3.11)'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase block flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-purple-500" /> Database Cluster
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-1 block">
                {platformInfo.database || 'AWS RDS PostgreSQL'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase block flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" /> Environment Mode
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-1 block">
                {platformInfo.environment || 'Production'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase block flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-amber-500" /> Container Orchestration
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-1 block">
                {platformInfo.docker || 'Docker Active'}
              </span>
            </div>

            {isSso && (
              <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900 col-span-1 sm:col-span-2 lg:col-span-3">
                <span className="text-blue-500 font-extrabold text-[10px] uppercase block">
                  Institution Workspace Info
                </span>
                <div className="mt-2 space-y-1 text-xs">
                  <p className="text-slate-800 dark:text-slate-200">
                    <strong className="font-bold text-slate-400">Institution:</strong> {user?.email ? user.email.split('@')[1].toUpperCase() : 'College'}
                  </p>
                  <p className="text-slate-800 dark:text-slate-200">
                    <strong className="font-bold text-slate-400">Account Type:</strong> Academic Account (SSO Managed)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: FEEDBACK */}
      {activeTab === 'feedback' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-xs transition-colors">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
            Platform Feedback &amp; Bug Reports
          </h2>

          {FEEDBACK_FORM_CONFIGURED && (
            <a
              href={FEEDBACK_GOOGLE_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl hover:bg-blue-100/70 dark:hover:bg-blue-950/50 transition-colors"
            >
              <div>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 block">Open the full feedback form</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Covers Lab, Puzzle, CTF, and other issues in one place.</span>
              </div>
              <ExternalLink className="w-4 h-4 text-[#2563EB] shrink-0" />
            </a>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1.5">Category</label>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFeedbackCategory(cat)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                      feedbackCategory === cat
                        ? 'bg-[#2563EB] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1.5">Subject</label>
              <input
                type="text"
                value={feedbackSubject}
                onChange={(e) => setFeedbackSubject(e.target.value)}
                placeholder="e.g. Lab terminal not connecting"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1.5">Description</label>
              <textarea
                value={feedbackDescription}
                onChange={(e) => setFeedbackDescription(e.target.value)}
                rows={4}
                placeholder="Detail your experience or issue encountered..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 resize-none"
              />
            </div>

            {feedbackMessage && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                feedbackMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
              }`}>
                <Check className="w-4 h-4" /> {feedbackMessage.text}
              </div>
            )}

            <button
              onClick={handleSubmitFeedback}
              disabled={feedbackSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-2 disabled:opacity-60"
            >
              <Send className="w-4 h-4" /> {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
