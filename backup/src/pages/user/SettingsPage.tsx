import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Settings as SettingsIcon, 
  Moon, 
  Sun, 
  Monitor, 
  ShieldCheck, 
  Bell, 
  Info, 
  Globe, 
  Lock, 
  Check, 
  Smartphone, 
  Key, 
  Layers, 
  Database, 
  Terminal,
  Cpu
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const SettingsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'general';

  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'security' | 'notifications' | 'platform'>(
    initialTab as any
  );

  const { theme, setTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [general, setGeneral] = useState({
    language: 'en',
    timezone: 'UTC',
    date_format: 'YYYY-MM-DD'
  });

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

  useEffect(() => {
    const fetchSettings = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const [settingsRes, securityRes] = await Promise.all([
          fetch('/api/v1/user/settings', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/v1/user/security', { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (settingsRes.ok) {
          const sData = await settingsRes.json();
          setGeneral({
            language: sData.language || 'en',
            timezone: sData.timezone || 'UTC',
            date_format: sData.date_format || 'YYYY-MM-DD'
          });
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
  }, []);

  const handleSaveGeneral = async () => {
    setSaving(true);
    setMessage(null);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          language: general.language,
          timezone: general.timezone,
          notification_settings: notifications
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'General preferences updated in PostgreSQL.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update preferences.' });
    } finally {
      setSaving(false);
    }
  };

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

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/v1/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
          <SettingsIcon className="w-6 h-6 text-[#2563EB]" /> Settings & System Options
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage system preferences, appearance, security, notifications, and review platform information.
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
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'general' ? 'bg-white dark:bg-slate-800 text-[#2563EB] dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" /> General
        </button>

        <button
          onClick={() => setActiveTab('appearance')}
          className={`px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'appearance' ? 'bg-white dark:bg-slate-800 text-[#2563EB] dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Moon className="w-4 h-4" /> Appearance
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

      {/* TAB 1: GENERAL */}
      {activeTab === 'general' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-xs transition-colors">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
            General Preferences
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Display Language</label>
              <select
                value={general.language}
                onChange={(e) => setGeneral(prev => ({ ...prev, language: e.target.value }))}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-semibold"
              >
                <option value="en">English (US)</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">System Timezone</label>
              <select
                value={general.timezone}
                onChange={(e) => setGeneral(prev => ({ ...prev, timezone: e.target.value }))}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-semibold"
              >
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="Asia/Kolkata">IST (Indian Standard Time)</option>
                <option value="America/New_York">EST (Eastern Standard Time)</option>
                <option value="Europe/London">GMT (Greenwich Mean Time)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Date Display Format</label>
              <input
                type="text"
                disabled
                value={general.date_format}
                className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 font-semibold"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={handleSaveGeneral}
              disabled={saving}
              className="px-5 py-2.5 bg-[#2563EB] text-white rounded-lg font-bold text-xs hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save General Settings'}
            </button>
          </div>
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
              onClick={handleSaveGeneral}
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
          </div>
        </div>
      )}
    </div>
  );
};
