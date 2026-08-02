import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context';
import { 
  ShieldCheck, 
  Camera, 
  Save, 
  Lock, 
  Bell, 
  CheckCircle2
} from 'lucide-react';

interface NotificationSettings {
  labAllocated: boolean;
  labStartsWarning: boolean;
  rankPromotion: boolean;
  weeklyDigest: boolean;
}

export const UserProfile: React.FC = () => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'details' | 'security' | 'notifications'>('details');
  
  // Form State Values
  const [name, setName] = useState('Alex Operator');
  const [email, setEmail] = useState('student@cyberrange.io');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'AO';
    return nameStr
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  const [organization, setOrganization] = useState('CyberRange Academy');

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    labAllocated: true,
    labStartsWarning: true,
    rankPromotion: true,
    weeklyDigest: false
  });

  // Success indicators
  const [showDetailsSuccess, setShowDetailsSuccess] = useState(false);
  const [showSecuritySuccess, setShowSecuritySuccess] = useState(false);
  const [showNotificationSuccess, setShowNotificationSuccess] = useState(false);

  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    setShowDetailsSuccess(true);
    setTimeout(() => setShowDetailsSuccess(false), 2500);
  };

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('New passwords do not match.');
      return;
    }
    setShowSecuritySuccess(true);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setTimeout(() => setShowSecuritySuccess(false), 2500);
  };

  const handleSaveNotifications = () => {
    setShowNotificationSuccess(true);
    setTimeout(() => setShowNotificationSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Profile & Settings</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your personal details, secure account credentials, and email notification configurations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Summary Info Box */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col items-center text-center space-y-4 h-fit">
          {/* Avatar frame */}
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-3xl shadow-md border-4 border-white">
              {getInitials(name)}
            </div>
            {/* Edit camera circle */}
            <button 
              onClick={() => alert('Feature incoming: Upload profile avatar image.')}
              className="absolute bottom-0 right-0 p-1.5 bg-[#0052CC] hover:bg-blue-700 text-white rounded-full shadow-md border-2 border-white transition-colors"
              title="Upload photo"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <h2 className="font-extrabold text-slate-800 text-base">{name}</h2>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 mt-1.5 inline-block">
              Level 12 Specialist
            </span>
          </div>

          <div className="w-full border-t border-slate-100 pt-4 text-xs text-slate-500 space-y-2">
            <div className="flex justify-between">
              <span>Organization</span>
              <span className="font-bold text-slate-700">{organization}</span>
            </div>
            <div className="flex justify-between">
              <span>Account Status</span>
              <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Verified
              </span>
            </div>
            <div className="flex justify-between">
              <span>Joined Platform</span>
              <span className="font-bold text-slate-700">June 2026</span>
            </div>
          </div>
        </div>

        {/* Right Column: Settings Configuration Tabs Panel */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          {/* Sub tabs list selector */}
          <div className="flex border-b border-slate-100 bg-slate-50/50 p-2 gap-1.5">
            <button
              onClick={() => setActiveSubTab('details')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'details'
                  ? 'bg-white text-[#0052CC] border border-slate-200/60 shadow-xs'
                  : 'text-slate-500 hover:bg-white/40 hover:text-slate-800'
              }`}
            >
              Personal Details
            </button>
            <button
              onClick={() => setActiveSubTab('security')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'security'
                  ? 'bg-white text-[#0052CC] border border-slate-200/60 shadow-xs'
                  : 'text-slate-500 hover:bg-white/40 hover:text-slate-800'
              }`}
            >
              Security Settings
            </button>
            <button
              onClick={() => setActiveSubTab('notifications')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'notifications'
                  ? 'bg-white text-[#0052CC] border border-slate-200/60 shadow-xs'
                  : 'text-slate-500 hover:bg-white/40 hover:text-slate-800'
              }`}
            >
              Notification Rules
            </button>
          </div>

          {/* Form Content body */}
          <div className="p-6 flex-1">
            
            {/* SUB TAB 1: DETAILS */}
            {activeSubTab === 'details' && (
              <form onSubmit={handleSaveDetails} className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/15"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/15"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Organization</label>
                    <input 
                      type="text" 
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/15"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  {showDetailsSuccess ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Personal details updated!
                    </span>
                  ) : <span />}
                  
                  <button
                    type="submit"
                    className="bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            )}

            {/* SUB TAB 2: SECURITY */}
            {activeSubTab === 'security' && (
              <form onSubmit={handleSaveSecurity} className="space-y-4 animate-in fade-in duration-200">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Password</label>
                    <input 
                      type="password" 
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/15"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">New Password</label>
                    <input 
                      type="password" 
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/15"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Confirm New Password</label>
                    <input 
                      type="password" 
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/15"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  {showSecuritySuccess ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Password credentials updated!
                    </span>
                  ) : <span />}

                  <button
                    type="submit"
                    className="bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Update Password</span>
                  </button>
                </div>
              </form>
            )}

            {/* SUB TAB 3: NOTIFICATIONS */}
            {activeSubTab === 'notifications' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Alerts Preferences</span>
                  <p className="text-xs text-slate-500">Enable or disable automated email notification warnings.</p>
                </div>

                <div className="space-y-3.5 pt-2">
                  <label className="flex items-start gap-3 text-xs text-slate-600 leading-normal cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={notifications.labAllocated}
                      onChange={(e) => setNotifications({...notifications, labAllocated: e.target.checked})}
                      className="mt-0.5 w-4 h-4 border-slate-300 rounded-sm text-[#0052CC] focus:ring-[#0052CC]/15" 
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Lab Allocated</span>
                      <span>Notify me when a training range is added to my cohort inventory catalog.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 text-xs text-slate-600 leading-normal cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={notifications.labStartsWarning}
                      onChange={(e) => setNotifications({...notifications, labStartsWarning: e.target.checked})}
                      className="mt-0.5 w-4 h-4 border-slate-300 rounded-sm text-[#0052CC] focus:ring-[#0052CC]/15" 
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">10-Minute Pre-Live Warning (PRD requirement)</span>
                      <span>Dispatch warning email alert exactly 10 minutes before an assigned scheduled lab goes live.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 text-xs text-slate-600 leading-normal cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={notifications.rankPromotion}
                      onChange={(e) => setNotifications({...notifications, rankPromotion: e.target.checked})}
                      className="mt-0.5 w-4 h-4 border-slate-300 rounded-sm text-[#0052CC] focus:ring-[#0052CC]/15" 
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Leaderboard Rank Promotions</span>
                      <span>Notify me on achievements, solves status changes, and global rank upgrades.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 text-xs text-slate-600 leading-normal cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={notifications.weeklyDigest}
                      onChange={(e) => setNotifications({...notifications, weeklyDigest: e.target.checked})}
                      className="mt-0.5 w-4 h-4 border-slate-300 rounded-sm text-[#0052CC] focus:ring-[#0052CC]/15" 
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Weekly Performance Digest</span>
                      <span>Send cumulative training progress stats, duration graphs, and solve paths summaries.</span>
                    </div>
                  </label>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  {showNotificationSuccess ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Notification guidelines saved!
                    </span>
                  ) : <span />}

                  <button
                    onClick={handleSaveNotifications}
                    className="bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Bell className="w-4 h-4" />
                    <span>Save Notifications</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
