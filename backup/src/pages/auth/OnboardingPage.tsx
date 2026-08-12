import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, User, GraduationCap, Briefcase, Camera, Trash2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context';

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [colleges, setColleges] = useState<any[]>([]);

  const [accountType, setAccountType] = useState<'STUDENT' | 'INDIVIDUAL'>('STUDENT');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    username: user?.email ? user.email.split('@')[0] : '',
    phone: '',
    dob: '',
    gender: 'Male',
    country: 'India',
    state: '',
    city: '',
    
    // Individual
    profession: 'Security Analyst',
    organization: 'Enterprise CyberRange',
    experience: '1-2 Years',
    highest_qualification: "Bachelor's Degree",

    // Student
    college_id: '',
    department: 'Computer Science & Engineering',
    course: 'B.Tech Cybersecurity',
    year: 1,
    semester: 1,
    roll_number: '',
    section: 'A',
    professor: 'Dr. Alan Turing',
    batch: '2023-2027',
    student_id_num: '',
    profile_photo: ''
  });

  useEffect(() => {
    const fetchInitial = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // 1. Fetch colleges (independent of profile)
      try {
        const collegeRes = await fetch('/api/v1/reporting/colleges');
        if (collegeRes.ok) {
          const cData = await collegeRes.json();
          setColleges(cData);
          if (cData.length > 0 && !form.college_id) {
            setForm(prev => ({ ...prev, college_id: String(cData[0].id) }));
          }
        } else {
          console.error('Failed to load colleges: status', collegeRes.status);
        }
      } catch (err) {
        console.error('Error fetching colleges:', err);
      }

      // 2. Fetch profile
      try {
        const profileRes = await fetch('/api/v1/user/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (profileRes.ok) {
          const data = await profileRes.json();
          if (data.profile_completed) {
            navigate('/dashboard');
            return;
          }
          // Force account_type by role
          const computedType = data.role === 'admin' ? 'INDIVIDUAL' : 'STUDENT';
          setAccountType(computedType);
          setForm(prev => ({
            ...prev,
            name: data.name || user?.name || '',
            email: data.email || user?.email || '',
            username: data.email ? data.email.split('@')[0] : (user?.email?.split('@')[0] || ''),
            phone: data.phone || '',
            dob: data.dob || '',
            college_id: data.college_id ? String(data.college_id) : prev.college_id
          }));
          if (data.profile_photo) {
            setPhotoPreview(data.profile_photo);
          }
        } else {
          console.error('Failed to load profile: status', profileRes.status);
        }
      } catch (err) {
        console.error('Error loading profile options:', err);
      }
    };

    fetchInitial();
  }, [navigate, user]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setError('Image file size exceeds maximum 5 MB limit.');
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const token = localStorage.getItem('token');
    try {
      let uploadedPhotoUrl = form.profile_photo;

      if (photoFile) {
        const photoFormData = new FormData();
        photoFormData.append('file', photoFile);

        const photoRes = await fetch('/api/v1/user/profile/photo', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: photoFormData
        });

        if (!photoRes.ok) {
          const photoErr = await photoRes.json();
          throw new Error(photoErr.detail || 'Failed to upload profile photo.');
        }

        const photoData = await photoRes.json();
        uploadedPhotoUrl = photoData.profile_photo;
      }

      const payload = {
        ...form,
        profile_photo: uploadedPhotoUrl,
        account_type: accountType,
        college_id: accountType === 'STUDENT' && form.college_id ? parseInt(form.college_id) : null,
        year: parseInt(String(form.year)) || 1,
        semester: parseInt(String(form.semester)) || 1
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
        await refreshUser();
        navigate('/dashboard');
      } else {
        const errData = await res.json();
        setError(errData.detail || 'Failed to complete profile onboarding.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error during profile completion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-6 transition-colors">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl space-y-8 animate-in fade-in duration-300 transition-colors">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-[#2563EB] mb-2">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">CyberRange Mandatory Onboarding</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Please complete your profile onboarding before launching the range console.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* Account Type Selector (only shown if not explicitly determined by role) */}
        {!user?.role ? (
          <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <button
              type="button"
              onClick={() => setAccountType('STUDENT')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                accountType === 'STUDENT' ? 'bg-[#2563EB] text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-4 h-4" /> Student Account
            </button>

            <button
              type="button"
              onClick={() => setAccountType('INDIVIDUAL')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                accountType === 'INDIVIDUAL' ? 'bg-[#2563EB] text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Briefcase className="w-4 h-4" /> Individual / Professional
            </button>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs font-bold text-[#2563EB]">
            {user.role === 'admin' ? (
              <span className="flex items-center justify-center gap-2">
                <Briefcase className="w-4 h-4" /> Professional Profile Onboarding
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <GraduationCap className="w-4 h-4" /> Student Profile Onboarding
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          {/* PHOTO UPLOAD WIDGET */}
          <div className="flex flex-col items-center justify-center space-y-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-2xl shadow-xl overflow-hidden ring-4 ring-[#2563EB]/30">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  form.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'AO'
                )}
              </div>
              <label className="absolute bottom-0 right-0 p-2 bg-[#2563EB] text-white rounded-full shadow-lg cursor-pointer hover:bg-blue-600 transition-all">
                <Camera className="w-4 h-4" />
                <input 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Profile Avatar Photo</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">JPG, PNG or WEBP (Max 5 MB)</p>
            </div>
          </div>

          {/* SECTION 1: PERSONAL DETAILS */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-[#2563EB]" /> Personal Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Full Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Alex Operator"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Email Address (Read Only)</label>
                <input
                  type="email"
                  readOnly
                  value={form.email}
                  className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-500 dark:text-slate-400 font-semibold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Mobile Number *</label>
                <input
                  type="text"
                  name="phone"
                  required
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91 9876543210"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Date of Birth *</label>
                <input
                  type="date"
                  name="dob"
                  required
                  value={form.dob}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Gender *</label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Country *</label>
                <input
                  type="text"
                  name="country"
                  required
                  value={form.country}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">City / State *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="city"
                    required
                    placeholder="City"
                    value={form.city}
                    onChange={handleChange}
                    className="w-1/2 px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                  />
                  <input
                    type="text"
                    name="state"
                    required
                    placeholder="State"
                    value={form.state}
                    onChange={handleChange}
                    className="w-1/2 px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: CONDITIONAL STUDENT OR INDIVIDUAL DETAILS */}
          {accountType === 'STUDENT' ? (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#2563EB]" /> College & Academic Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">College / University *</label>
                  <select
                    name="college_id"
                    required
                    value={form.college_id}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                  >
                    <option value="">Select your institution</option>
                    {colleges.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Department *</label>
                  <input
                    type="text"
                    name="department"
                    required
                    value={form.department}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Degree / Course *</label>
                  <input
                    type="text"
                    name="course"
                    required
                    value={form.course}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Academic Year *</label>
                  <select
                    name="year"
                    value={form.year}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                  >
                    <option value={1}>Year 1</option>
                    <option value={2}>Year 2</option>
                    <option value={3}>Year 3</option>
                    <option value={4}>Year 4</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Semester *</label>
                  <select
                    name="semester"
                    value={form.semester}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Roll Number *</label>
                  <input
                    type="text"
                    name="roll_number"
                    required
                    value={form.roll_number}
                    onChange={handleChange}
                    placeholder="CS23B101"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Section & Batch</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="section"
                      placeholder="Sec (A)"
                      value={form.section}
                      onChange={handleChange}
                      className="w-1/2 px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                    />
                    <input
                      type="text"
                      name="batch"
                      placeholder="Batch (2023-2027)"
                      value={form.batch}
                      onChange={handleChange}
                      className="w-1/2 px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#2563EB]" /> Professional Demographics
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Profession / Role *</label>
                  <input
                    type="text"
                    name="profession"
                    required
                    value={form.profession}
                    onChange={handleChange}
                    placeholder="SOC Analyst"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Organization / Company *</label>
                  <input
                    type="text"
                    name="organization"
                    required
                    value={form.organization}
                    onChange={handleChange}
                    placeholder="CyberSecurity Inc"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Years of Experience *</label>
                  <select
                    name="experience"
                    value={form.experience}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                  >
                    <option value="Student / Beginner">Student / Beginner</option>
                    <option value="1-2 Years">1-2 Years</option>
                    <option value="3-5 Years">3-5 Years</option>
                    <option value="5+ Years">5+ Years</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Highest Qualification *</label>
                  <input
                    type="text"
                    name="highest_qualification"
                    required
                    value={form.highest_qualification}
                    onChange={handleChange}
                    placeholder="B.Tech / M.Tech / BSc"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#2563EB] hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? 'Saving Profile & Photo...' : 'Complete Profile & Launch Range Console'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
