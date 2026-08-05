import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  Calendar, 
  MapPin, 
  GraduationCap, 
  Building, 
  Save, 
  Camera,
  Trash2,
  Activity,
  Smartphone,
  Globe,
  Plus,
  Star,
  CheckCircle2,
  Edit3
} from 'lucide-react';
import { useAuth } from '../../context';

const toXY = (angle: number, r: number, cx: number, cy: number) => ({
  x: cx + r * Math.sin(angle),
  y: cy - r * Math.cos(angle),
});

export const AdminProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile State
  const [profileData, setProfileData] = useState<any>({
    basic_info: {
      name: '',
      email: '',
      phone: '',
      designation: 'Administrator',
      role: 'admin',
      avatar: ''
    },
    organization_info: {
      name: '',
      institution_type: 'College',
      address: '',
      city: '',
      state: '',
      country: '',
      pincode: '',
      gst_number: ''
    },
    summary_counts: {
      purchased_labs: 4,
      invoices: 3,
      orders: 3,
      active_licenses: 120
    }
  });

  const [stats, setStats] = useState<any>({});
  const [activityGraph, setActivityGraph] = useState<any>(null);
  const [statsTab, setStatsTab] = useState<'metrics' | 'labs'>('metrics');
  
  // Real Admin Operational Summary Data
  const [adminSummary, setAdminSummary] = useState<any>(null);

  // Affiliations list
  const [affiliations, setAffiliations] = useState<any[]>([]);
  const [showCollegeModal, setShowCollegeModal] = useState(false);
  const [showOrgModal, setShowOrgModal] = useState(false);
  
  // College & Org add form states
  const [colleges, setColleges] = useState<any[]>([]);
  const [collegeSearch, setCollegeSearch] = useState('');
  const [collegeResults, setCollegeResults] = useState<any[]>([]);
  const [selectedCollege, setSelectedCollege] = useState<any>(null);
  const [typedOrgName, setTypedOrgName] = useState('');

  // Search colleges debounced
  useEffect(() => {
    if (showCollegeModal && collegeSearch.trim().length >= 2) {
      const delayDebounce = setTimeout(() => {
        fetch(`/api/v1/colleges/search?q=${encodeURIComponent(collegeSearch)}&limit=10`)
          .then((res) => res.json())
          .then((data) => setCollegeResults(data))
          .catch((err) => console.error(err));
      }, 300);
      return () => clearTimeout(delayDebounce);
    } else {
      setCollegeResults([]);
    }
  }, [collegeSearch, showCollegeModal]);

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    const h = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const profileRes = await fetch('/api/v1/admin/profile', { headers: h });
      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfileData(data);
      }

      // Fetch radar graph & student-like stats if available for admin
      const [statsRes, graphRes, affsRes, collegeRes, summaryRes] = await Promise.all([
        fetch('/api/v1/user/statistics', { headers: h }),
        fetch('/api/v1/user/activity-graph', { headers: h }),
        fetch('/api/v1/me/affiliations', { headers: h }),
        fetch('/api/v1/reporting/colleges'),
        fetch('/api/v1/admin/dashboard/summary', { headers: h })
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (graphRes.ok) setActivityGraph(await graphRes.json());
      if (affsRes.ok) setAffiliations(await affsRes.json());
      if (collegeRes.ok) setColleges(await collegeRes.json());
      if (summaryRes.ok) setAdminSummary(await summaryRes.json());
    } catch (err) {
      console.error('Failed to fetch admin profile details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image file size exceeds maximum 5 MB limit.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    const token = localStorage.getItem('token');
    const fData = new FormData();
    fData.append('file', file);

    try {
      const res = await fetch('/api/v1/user/profile/photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fData
      });

      if (res.ok) {
        const data = await res.json();
        setProfileData((prev: any) => ({
          ...prev,
          basic_info: { ...prev.basic_info, avatar: data.profile_photo }
        }));
        setMessage({ type: 'success', text: 'Profile photo uploaded successfully.' });
        await refreshUser();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.detail || 'Failed to upload photo.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error uploading photo.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!profileData.basic_info.avatar) return;
    setSaving(true);
    setMessage(null);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/v1/user/profile/photo', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setProfileData((prev: any) => ({
          ...prev,
          basic_info: { ...prev.basic_info, avatar: '' }
        }));
        setMessage({ type: 'success', text: 'Profile photo removed successfully.' });
        await refreshUser();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.detail || 'Failed to remove photo.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error removing photo.' });
    } finally {
      setSaving(false);
    }
  };

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
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setEditing(false);
      } else {
        throw new Error('Failed to save changes.');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error saving changes.' });
    } finally {
      setSaving(false);
    }
  };

  const promoteAffiliation = async (id: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/me/affiliations/${id}/primary`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchProfile();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteAffiliation = async (id: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/me/affiliations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchProfile();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to delete affiliation.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCollegeAffiliation = async () => {
    if (!selectedCollege) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/me/affiliations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          affiliation_type: 'college',
          college_id: selectedCollege.id,
          is_primary: affiliations.length === 0
        })
      });
      if (res.ok) {
        setShowCollegeModal(false);
        setSelectedCollege(null);
        setCollegeSearch('');
        fetchProfile();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to add college.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddOrgAffiliation = async () => {
    if (!typedOrgName.trim()) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/me/affiliations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          affiliation_type: 'organization',
          organization_name: typedOrgName.trim(),
          is_primary: affiliations.length === 0
        })
      });
      if (res.ok) {
        setShowOrgModal(false);
        setTypedOrgName('');
        fetchProfile();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to add organization.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-[#0052CC] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-semibold">Loading Profile...</p>
      </div>
    );
  }

  const name = profileData.basic_info.name || 'Admin';
  const email = profileData.basic_info.email || '';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  // Real Admin operational values for the spiderweb radar
  const purchasedCount = adminSummary?.purchasedLabs?.total || profileData.summary_counts?.purchased_labs || 4;
  const studentsCount = adminSummary?.students?.total || 0;
  const assignedCount = adminSummary?.assignments?.total || 0;
  const activeGroups = adminSummary?.groups?.total || 0;
  const activeLicenses = adminSummary?.purchasedLabs?.totalSeats || profileData.summary_counts?.active_licenses || 120;

  const radarLabels = ['Purchased Labs', 'Student Count', 'Assigned Labs', 'Active Groups', 'Licenses Seats'];
  const radarRaw = {
    purchased: purchasedCount,
    students: studentsCount,
    assigned: assignedCount,
    groups: activeGroups,
    licenses: activeLicenses
  };
  const radarRawKeys = ['purchased', 'students', 'assigned', 'groups', 'licenses'];

  // Scale calculations for the 5 points to keep radar looking visually realistic (0-100%)
  const radarValues = [
    Math.min(100, Math.round((purchasedCount / 10) * 100)),
    Math.min(100, Math.round((studentsCount / 30) * 100)),
    Math.min(100, Math.round((assignedCount / 20) * 100)),
    Math.min(100, Math.round((activeGroups / 10) * 100)),
    Math.min(100, Math.round((activeLicenses / 150) * 100))
  ];

  const RadarChart = () => {
    const size = 200; const cx = size / 2; const cy = size / 2; const R = 70;
    const n = radarLabels.length;
    const angles = radarLabels.map((_, i) => (2 * Math.PI * i) / n);
    const gridPts = [25, 50, 75, 100].map((lvl: number) =>
      angles.map((a: number) => { const p = toXY(a, (lvl / 100) * R, cx, cy); return `${p.x},${p.y}`; }).join(' ')
    );
    const dataPts = angles.map((a: number, i: number) => {
      const p = toXY(a, ((radarValues[i] || 0) / 100) * R, cx, cy); return `${p.x},${p.y}`;
    });
    return (
      <div className="flex flex-col items-center gap-3">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ overflow: 'visible' }}>
          {gridPts.map((pts: string, li: number) => (
            <polygon key={li} points={pts} fill="none" stroke="#E2E8F0" strokeWidth="0.8" strokeDasharray="3,3" />
          ))}
          {angles.map((a: number, i: number) => {
            const p = toXY(a, R, cx, cy);
            return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E2E8F0" strokeWidth="0.8" />;
          })}
          <polygon points={dataPts.join(' ')} fill="rgba(37,99,235,0.15)" stroke="#2563EB" strokeWidth="2" strokeLinejoin="round" />
          {angles.map((a: number, i: number) => {
            const p = toXY(a, ((radarValues[i] || 0) / 100) * R, cx, cy);
            return <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#2563EB" stroke="white" strokeWidth="1.5" />;
          })}
          {angles.map((a: number, i: number) => {
            const lp = toXY(a, R + 18, cx, cy);
            return (
              <g key={i}>
                <text x={lp.x} y={lp.y - 3} textAnchor="middle" style={{ fontSize: '7.5px', fontWeight: 700, fill: '#64748B' }}>{radarLabels[i]}</text>
                <text x={lp.x} y={lp.y + 6} textAnchor="middle" style={{ fontSize: '7px', fontWeight: 900, fill: '#2563EB' }}>{radarRaw[radarRawKeys[i] as keyof typeof radarRaw] ?? 0}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Banner */}
      <div className="relative bg-gradient-to-r from-blue-900 via-[#2563EB] to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Building className="w-80 h-80 text-white" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#10B981] text-white flex items-center justify-center font-bold text-2xl shadow-lg border-4 border-white/20 overflow-hidden">
                {profileData.basic_info.avatar ? (
                  <img src={profileData.basic_info.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              
              {editing && (
                <>
                  {/* Camera upload hidden input wrapper label */}
                  <label className="absolute bottom-0 right-0 p-1.5 bg-[#2563EB] hover:bg-blue-600 text-white rounded-full shadow-md border-2 border-white transition-colors cursor-pointer inline-flex items-center justify-center">
                    <Camera className="w-3.5 h-3.5" />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  {/* Remove photo button */}
                  {profileData.basic_info.avatar && (
                    <button
                      type="button"
                      onClick={handlePhotoDelete}
                      title="Remove Photo"
                      className="absolute top-0 right-0 p-1 bg-rose-600 text-white rounded-full shadow-md hover:bg-rose-700 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight">{name}</h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/20 text-emerald-300 border border-white/10 uppercase tracking-wider">
                  ADMIN
                </span>
              </div>
              <p className="text-sm text-blue-100/90 leading-relaxed font-bold mt-1">
                {email} (Read-Only)
              </p>
            </div>
          </div>

          {/* Banner Edit Profile action completely removed */}
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          <CheckCircle2 className="w-4 h-4" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Grid Details & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column Profile Details Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-850 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <UserIcon className="w-4.5 h-4.5 text-blue-600" /> Profile Details
              </h2>
              {editing ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditing(false);
                      fetchProfile();
                    }}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="px-3 py-1.5 bg-blue-600 border border-blue-650 rounded-xl text-[11px] font-bold text-white hover:bg-blue-750 transition-colors inline-flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold text-[#2563EB] transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                </button>
              )}
            </div>

            {/* Basic Info fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Full Name</label>
                <input 
                  type="text" 
                  disabled={!editing}
                  value={profileData.basic_info.name || ''} 
                  onChange={(e) => setProfileData({ ...profileData, basic_info: { ...profileData.basic_info, name: e.target.value } })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Designation</label>
                <input 
                  type="text" 
                  disabled={!editing}
                  value={profileData.basic_info.designation || ''} 
                  onChange={(e) => setProfileData({ ...profileData, basic_info: { ...profileData.basic_info, designation: e.target.value } })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Phone Number</label>
                <input 
                  type="text" 
                  disabled={!editing}
                  value={profileData.basic_info.phone || ''} 
                  onChange={(e) => setProfileData({ ...profileData, basic_info: { ...profileData.basic_info, phone: e.target.value } })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">GST/Tax ID</label>
                <input 
                  type="text" 
                  disabled={!editing}
                  value={profileData.organization_info.gst_number || ''} 
                  onChange={(e) => setProfileData({ ...profileData, organization_info: { ...profileData.organization_info, gst_number: e.target.value } })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Organizations & Colleges Affiliation Section */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">🎓 College Affiliations</h3>
                {editing && (
                  <button 
                    onClick={() => setShowCollegeModal(true)}
                    className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add College
                  </button>
                )}
              </div>

              {affiliations.filter(a => a.affiliation_type === 'college').map((aff) => (
                <div key={aff.id} className="p-4 bg-slate-50 dark:bg-slate-850 border border-slate-150 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 block">🏛 {aff.college_name}</span>
                    <span className="text-[10px] text-slate-400 block mt-1">Code: {aff.college_code || '--'}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-2">
                      VERIFIED
                    </span>
                  </div>
                  {editing && (
                    <div className="flex items-center gap-2">
                      {!aff.is_primary && (
                        <button
                          onClick={() => promoteAffiliation(aff.id)}
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> Set Primary
                        </button>
                      )}
                      <button
                        onClick={() => deleteAffiliation(aff.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">🏢 Organization Affiliations</h3>
                {editing && (
                  <button 
                    onClick={() => setShowOrgModal(true)}
                    className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Organization
                  </button>
                )}
              </div>

              {affiliations.filter(a => a.affiliation_type === 'organization').map((aff) => {
                const isApproved = aff.status === 'APPROVED' || aff.status === 'ACTIVE';
                const isRejected = aff.status === 'REJECTED';
                
                return (
                  <div key={aff.id} className="p-4 bg-slate-50 dark:bg-slate-850 border border-slate-150 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 block">🏢 {aff.organization_name}</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold border mt-2 ${
                        isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        isRejected ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {isApproved ? 'Verified' : isRejected ? 'Rejected' : 'In Progress'}
                      </span>
                    </div>
                    {editing && (
                      <div className="flex items-center gap-2">
                        {!aff.is_primary && (
                          <button
                            onClick={() => promoteAffiliation(aff.id)}
                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> Set Primary
                          </button>
                        )}
                        <button
                          onClick={() => deleteAffiliation(aff.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
            
            {/* KPI metrics row */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Purchased Labs</span>
                <span className="text-lg font-black text-slate-800 block mt-0.5">{purchasedCount}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Student Count</span>
                <span className="text-lg font-black text-slate-800 block mt-0.5">{studentsCount}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Assigned Labs</span>
                <span className="text-lg font-black text-slate-800 block mt-0.5">{assignedCount}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Active Groups</span>
                <span className="text-lg font-black text-slate-800 block mt-0.5">{activeGroups}</span>
              </div>
            </div>

            {/* Spiderweb chart */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Activity Radar</h4>
              <RadarChart />
            </div>

          </div>
        </div>

      </div>

      {/* College Selection Modal */}
      {showCollegeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-sm text-[#0F172A]">🏫 Add College Affiliation</h3>
            <div className="relative">
              <input
                type="text"
                placeholder="Search colleges..."
                value={collegeSearch}
                onChange={(e) => setCollegeSearch(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none"
              />
            </div>
            {collegeResults.length > 0 && (
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border rounded-xl">
                {collegeResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCollege(c)}
                    className={`w-full text-left p-2.5 text-xs hover:bg-slate-50 flex items-center justify-between ${selectedCollege?.id === c.id ? 'bg-blue-50 font-bold text-[#2563EB]' : ''}`}
                  >
                    <span>{c.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{c.code}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 text-xs pt-2">
              <button onClick={() => { setShowCollegeModal(false); setSelectedCollege(null); setCollegeSearch(''); }} className="px-4 py-2 text-slate-500 font-bold hover:text-slate-700">Cancel</button>
              <button onClick={handleAddCollegeAffiliation} disabled={!selectedCollege} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg disabled:opacity-50">Add College</button>
            </div>
          </div>
        </div>
      )}

      {/* Organization Add Modal */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-sm text-[#0F172A]">🏢 Add Organization Affiliation</h3>
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Organization Name</label>
              <input
                type="text"
                placeholder="Enter organization or company name..."
                value={typedOrgName}
                onChange={(e) => setTypedOrgName(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 text-xs pt-2">
              <button onClick={() => { setShowOrgModal(false); setTypedOrgName(''); }} className="px-4 py-2 text-slate-500 font-bold hover:text-slate-700">Cancel</button>
              <button onClick={handleAddOrgAffiliation} disabled={!typedOrgName.trim()} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg disabled:opacity-50">Add Organization</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
