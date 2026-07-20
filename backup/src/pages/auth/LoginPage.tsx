import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, Eye, EyeOff, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [activeTab, setActiveTab] = useState<'standard' | 'sso'>('standard');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const { role } = await login(email, password);
      setIsLoading(false);
      if (role && role.toLowerCase() === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/labs');
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Invalid Email or Password.');
    }
  };

  const handleSsoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('Enterprise SSO is not configured. Please use Standard Account.');
  };

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
            <h1 className="text-3xl font-black text-[#0F172A] dark:text-white tracking-tight">
              CyberRange
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-[#64748B] dark:text-[#CBD5E1] mt-1">
              Enterprise Cyber Operations & Training Platform
            </p>
          </div>
        </div>

        {/* Glassmorphic Auth Card */}
        <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-3xl p-8 sm:p-10 shadow-xl space-y-6 transition-colors">
          {/* Tab Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-bold relative">
            <button
              onClick={() => setActiveTab('standard')}
              className={`py-2.5 rounded-xl transition-all ${
                activeTab === 'standard'
                  ? 'bg-white dark:bg-slate-900 text-[#2563EB] dark:text-white shadow-xs'
                  : 'text-[#64748B] dark:text-[#CBD5E1] hover:text-[#0F172A]'
              }`}
            >
              Standard Account
            </button>
            <button
              onClick={() => setActiveTab('sso')}
              className={`py-2.5 rounded-xl transition-all ${
                activeTab === 'sso'
                  ? 'bg-white dark:bg-slate-900 text-[#2563EB] dark:text-white shadow-xs'
                  : 'text-[#64748B] dark:text-[#CBD5E1] hover:text-[#0F172A]'
              }`}
            >
              Enterprise SSO
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold text-center">
              {errorMsg}
            </div>
          )}

          {activeTab === 'standard' && (
            <form onSubmit={handleStandardSubmit} className="space-y-4">
              <div>
                <label className="font-bold text-xs text-[#0F172A] dark:text-white block mb-1">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="analyst@cybersec.io"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs font-semibold text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Authenticating...
                  </>
                ) : (
                  <>
                    Sign In to Portal <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {activeTab === 'sso' && (
            <form onSubmit={handleSsoSubmit} className="space-y-4">
              <div>
                <label className="font-bold text-xs text-[#0F172A] dark:text-white block mb-1">
                  Organization Domain / Email
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    required
                    value={ssoDomain}
                    onChange={(e) => setSsoDomain(e.target.value)}
                    placeholder="company.com or name@company.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs font-semibold text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-[#CBD5E1] mt-1">
                  We'll redirect you to your organization's SAML 2.0 / Okta IDP provider.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Connecting to SAML SSO...
                  </>
                ) : (
                  <>
                    Continue with Single Sign-On <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="text-center pt-2 border-t border-[#E2E8F0] dark:border-[#334155]">
            <p className="text-xs text-[#64748B] dark:text-[#CBD5E1] font-medium">
              Don't have an enterprise account?{' '}
              <Link to="/register" className="font-bold text-[#2563EB] hover:underline">
                Create new account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
