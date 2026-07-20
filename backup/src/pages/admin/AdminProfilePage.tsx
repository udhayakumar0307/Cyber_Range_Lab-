import React, { useState, useEffect } from 'react';
import { 
  User, 
  Building, 
  Shield, 
  CreditCard, 
  FlaskConical, 
  Key, 
  Calendar, 
  MapPin, 
  FileText, 
  History, 
  Code, 
  Activity,
  Save,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';

export const AdminProfilePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile State
  const [profileData, setProfileData] = useState<any>({
    basic_info: {
      name: 'Dr. Bruce Wayne',
      email: 'bruce@iitm.ac.in',
      phone: '+91 98765 43210',
      designation: 'Department Head & Admin',
      role: 'admin',
      avatar: ''
    },
    organization_info: {
      name: 'Indian Institute of Technology Madras',
      institution_type: 'College',
      address: 'IIT P.O., Sardar Patel Road',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      pincode: '600036',
      gst_number: '33AAATI1234F1Z9'
    },
    billing_address: {
      address_line: 'IIT P.O., Sardar Patel Road',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      pincode: '600036',
      gst_number: '33AAATI1234F1Z9'
    },
    summary_counts: {
      purchased_labs: 4,
      invoices: 3,
      orders: 3,
      active_licenses: 120
    },
    activity_log: []
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Fetch Profile from Backend
  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/v1/admin/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProfileData(data);
        }
      } catch (err) {
        console.error('Failed to fetch admin profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/admin/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profileData.basic_info.name,
          phone: profileData.basic_info.phone,
          designation: profileData.basic_info.designation,
          org_name: profileData.organization_info.name,
          institution_type: profileData.organization_info.institution_type,
          address: profileData.organization_info.address,
          city: profileData.organization_info.city,
          state: profileData.organization_info.state,
          country: profileData.organization_info.country,
          pincode: profileData.organization_info.pincode,
          gst_number: profileData.organization_info.gst_number
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Admin Profile updated successfully!' });
      } else {
        throw new Error('Failed to save changes.');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error saving changes.' });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Information', icon: User },
    { id: 'organization', label: 'Organization Information', icon: Building },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'payment_info', label: 'Payment Information', icon: CreditCard },
    { id: 'purchased_labs', label: 'Purchased Labs', icon: FlaskConical },
    { id: 'licenses', label: 'Licenses', icon: Key },
    { id: 'subscription', label: 'Subscription', icon: Calendar },
    { id: 'billing', label: 'Billing Address', icon: MapPin },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'order_history', label: 'Order History', icon: History },
    { id: 'api_keys', label: 'API Keys', icon: Code },
    { id: 'activity_log', label: 'Activity Log', icon: Activity }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white font-black text-xl flex items-center justify-center shadow-md">
            {profileData.basic_info.name?.slice(0, 2).toUpperCase() || 'AD'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {profileData.basic_info.name}
              </h1>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-900">
                Verified Admin
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {profileData.basic_info.designation} • {profileData.organization_info.name}
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 self-start sm:self-center"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Grid: Sidebar Tabs + Content Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content View Panel */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          {/* TAB 1: Basic Information */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
                Basic Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Admin Full Name</label>
                  <input
                    type="text"
                    value={profileData.basic_info.name || ''}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        basic_info: { ...profileData.basic_info, name: e.target.value }
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Official Email Address</label>
                  <input
                    type="email"
                    disabled
                    value={profileData.basic_info.email || ''}
                    className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={profileData.basic_info.phone || ''}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        basic_info: { ...profileData.basic_info, phone: e.target.value }
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Designation / Role Title</label>
                  <input
                    type="text"
                    value={profileData.basic_info.designation || ''}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        basic_info: { ...profileData.basic_info, designation: e.target.value }
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Organization Information */}
          {activeTab === 'organization' && (
            <div className="space-y-6">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
                Organization Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Organization Name</label>
                  <input
                    type="text"
                    value={profileData.organization_info.name || ''}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        organization_info: { ...profileData.organization_info, name: e.target.value }
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Institution Type</label>
                  <input
                    type="text"
                    value={profileData.organization_info.institution_type || ''}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        organization_info: { ...profileData.organization_info, institution_type: e.target.value }
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">GST / Tax Identification</label>
                  <input
                    type="text"
                    value={profileData.organization_info.gst_number || ''}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        organization_info: { ...profileData.organization_info, gst_number: e.target.value }
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Security */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
                Security & Authentication
              </h2>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Current Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">New Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>

                <button
                  type="button"
                  className="bg-blue-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs"
                >
                  Update Password
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Payment Information */}
          {activeTab === 'payment_info' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
                Payment Gateways & Saved Methods
              </h2>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Razorpay / Corporate Netbanking</p>
                    <p className="text-[11px] text-slate-400">Primary payment channel for seat allocations & lab renewals</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Active
                </span>
              </div>
            </div>
          )}

          {/* TAB 5 & 6 & 7 & 8 & 9 & 10: Other Overview Tabs */}
          {['purchased_labs', 'licenses', 'subscription', 'billing', 'invoices', 'order_history'].includes(activeTab) && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
                {activeTab.replace('_', ' ').toUpperCase()} Summary
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Purchased Labs</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white block mt-1">
                    {profileData.summary_counts?.purchased_labs || 4}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Active Licenses</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white block mt-1">
                    {profileData.summary_counts?.active_licenses || 120}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Invoices</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white block mt-1">
                    {profileData.summary_counts?.invoices || 3}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Subscription Tier</span>
                  <span className="text-sm font-black text-blue-600 block mt-2">Enterprise</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: API Keys (Future Placeholder) */}
          {activeTab === 'api_keys' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
                API Keys (Developer Integration)
              </h2>
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
                <Code className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">API Gateway Keys (Future Integration)</p>
                <p className="text-xs text-slate-400 mt-1">Generate REST API tokens to programmatically provision lab seats into your LMS.</p>
              </div>
            </div>
          )}

          {/* TAB 12: Activity Log */}
          {activeTab === 'activity_log' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
                Recent Admin Activity Log
              </h2>
              <div className="space-y-2">
                {profileData.activity_log && profileData.activity_log.length > 0 ? (
                  profileData.activity_log.map((log: any) => (
                    <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs flex justify-between">
                      <span className="font-bold text-slate-700 dark:text-slate-200">{log.action} ({log.resource})</span>
                      <span className="text-slate-400">{log.timestamp}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">No recent activity logged.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
