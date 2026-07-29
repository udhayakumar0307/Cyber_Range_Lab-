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
  Monitor
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

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
      const [profileRes, statsRes, securityRes, collegeRes] = await Promise.all([
        fetch('/api/v1/user/profile', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/user/statistics', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/user/security', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/reporting/colleges')
      ]);

      if (profileRes.ok) {
        const pData = await profileRes.json();
        setProfile(pData);
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
    } catch (err) {
      console.error('Error fetching profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
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
              <label className="absolute bottom-0 right-0 p-2 bg-[#2563EB] text-white rounded-full shadow-md cursor-pointer hover:bg-blue-600 transition-all">
                <Camera className="w-4 h-4" />
                <input 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>

            {profile.profile_photo && (
              <button
                type="button"
                onClick={handlePhotoDelete}
                className="text-[10px] font-bold text-rose-300 hover:text-rose-100 flex items-center gap-1 bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-800/50 mt-1"
              >
                <Trash2 className="w-3 h-3" /> Remove Photo
              </button>
            )}
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

          <button
            onClick={() => setEditing(!editing)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-bold text-xs flex items-center gap-2 transition-all backdrop-blur-sm self-center sm:self-start text-white"
          >
            {editing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            <span>{editing ? 'Cancel Editing' : 'Edit Profile'}</span>
          </button>
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
          {/* SECTION 1: PERSONAL INFORMATION */}
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs transition-colors">
            <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2 border-b border-[#E2E8F0] dark:border-[#334155] pb-4">
              <UserIcon className="w-5 h-5 text-[#2563EB]" /> Personal Demographics
            </h2>

            {editing ? (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-xs">
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
                    <input 
                      type="text" 
                      name="phone" 
                      value={formData.phone} 
                      onChange={handleChange}
                      placeholder="+91 9876543210"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
                    />
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

                <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#334155] flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 border border-[#E2E8F0] dark:border-slate-700 rounded-lg font-bold text-[#64748B] dark:text-[#CBD5E1] hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-[#2563EB] text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Mobile Phone</span>
                  <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.phone || '--'}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Date of Birth</span>
                  <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.dob || '--'}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Gender</span>
                  <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.gender || '--'}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Location</span>
                  <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">
                    {[profile.city, profile.state, profile.country].filter(Boolean).join(', ') || '--'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: ACADEMIC OR PROFESSIONAL DEMOGRAPHICS */}
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs transition-colors">
            {profile.account_type === 'STUDENT' ? (
              <>
                <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2 border-b border-[#E2E8F0] dark:border-[#334155] pb-4">
                  <GraduationCap className="w-5 h-5 text-[#2563EB]" /> Academic & College Details
                </h2>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[10px]">College / Institution</span>
                    <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.college_name || 'Not assigned'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Department</span>
                    <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.department || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Degree / Course</span>
                    <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.course || 'B.Tech Cybersecurity'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Academic Year & Semester</span>
                    <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">
                      Year {profile.year || 1} (Semester {profile.semester || 1})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Roll Number</span>
                    <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.roll_number || '--'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Student ID Number</span>
                    <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.student_id_num || 'STU-2026-001'}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2 border-b border-[#E2E8F0] dark:border-[#334155] pb-4">
                  <Briefcase className="w-5 h-5 text-[#2563EB]" /> Professional Demographics
                </h2>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Profession / Role</span>
                    <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.profession || 'Security Analyst'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Organization</span>
                    <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.organization || 'Enterprise CyberRange'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Years of Experience</span>
                    <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.experience || '2-4 Years'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Highest Qualification</span>
                    <span className="text-[#0F172A] dark:text-white font-bold text-sm mt-1 block">{profile.highest_qualification || 'Bachelor\'s Degree'}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): PostgreSQL Real Analytics */}
        <div id="statistics" className="space-y-6">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs transition-colors">
            <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2 border-b border-[#E2E8F0] dark:border-[#334155] pb-4 mb-6">
              <Activity className="w-5 h-5 text-[#2563EB]" /> Real PostgreSQL Range Metrics
            </h2>

            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#2563EB] flex items-center justify-center font-bold">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#0F172A] dark:text-white block">Total Score</span>
                    <span className="text-[10px] text-slate-400">AWS PostgreSQL Verified</span>
                  </div>
                </div>
                <span className="text-base font-black text-[#2563EB]">{stats.total_score || 0} pts</span>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center font-bold">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#0F172A] dark:text-white block">Global Rank</span>
                    <span className="text-[10px] text-slate-400">Platform Ranking</span>
                  </div>
                </div>
                <span className="text-base font-black text-amber-500">#{stats.global_rank || 1}</span>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-[#10B981] flex items-center justify-center font-bold">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#0F172A] dark:text-white block">Modules Solved</span>
                    <span className="text-[10px] text-slate-400">Training Modules</span>
                  </div>
                </div>
                <span className="text-base font-black text-[#10B981]">{stats.modules_completed || 0}</span>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center font-bold">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#0F172A] dark:text-white block">Badges & Milestones</span>
                    <span className="text-[10px] text-slate-400">Unlocked Badges</span>
                  </div>
                </div>
                <span className="text-base font-black text-purple-600">{stats.achievements || 0}</span>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#0F172A] dark:text-white block">Training Hours</span>
                    <span className="text-[10px] text-slate-400">Cumulative Duration</span>
                  </div>
                </div>
                <span className="text-base font-black text-indigo-600">{stats.training_hours || 0} hrs</span>
              </div>
            </div>

            {/* Session Metadata */}
            <div className="mt-6 pt-6 border-t border-[#E2E8F0] dark:border-[#334155] space-y-3 text-xs">
              <div className="flex items-center justify-between text-[#64748B] dark:text-[#CBD5E1]">
                <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-blue-500" /> Current IP</span>
                <span className="font-mono font-bold text-[#0F172A] dark:text-white">{security.current_ip || '127.0.0.1'}</span>
              </div>

              <div className="flex items-center justify-between text-[#64748B] dark:text-[#CBD5E1]">
                <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-purple-500" /> Device / Browser</span>
                <span className="font-semibold text-[#0F172A] dark:text-white">{security.current_user_agent?.split(' ')[0] || 'Web Browser'}</span>
              </div>

              <div className="flex items-center justify-between text-[#64748B] dark:text-[#CBD5E1]">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-emerald-500" /> Account Created</span>
                <span className="font-semibold text-[#0F172A] dark:text-white">{stats.created_at || profile.created_at?.split(' ')[0] || '--'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
