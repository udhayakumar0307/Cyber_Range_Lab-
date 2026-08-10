import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, Eye, EyeOff, Building2 } from 'lucide-react';
import { useAuth } from '../../context';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [activeTab, setActiveTab] = useState<'standard' | 'sso'>('standard');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [ssoDomain, setSsoDomain] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please complete all credential fields.');
      return;
    }

    setIsLoading(true);
    try {
      const { role } = await login(email, password, rememberMe, 'student');
      setIsLoading(false);
      if (role && (role.toLowerCase() === 'admin' || role.toLowerCase() === 'super_admin')) {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('[LoginPage] Login error:', err);
      setIsLoading(false);
      setErrorMsg(err.message || 'Invalid Email or Password.');
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setErrorMsg('');
    try {
      const res = await fetch(`/api/v1/auth/oauth/${provider}?role=student`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setErrorMsg(`Failed to initiate ${provider} authentication.`);
      }
    } catch (e: any) {
      setErrorMsg(`OAuth initialization failed: ${e.message}`);
    }
  };

  const handleSsoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('Institutional SSO is currently unavailable. Please use your standard student login.');
  };

  const isEnterpriseRedirect = errorMsg.includes('Enterprise Portal') || errorMsg.includes('only for students');

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-[#0F172A] dark:text-white flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-200">
      {/* Ambient Mesh Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[450px] h-[450px] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-15%] left-[-15%] w-[550px] h-[550px] bg-purple-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse"></div>

      <div className="w-full max-w-[460px] mx-auto z-10 space-y-6">
        {/* Brand Logo & Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#2563EB] text-white shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform cursor-pointer">
            <Shield className="w-8 h-8" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded-full text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
              Student Training Portal
            </div>
            <h1 className="text-3xl font-black text-[#0F172A] dark:text-white tracking-tight">
              CyberRange Student Portal
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-[#64748B] dark:text-[#CBD5E1] mt-1">
              Cybersecurity Training, Wargames & Hands-on Labs
            </p>
          </div>
        </div>

        {/* Glassmorphic Auth Card */}
        <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-3xl p-8 sm:p-10 shadow-xl space-y-6 transition-colors">
          {errorMsg && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 rounded-2xl text-xs font-semibold text-center space-y-2">
              <div>{errorMsg}</div>
              {isEnterpriseRedirect && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/admin/login')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                  >
                    Go to Enterprise Console <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleStandardSubmit} className="space-y-4">
            <div>
              <label className="font-bold text-xs text-[#0F172A] dark:text-white block mb-1">
                Student Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@college.edu or analyst@gmail.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs font-semibold text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1">
                Supports all personal, institutional, and organization email domains.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-xs text-[#0F172A] dark:text-white">Account Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-bold text-[#2563EB] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs font-semibold text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2563EB]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Remember me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Authenticating Student Portal...
                </>
              ) : (
                <>
                  Sign In to Student Portal <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* OAuth Providers Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-[#1E293B] px-3 text-slate-400 font-semibold">Or continue with Google</span>
              </div>
            </div>

            {/* Google Identity Services Button */}
            <GoogleSignInButton
              portal="student"
              buttonText="Continue with Google"
              onSuccess={(data) => {
                if (data.role && (data.role.toLowerCase() === 'admin' || data.role.toLowerCase() === 'super_admin')) {
                  navigate('/admin/dashboard');
                } else {
                  navigate('/dashboard');
                }
              }}
              onError={(err) => setErrorMsg(err)}
            />
          </form>

          <div className="text-center pt-3 border-t border-[#E2E8F0] dark:border-[#334155]">
            <p className="text-xs text-[#64748B] dark:text-[#CBD5E1] font-medium">
              Don't have a student account?{' '}
              <Link to="/register" className="font-bold text-[#2563EB] hover:underline">
                Create student account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
