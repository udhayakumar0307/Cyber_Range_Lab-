import React, { useState } from 'react';
import { 
  Settings, 
  Building, 
  Lock, 
  Bell, 
  Save, 
  CheckCircle2 
} from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const [orgName, setOrgName] = useState('CyberRange Enterprise Security Inc.');
  const [adminEmail, setAdminEmail] = useState('admin@cyberrange.io');
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-7 h-7 text-[#0052CC]" />
          Platform Administration Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage organizational metadata, authentication security rules, and automated email notification preferences.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Organization Profile */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building className="w-4 h-4 text-[#0052CC]" />
            Organization Profile & Identity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Organization Name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Lead Admin Email</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Security & Authentication */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-[#0052CC]" />
            Authentication & Security Policies
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Inactivity Session Auto-Logout</label>
              <select
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none"
              >
                <option value="15">15 Minutes</option>
                <option value="30">30 Minutes (PRD Standard)</option>
                <option value="60">60 Minutes</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="font-bold text-slate-800 block">Enterprise SSO (SAML/OAuth)</span>
                <span className="text-[11px] text-slate-500">Allow single sign-on authentication</span>
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
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Bell className="w-4 h-4 text-[#0052CC]" />
            Automated Email Notifications
          </h3>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 block">Lab Availability Alerts</span>
                <span className="text-[11px] text-slate-500">Email users when a new lab is allocated to their group</span>
              </div>
              <input
                type="checkbox"
                checked={notifyLabAvailable}
                onChange={(e) => setNotifyLabAvailable(e.target.checked)}
                className="w-4 h-4 accent-[#0052CC]"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 block">Leaderboard Rank-Up Notifications</span>
                <span className="text-[11px] text-slate-500">Alert users when they advance in global or group rankings</span>
              </div>
              <input
                type="checkbox"
                checked={notifyRankUp}
                onChange={(e) => setNotifyRankUp(e.target.checked)}
                className="w-4 h-4 accent-[#0052CC]"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 block">Lab Session Completion Certificate</span>
                <span className="text-[11px] text-slate-500">Send summary report upon completing all challenges</span>
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
            className="px-6 py-3 bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Administration Preferences
          </button>
        </div>
      </form>

      {isSavedToast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-[#28A745]" />
          Platform settings updated successfully!
        </div>
      )}
    </div>
  );
};
