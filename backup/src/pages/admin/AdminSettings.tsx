import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Settings, 
  Building, 
  Lock, 
  Bell, 
  Save, 
  CheckCircle2 
} from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const { user } = useAuth();
  const [orgName, setOrgName] = useState('CyberRange Enterprise Security Inc.');
  const [adminEmail, setAdminEmail] = useState('admin@cyberrange.io');

  useEffect(() => {
    if (user) {
      setAdminEmail(user.email);
    }
  }, [user]);

  const [sessionTimeout, setSessionTimeout] = useState('30'); // 30 minutes
  const [enableSso, setEnableSso] = useState(true);

  // Notification toggles
  const [notifyLabAvailable, setNotifyLabAvailable] = useState(true);
  const [notifyRankUp, setNotifyRankUp] = useState(true);
  const [notifyCompletion, setNotifyCompletion] = useState(true);

  const [isSavedToast, setIsSavedToast] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#0052CC] dark:text-blue-400" />
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Platform Administration Settings</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage organizational metadata, authentication security rules, and automated email notification preferences.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Organization Profile */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Building className="w-4 h-4 text-[#0052CC] dark:text-blue-400" />
            Organization Profile & Identity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Organization Name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Lead Admin Email</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Security & Authentication */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Lock className="w-4 h-4 text-[#0052CC] dark:text-blue-400" />
            Authentication & Security Policies
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Inactivity Session Auto-Logout</label>
              <select
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none"
              >
                <option value="15">15 Minutes</option>
                <option value="30">30 Minutes (PRD Standard)</option>
                <option value="60">60 Minutes</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Enterprise SSO (SAML/OAuth)</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Allow single sign-on authentication</span>
              </div>
              <input
                type="checkbox"
                checked={enableSso}
                onChange={(e) => setEnableSso(e.target.checked)}
                className="w-4 h-4 text-[#0052CC] accent-[#0052CC]"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Automated Notifications */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Bell className="w-4 h-4 text-[#0052CC] dark:text-blue-400" />
            Automated Email Notifications
          </h3>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Lab Availability Alerts</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Email users when a new lab is allocated to their group</span>
              </div>
              <input
                type="checkbox"
                checked={notifyLabAvailable}
                onChange={(e) => setNotifyLabAvailable(e.target.checked)}
                className="w-4 h-4 accent-[#0052CC]"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Leaderboard Rank-Up Notifications</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Alert users when they advance in global or group rankings</span>
              </div>
              <input
                type="checkbox"
                checked={notifyRankUp}
                onChange={(e) => setNotifyRankUp(e.target.checked)}
                className="w-4 h-4 accent-[#0052CC]"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Lab Session Completion Certificate</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Send summary report upon completing all challenges</span>
              </div>
              <input
                type="checkbox"
                checked={notifyCompletion}
                onChange={(e) => setNotifyCompletion(e.target.checked)}
                className="w-4 h-4 accent-[#0052CC]"
              />
            </label>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-3 bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save Administration Preferences
          </button>
        </div>
      </form>

      {isSavedToast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 dark:bg-slate-800 text-white border border-slate-700 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-[#28A745] dark:text-emerald-400" />
          Platform settings updated successfully!
        </div>
      )}
    </div>
  );
};
