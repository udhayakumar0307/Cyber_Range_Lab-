import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  Calendar, 
  MapPin, 
  GraduationCap, 
  Briefcase, 
  Award, 
  Trophy, 
  Clock, 
  Flame, 
  Zap, 
  ShieldCheck, 
  Check, 
  Edit3, 
  Save, 
  Camera,
  Trash2,
  Activity,
  Smartphone,
  Globe,
  Monitor,
  Plus,
  Search,
  Building,
  Building2,
  Star
} from 'lucide-react';
import { useAuth } from '../../context';

export const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editing, setEditing] = useState(false);

  const [profile, setProfile] = useState<any>({});
  const [stats, setStats] = useState<any>({});
  const [security, setSecurity] = useState<any>({});
  const [colleges, setColleges] = useState<any[]>([]);
  const [affiliations, setAffiliations] = useState<any[]>([]);
  const [completedLabs, setCompletedLabs] = useState<any[]>([]);
  const [activityGraph, setActivityGraph] = useState<any>(null);
  const [statsTab, setStatsTab] = useState<'metrics' | 'labs'>('metrics');

  // Phone OTP verification state
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpMsg, setOtpMsg] = useState('');

  // Modals state
  const [showCollegeModal, setShowCollegeModal] = useState(false);
  const [showOrgModal, setShowOrgModal] = useState(false);

  // College search state
  const [collegeSearch, setCollegeSearch] = useState('');
  const [collegeResults, setCollegeResults] = useState<any[]>([]);
  const [selectedCollege, setSelectedCollege] = useState<any>(null);

  // Org form state
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

  const fetchAffiliations = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/v1/me/affiliations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setAffiliations(await res.json());
      }
    } catch (err) {
      console.error(err);
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
        fetchAffiliations();
        fetchProfileData();
        refreshUser();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to promote affiliation.');
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
        fetchAffiliations();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to delete affiliation.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCollegeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollege) return;
    const token = localStorage.getItem('token');
    if (!token) return;
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
        setCollegeSearch('');
        setSelectedCollege(null);
        fetchAffiliations();
        fetchProfileData();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to add college.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedOrgName.trim()) return;
    const token = localStorage.getItem('token');
    if (!token) return;
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
        fetchAffiliations();
        fetchProfileData();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to add organization.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendPhoneOtp = async () => {
    if (!formData.phone.trim()) {
      alert('Please enter a phone number first.');
      return;
    }
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/phone/send-otp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ phone: formData.phone })
      });
      if (res.ok) {
        const data = await res.json();
        setOtpSent(true);
        setOtpMsg(data.message || 'Simulated OTP: 123456 has been sent.');
      } else {
        alert('Failed to send OTP.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!otpCode.trim()) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/phone/verify-otp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ phone: formData.phone, otp: otpCode })
      });
      if (res.ok) {
        setPhoneVerified(true);
        setOtpSent(false);
        setOtpCode('');
        alert('Phone verified and saved to database successfully!');
        fetchProfileData();
      } else {
        const err = await res.json();
        alert(err.detail || 'Invalid OTP code.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    dob: '',
    gender: 'Other',
    country: '',
    state: '',
    city: '',
    profession: '',
    organization: '',
    experience: '',
    highest_qualification: '',
    designation: '',
    college_id: '',
    department: '',
    course: '',
    year: 1,
    semester: 1,
    roll_number: '',
    section: '',
    professor: '',
    batch: '',
    student_id_num: '',
    profile_photo: ''
  });

  const fetchProfileData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const [profileRes, statsRes, securityRes, collegeRes, labsRes, graphRes] = await Promise.all([
        fetch('/api/v1/user/profile', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/user/statistics', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/user/security', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/reporting/colleges'),
        fetch('/api/v1/user/completed-labs', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/user/activity-graph', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (profileRes.ok) {
        const pData = await profileRes.json();
        setProfile(pData);
        setPhoneVerified(pData.phone_verified || false);
        setFormData({
          name: pData.name || '',
          phone: pData.phone || '',
          dob: pData.dob || '',
          gender: pData.gender || 'Male',
          country: pData.country || '',
          state: pData.state || '',
          city: pData.city || '',
          profession: pData.profession || '',
          organization: pData.organization || '',
          experience: pData.experience || '',
          highest_qualification: pData.highest_qualification || '',
          designation: pData.designation || '',
          college_id: pData.college_id ? String(pData.college_id) : '',
          department: pData.department || '',
          course: pData.course || '',
          year: pData.year || 1,
          semester: pData.semester || 1,
          roll_number: pData.roll_number || '',
          section: pData.section || '',
          professor: pData.professor || '',
          batch: pData.batch || '',
          student_id_num: pData.student_id_num || '',
          profile_photo: pData.profile_photo || ''
        });
      }

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }

      if (securityRes.ok) {
        setSecurity(await securityRes.json());
      }

      if (collegeRes.ok) {
        setColleges(await collegeRes.json());
      }

      if (labsRes.ok) {
        setCompletedLabs(await labsRes.json());
      }

      if (graphRes.ok) {
        setActivityGraph(await graphRes.json());
      }
    } catch (err) {
      console.error('Error fetching profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
    fetchAffiliations();
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
        setProfile((prev: any) => ({ ...prev, profile_photo: data.profile_photo }));
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
    if (!profile.profile_photo) return;
    setSaving(true);
    setMessage(null);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/v1/user/profile/photo', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setProfile((prev: any) => ({ ...prev, profile_photo: null }));
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const token = localStorage.getItem('token');
    try {
      const payload = {
        ...formData,
        college_id: formData.college_id ? parseInt(formData.college_id) : null,
        year: parseInt(String(formData.year)) || 1,
        semester: parseInt(String(formData.semester)) || 1
      };

      const res = await fetch('/api/v1/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully in AWS RDS PostgreSQL!' });
        await fetchProfileData();
        await refreshUser();
        setEditing(false);
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.detail || 'Failed to update profile.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error saving profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="relative bg-gradient-to-r from-blue-900 via-[#2563EB] to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-md overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <ShieldCheck className="w-80 h-80" />
        </div>

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar & Upload Controls */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#10B981] text-white flex items-center justify-center font-black text-3xl shadow-lg border-4 border-white/20 overflow-hidden ring-4 ring-white/10">
                {profile.profile_photo ? (
                  <img src={profile.profile_photo} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  profile.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'AO'
                )}
              </div>
              {/* Camera upload button — always visible */}
              <label className="absolute bottom-0 right-0 p-2 bg-[#2563EB] text-white rounded-full shadow-md cursor-pointer hover:bg-blue-600 transition-all">
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
              {/* Remove button — only overlay when photo exists, shown on group hover */}
              {profile.profile_photo && (
                <button
                  type="button"
                  onClick={handlePhotoDelete}
                  title="Remove Photo"
                  className="absolute top-0 right-0 p-1 bg-rose-600 text-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-700"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>


          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{profile.name || 'Alex Operator'}</h1>
              <span className="px-3 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider border border-white/20">
                {profile.account_type || 'STUDENT'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-blue-100 font-medium flex items-center justify-center sm:justify-start gap-2">
              <Mail className="w-4 h-4" /> {profile.email} (Read-Only)
            </p>
            {profile.college_name && (
              <p className="text-xs text-blue-200 flex items-center justify-center sm:justify-start gap-1.5 font-semibold">
                <GraduationCap className="w-4 h-4" /> {profile.college_name}
              </p>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
        }`}>
          <Check className="w-4 h-4" /> {message.text}
        </div>
      )}

      {/* Main Grid: Demographics & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* SECTION 1: PROFILE DETAILS */}
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs transition-colors space-y-6">
            <div className="flex justify-between items-center border-b border-[#E2E8F0] dark:border-[#334155] pb-4">
              <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-[#2563EB]" /> Profile Details
              </h2>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold text-[#2563EB] dark:text-blue-400 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                </button>
              )}
            </div>

            {editing ? (
              <form onSubmit={handleSubmit} className="space-y-6 text-xs">
                {/* 👤 Personal Details */}
                <div className="space-y-4">
                  <h3 className="font-extrabold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">👤 Personal Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-[#64748B] dark:text-[#CBD5E1] block mb-1">Full Name</label>
                      <input 
                        type="text" 
                        name="name" 
                        value={formData.name} 
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#64748B] dark:text-[#CBD5E1] block mb-1">Mobile Phone</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          name="phone" 
                          value={formData.phone} 
                          onChange={handleChange}
                          placeholder="+91 9876543210"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="font-bold text-[#64748B] dark:text-[#CBD5E1] block mb-1">Date of Birth</label>
                      <input 
                        type="date" 
                        name="dob" 
                        value={formData.dob} 
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#64748B] dark:text-[#CBD5E1] block mb-1">Gender</label>
                      <select 
                        name="gender" 
                        value={formData.gender} 
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-[#64748B] dark:text-[#CBD5E1] block mb-1">Country</label>
                      <input 
                        type="text" 
                        name="country" 
                        value={formData.country} 
                        onChange={handleChange}
                        placeholder="India"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#64748B] dark:text-[#CBD5E1] block mb-1">City / State</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          name="city" 
                          value={formData.city} 
                          onChange={handleChange}
                          placeholder="City"
                          className="w-1/2 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
                        />
                        <input 
                          type="text" 
                          name="state" 
                          value={formData.state} 
                          onChange={handleChange}
                          placeholder="State"
                          className="w-1/2 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🎓 Education Details */}
                <div className="pt-6 border-t border-[#E2E8F0] dark:border-[#334155] space-y-4">
                  <h3 className="font-extrabold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">🎓 Education Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-[#64748B] dark:text-[#CBD5E1] block mb-1">Department</label>
                      <input 
                        type="text" 
                        name="department" 
                        value={formData.department} 
                        onChange={handleChange}
                        placeholder="CSE / IT"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#64748B] dark:text-[#CBD5E1] block mb-1">College Roll Number</label>
                      <input 
                        type="text" 
                        name="roll_number" 
                        value={formData.roll_number} 
                        onChange={handleChange}
                        placeholder="21CS104"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#64748B] dark:text-[#CBD5E1] block mb-1">Academic Year</label>
                      <input 
                        type="number" 
                        name="year" 
                        value={formData.year} 
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#64748B] dark:text-[#CBD5E1] block mb-1">Semester</label>
                      <input 
                        type="number" 
                        name="semester" 
                        value={formData.semester} 
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                  </div>
                </div>

                {/* 🏢 Organization Details */}
                <div className="pt-6 border-t border-[#E2E8F0] dark:border-[#334155] space-y-4">
                  <h3 className="font-extrabold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">🏢 Organization Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-[#64748B] dark:text-[#CBD5E1] block mb-1">Designation</label>
                      <input 
                        type="text" 
                        name="designation" 
                        value={formData.designation} 
                        onChange={handleChange}
                        placeholder="Research Intern"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#334155] flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 border border-[#E2E8F0] dark:border-slate-700 rounded-lg font-bold text-[#64748B] dark:text-[#CBD5E1] hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-[#2563EB] text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6 mt-6">
                {/* Read-only view: Subsection A */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Mobile Phone</span>
                    <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.phone || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Date of Birth</span>
                    <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.dob || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Gender</span>
                    <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.gender || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Location</span>
                    <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">
                      {[profile.city, profile.state, profile.country].filter(Boolean).join(', ') || '--'}
                    </span>
                  </div>
                </div>

                {/* Read-only view: Subsection B */}
                <div className="pt-6 border-t border-[#E2E8F0] dark:border-[#334155]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-extrabold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">🎓 Education</h3>
                    <button
                      onClick={() => setShowCollegeModal(true)}
                      className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add College
                    </button>
                  </div>

                  {affiliations.filter(a => a.affiliation_type === 'college' && a.is_primary).map((aff) => (
                    <div key={aff.id} className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 mb-4 relative">
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Primary College</span>
                        <span className="text-[#0F172A] dark:text-white font-extrabold text-sm mt-1 flex items-center gap-1.5">
                          🏛 {aff.college_name}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px]">College Code</span>
                        <span className="text-[#0F172A] dark:text-white font-mono font-bold text-sm mt-1 block">{aff.college_code || '--'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Department</span>
                        <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.department || '--'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Year & Semester</span>
                        <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">Year {profile.year || 1} (Semester {profile.semester || 1})</span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px]">College Roll Number</span>
                        <span className="text-[#0F172A] dark:text-white font-mono font-bold text-sm mt-1 block">{profile.roll_number || '--'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Verification Status</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border mt-1.5 ${
                          aff.status === 'VERIFIED' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'
                        }`}>
                          {aff.status || 'VERIFIED'}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Secondary Colleges List */}
                  {affiliations.filter(a => a.affiliation_type === 'college' && !a.is_primary).length > 0 && (
                    <div className="mt-3 space-y-2">
                      <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px] mb-2">Additional Colleges</span>
                      {affiliations.filter(a => a.affiliation_type === 'college' && !a.is_primary).map((aff) => (
                        <div key={aff.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1">🏛 {aff.college_name}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5 block">Secondary Affiliation</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => promoteAffiliation(aff.id)}
                              className="px-2 py-1 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-all inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> Set Primary
                            </button>
                            <button
                              onClick={() => deleteAffiliation(aff.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Read-only view: Subsection C */}
                <div className="pt-6 border-t border-[#E2E8F0] dark:border-[#334155]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-extrabold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">🏢 Organization</h3>
                    <button
                      onClick={() => setShowOrgModal(true)}
                      className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Organization
                    </button>
                  </div>

                  {affiliations.filter(a => a.affiliation_type === 'organization' && a.is_primary).map((aff) => (
                    <div key={aff.id} className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 mb-4 relative">
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Primary Organization</span>
                        <span className="text-[#0F172A] dark:text-white font-extrabold text-sm mt-1 flex items-center gap-1.5">
                          🏢 {aff.organization_name}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Designation</span>
                        <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.designation || '--'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Joined Date</span>
                        <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">2026-08-04</span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Verification Status</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border mt-1.5 ${
                          aff.status === 'VERIFIED' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'
                        }`}>
                          {aff.status || 'VERIFIED'}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Secondary Organizations List */}
                  {affiliations.filter(a => a.affiliation_type === 'organization' && !a.is_primary).length > 0 && (
                    <div className="mt-3 space-y-2">
                      <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[9px] mb-2">Additional Organizations</span>
                      {affiliations.filter(a => a.affiliation_type === 'organization' && !a.is_primary).map((aff) => (
                        <div key={aff.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1">🏢 {aff.organization_name}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5 block">Secondary Affiliation</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => promoteAffiliation(aff.id)}
                              className="px-2 py-1 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-all inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> Set Primary
                            </button>
                            <button
                              onClick={() => deleteAffiliation(aff.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Activity & Completed Labs */}
        <div id="statistics" className="space-y-6">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] shadow-xs transition-colors overflow-hidden">

            {/* Tab Header */}
            <div className="flex border-b border-[#E2E8F0] dark:border-[#334155]">
              <button
                onClick={() => setStatsTab('metrics')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-bold transition-all cursor-pointer ${statsTab === 'metrics' ? 'text-[#2563EB] border-b-2 border-[#2563EB] bg-blue-50/50 dark:bg-blue-950/20' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                <Activity className="w-3.5 h-3.5" /> Activity Graph
              </button>
              <button
                onClick={() => setStatsTab('labs')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-bold transition-all cursor-pointer ${statsTab === 'labs' ? 'text-[#2563EB] border-b-2 border-[#2563EB] bg-blue-50/50 dark:bg-blue-950/20' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                <Trophy className="w-3.5 h-3.5" /> Completed Labs
                {completedLabs.length > 0 && (
                  <span className="bg-[#2563EB] text-white text-[9px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {completedLabs.length}
                  </span>
                )}
              </button>
            </div>

            {/* Metrics + Spider Chart Tab */}
            {statsTab === 'metrics' && (
              <div className="p-5 space-y-5">

                {/* Key Metrics Row */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total Score', value: `${stats.total_score || 0} pts`, color: 'text-[#2563EB]', bg: 'bg-blue-50 dark:bg-blue-950/50', icon: <Trophy className="w-3.5 h-3.5" /> },
                    { label: 'Global Rank', value: `#${stats.global_rank || 1}`, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/50', icon: <Zap className="w-3.5 h-3.5" /> },
                    { label: 'Modules Done', value: `${stats.modules_completed || 0}`, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/50', icon: <Award className="w-3.5 h-3.5" /> },
                    { label: 'Training Hrs', value: `${stats.training_hours || 0} h`, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/50', icon: <Clock className="w-3.5 h-3.5" /> },
                    { label: 'Active Days', value: `${stats.current_streak_days || 0}`, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/50', icon: <Flame className="w-3.5 h-3.5" /> },
                    { label: 'Challenges', value: `${stats.challenges_solved || 0}`, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/50', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
                  ].map((m) => (
                    <div key={m.label} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col gap-1">
                      <div className={`w-7 h-7 rounded-lg ${m.bg} ${m.color} flex items-center justify-center`}>{m.icon}</div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">{m.label}</span>
                      <span className={`text-sm font-black ${m.color}`}>{m.value}</span>
                    </div>
                  ))}
                </div>

                {/* Spider Web Chart */}
                {activityGraph && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Activity Radar</h3>
                    <div className="flex justify-center">
                      {(() => {
                        const labels = activityGraph.labels as string[];
                        const values = activityGraph.values as number[];
                        const raw = activityGraph.raw as Record<string, number>;
                        const size = 220;
                        const cx = size / 2;
                        const cy = size / 2;
                        const R = 80;
                        const n = labels.length;
                        const levels = [20, 40, 60, 80, 100];

                        const toXY = (angleRad: number, r: number) => ({
                          x: cx + r * Math.sin(angleRad),
                          y: cy - r * Math.cos(angleRad)
                        });

                        const angles = labels.map((_, i) => (2 * Math.PI * i) / n);

                        const gridPolygons = levels.map((lvl) => {
                          const pts = angles.map(a => {
                            const p = toXY(a, (lvl / 100) * R);
                            return `${p.x},${p.y}`;
                          });
                          return pts.join(' ');
                        });

                        const dataPoints = angles.map((a, i) => {
                          const p = toXY(a, (values[i] / 100) * R);
                          return `${p.x},${p.y}`;
                        });

                        const axisLines = angles.map(a => ({
                          x2: toXY(a, R).x,
                          y2: toXY(a, R).y
                        }));

                        const rawKeys = ['modules', 'flags', 'hours', 'score', 'active_days'];

                        return (
                          <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ overflow: 'visible' }}>
                            {/* Grid rings */}
                            {gridPolygons.map((pts, li) => (
                              <polygon
                                key={li}
                                points={pts}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="0.5"
                                strokeDasharray="3,3"
                                className="text-slate-300 dark:text-slate-700"
                              />
                            ))}

                            {/* Axis lines */}
                            {axisLines.map((line, i) => (
                              <line
                                key={i}
                                x1={cx}
                                y1={cy}
                                x2={line.x2}
                                y2={line.y2}
                                stroke="currentColor"
                                strokeWidth="0.5"
                                className="text-slate-300 dark:text-slate-700"
                              />
                            ))}

                            {/* Data area */}
                            <polygon
                              points={dataPoints.join(' ')}
                              fill="rgba(37,99,235,0.18)"
                              stroke="#2563EB"
                              strokeWidth="2"
                              strokeLinejoin="round"
                            />

                            {/* Data dots */}
                            {angles.map((a, i) => {
                              const p = toXY(a, (values[i] / 100) * R);
                              return (
                                <circle
                                  key={i}
                                  cx={p.x}
                                  cy={p.y}
                                  r="4"
                                  fill="#2563EB"
                                  stroke="white"
                                  strokeWidth="1.5"
                                />
                              );
                            })}

                            {/* Labels */}
                            {angles.map((a, i) => {
                              const lp = toXY(a, R + 22);
                              const rawVal = raw[rawKeys[i]] ?? 0;
                              return (
                                <g key={i}>
                                  <text
                                    x={lp.x}
                                    y={lp.y - 5}
                                    textAnchor="middle"
                                    className="fill-slate-600 dark:fill-slate-300"
                                    style={{ fontSize: '9px', fontWeight: 700, fill: 'var(--radar-label, #64748B)' }}
                                  >
                                    {labels[i]}
                                  </text>
                                  <text
                                    x={lp.x}
                                    y={lp.y + 7}
                                    textAnchor="middle"
                                    style={{ fontSize: '8px', fontWeight: 900, fill: '#2563EB' }}
                                  >
                                    {rawVal}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Session Metadata */}
                <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#334155] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-[#64748B] dark:text-[#CBD5E1]">
                    <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-blue-500" /> Current IP</span>
                    <span className="font-mono font-bold text-[#0F172A] dark:text-white">{security.current_ip || '127.0.0.1'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#64748B] dark:text-[#CBD5E1]">
                    <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-purple-500" /> Browser</span>
                    <span className="font-semibold text-[#0F172A] dark:text-white">{security.current_user_agent?.split(' ')[0] || 'Web Browser'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#64748B] dark:text-[#CBD5E1]">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-emerald-500" /> Account Created</span>
                    <span className="font-semibold text-[#0F172A] dark:text-white">{stats.created_at || profile.created_at?.split(' ')[0] || '--'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Completed Labs Tab */}
            {statsTab === 'labs' && (
              <div className="p-5">
                {completedLabs.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <div className="text-4xl">🔬</div>
                    <p className="text-sm font-bold text-slate-400 dark:text-slate-500">No completed labs yet</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-600">Complete lab modules to see them here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {completedLabs.length} Lab{completedLabs.length !== 1 ? 's' : ''} Completed
                    </p>
                    {completedLabs.map((lab, idx) => {
                      const diffColor =
                        lab.difficulty === 'EASY' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60' :
                        lab.difficulty === 'MEDIUM' ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60' :
                        'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60';
                      return (
                        <div key={idx} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-start gap-3 hover:border-[#2563EB]/30 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm flex-shrink-0">
                            🧪
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-xs text-[#0F172A] dark:text-white truncate">{lab.name}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${diffColor}`}>
                                {lab.difficulty}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">{lab.category}</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-black text-[#2563EB]">+{lab.score} pts</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">{lab.completed_at || '--'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>

      {/* College Modal */}
      {showCollegeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-visible shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-[#2563EB]" /> Add Secondary College
              </h3>
              <button onClick={() => { setShowCollegeModal(false); setCollegeSearch(''); setSelectedCollege(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg">×</button>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <label className="font-bold text-xs text-slate-700 block mb-1">Search College</label>
                <div className="relative">
                  <input
                    type="text"
                    value={collegeSearch}
                    onChange={(e) => setCollegeSearch(e.target.value)}
                    placeholder="Type college name to search (e.g. ssm, iit)..."
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>

                {collegeResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {collegeResults.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => {
                          setSelectedCollege(col);
                          setCollegeResults([]);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0 flex items-start gap-2.5 transition-colors"
                      >
                        <span className="text-base mt-0.5">🏛</span>
                        <div>
                          <div className="font-extrabold text-xs text-slate-800 dark:text-slate-200">{col.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded text-slate-500">{col.code}</span>
                            <span>{col.city || ''}, {col.state || ''}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedCollege && (
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl p-4 space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <div className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px]">Preview Selected College</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <span>🏛</span> {selectedCollege.name}
                  </div>
                  <div><span className="text-slate-400">Code:</span> {selectedCollege.code}</div>
                  <div><span className="text-slate-400">Location:</span> {selectedCollege.city || 'Chennai'}, {selectedCollege.state || 'Tamil Nadu'}</div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowCollegeModal(false); setCollegeSearch(''); setSelectedCollege(null); }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCollegeSubmit}
                disabled={!selectedCollege}
                className="px-4 py-2 bg-[#2563EB] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                Confirm Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Org Modal */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-visible shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-[#2563EB]" /> Add Secondary Organization
              </h3>
              <button onClick={() => { setShowOrgModal(false); setTypedOrgName(''); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg">×</button>
            </div>
            
            <form onSubmit={handleAddOrgSubmit} className="space-y-4">
              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={typedOrgName}
                  onChange={(e) => setTypedOrgName(e.target.value)}
                  placeholder="Enter organization name..."
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
                />
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl p-3 text-[11px] font-semibold text-amber-800 dark:text-amber-300 leading-relaxed">
                ⚠️ Verification status will be set to PENDING. You can continue using the platform while verification is pending.
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowOrgModal(false); setTypedOrgName(''); }}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!typedOrgName.trim()}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  Confirm Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
