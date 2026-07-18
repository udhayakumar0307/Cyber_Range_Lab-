import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, User, Mail, Lock, Building, ArrowLeft } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<'details' | 'otp'>('details');

  // Form inputs
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [password, setPassword] = useState('');
  
  // Student Specifics
  const [accountType, setAccountType] = useState<'STUDENT' | 'INDIVIDUAL'>('INDIVIDUAL');
  const [collegeId, setCollegeId] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  
  const [colleges, setColleges] = useState<Array<{ id: number, name: string, code: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 6-Digit OTP state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // 45s Cooldown Timer
  const [resendTimer, setResendTimer] = useState(45);
  const [isResendDisabled, setIsResendDisabled] = useState(true);

  // Load Colleges
  useEffect(() => {
    fetch('/api/v1/reporting/colleges')
      .then((res) => res.json())
      .then((data) => setColleges(data))
      .catch((err) => console.error('Failed to load colleges list:', err));
  }, []);

  useEffect(() => {
    let interval: any = null;
    if (step === 'otp' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setIsResendDisabled(false);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) return;

    setIsLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: fullName,
          email: email,
          password: password,
          account_type: accountType,
          college_id: accountType === 'STUDENT' && collegeId ? parseInt(collegeId) : null,
          department: accountType === 'STUDENT' ? department : null,
          year: accountType === 'STUDENT' && year ? parseInt(year) : null,
          roll_number: accountType === 'STUDENT' ? rollNumber : null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      setIsLoading(false);
      setStep('otp');
      setResendTimer(45);
      setIsResendDisabled(true);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'An error occurred during registration.');
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-advance focus to next digit
    if (value && index < 5) {
      otpInputRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs[index - 1].current?.focus();
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = otp.join('');
    if (fullCode.length !== 6) return;

    setIsLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          otp_code: fullCode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'OTP verification failed');
      }

      const data = await response.json();
      setIsLoading(false);

      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      window.location.href = '/dashboard';
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'OTP verification failed. Please try again.');
    }
  };

  const handleResendCode = () => {
    if (isResendDisabled) return;
    setOtp(['', '', '', '', '', '']);
    setResendTimer(45);
    setIsResendDisabled(true);
    otpInputRefs[0].current?.focus();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#2D3436] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Ambient Mesh Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[450px] h-[450px] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-15%] left-[-15%] w-[550px] h-[550px] bg-purple-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse"></div>

      <div className="w-full max-w-[480px] mx-auto z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0052CC] to-[#6F42C1] text-white shadow-lg shadow-blue-500/20">
            <Shield className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight bg-gradient-to-r from-slate-900 to-[#0052CC] bg-clip-text text-transparent">
              {step === 'details' ? 'Create Account' : 'Verify Email Address'}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
              {step === 'details'
                ? 'Join the CyberRange security operations platform'
                : `We sent a 6-digit code to ${email}`}
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-3xl p-8 sm:p-10 shadow-xl space-y-6">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold text-center">
              {errorMsg}
            </div>
          )}
          {step === 'details' ? (
            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Mercer"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1">Work Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="a.mercer@cybersec.io"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1.5">Account Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAccountType('INDIVIDUAL')}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                      accountType === 'INDIVIDUAL'
                        ? 'border-[#0052CC] bg-[#0052CC]/5 text-[#0052CC]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Individual Learner
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType('STUDENT')}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                      accountType === 'STUDENT'
                        ? 'border-[#0052CC] bg-[#0052CC]/5 text-[#0052CC]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    College Student
                  </button>
                </div>
              </div>

              {accountType === 'STUDENT' ? (
                <div className="space-y-4 border-l-2 border-slate-200 pl-4 py-1 my-2 animate-in slide-in-from-left-2 duration-200">
                  <div>
                    <label className="font-bold text-xs text-slate-700 block mb-1">Select College</label>
                    <select
                      required
                      value={collegeId}
                      onChange={(e) => setCollegeId(e.target.value)}
                      className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
                    >
                      <option value="">-- Choose Your College --</option>
                      {colleges.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.name} ({col.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-xs text-slate-700 block mb-1">Department</label>
                      <input
                        type="text"
                        required
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="CSE / IT"
                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-xs text-slate-700 block mb-1">Academic Year</label>
                      <select
                        required
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
                      >
                        <option value="">Year</option>
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-xs text-slate-700 block mb-1">Roll / Registration Number</label>
                    <input
                      type="text"
                      required
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      placeholder="e.g. CS23B045"
                      className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="font-bold text-xs text-slate-700 block mb-1">Organization / Enterprise Name</label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="Acme Cyber Defense Corp"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Preparing Verification...
                  </>
                ) : (
                  'Create Secure Account'
                )}
              </button>
            </form>
          ) : (
            /* Step 2: 6-Digit OTP Verification Grid */
            <form onSubmit={handleOtpSubmit} className="space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-center gap-3">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={otpInputRefs[idx]}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-12 h-14 bg-slate-50 border border-slate-200 rounded-xl text-center font-black text-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC] transition-all"
                  />
                ))}
              </div>

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={isLoading || otp.join('').length !== 6}
                  className="w-full py-3.5 bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isLoading ? 'Verifying Code...' : 'Confirm Verification Code'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isResendDisabled}
                    className="text-xs font-bold text-[#0052CC] disabled:text-slate-400 hover:underline transition-all"
                  >
                    {isResendDisabled ? `Resend Code in ${resendTimer}s` : 'Resend Verification Code'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Footer Back Button */}
          <div className="text-center pt-2">
            {step === 'otp' ? (
              <button
                type="button"
                onClick={() => setStep('details')}
                className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to details
              </button>
            ) : (
              <p className="text-xs font-semibold text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="font-bold text-[#0052CC] hover:underline">
                  Sign In
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
