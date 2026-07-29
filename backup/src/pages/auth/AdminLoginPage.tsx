import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, ArrowRight, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, setSessionToken } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLockedOut, setIsLockedOut] = useState(false);

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLockedOut(false);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please complete all admin credential fields.');
      return;
    }

    setIsLoading(true);
    try {
      const { role } = await login(email.trim(), password, rememberMe, 'admin');
      setIsLoading(false);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setIsLoading(false);
      if (err.message && err.message.includes('locked')) {
        setIsLockedOut(true);
      }
      setErrorMsg(err.message || 'Invalid Official Admin Credentials.');
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setErrorMsg('');
    try {
      const res = await fetch(`/api/v1/auth/oauth/${provider}?role=admin`);
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

  const isStudentRedirect = errorMsg.includes('CyberRange administrators') || errorMsg.includes('only for CyberRange');

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0F172A] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="w-full max-w-[460px] mx-auto z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0052CC] text-white shadow-xl shadow-blue-600/20">
            <ShieldCheck className="w-9 h-9" />
          </div>

          <div>
            <div className="inline-flex items-center gap-2 bg-blue-50 text-[#0052CC] border border-blue-100 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              Enterprise Protected Console
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              CyberRange Enterprise Console
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Authorized CyberRange Internal Staff & Enterprise Administration
            </p>
          </div>
        </div>

        {/* Auth Box */}
        <div className="bg-white border border-slate-200 backdrop-blur-xl rounded-3xl p-8 sm:p-10 shadow-xl space-y-6">
          {errorMsg && (
            <div className={`p-4 border rounded-2xl text-xs font-semibold text-center space-y-2 ${
              isLockedOut 
                ? 'bg-amber-50 border-amber-200 text-amber-800' 
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              <div className="flex items-center justify-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              {isStudentRedirect && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                  >
                    Go to Student Portal <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Official CyberRange Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="admin@cyberrange.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0052CC] focus:bg-white transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Strictly restricted to @cyberrange.in employee credentials
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Enterprise Password
                </label>
                <Link
                  to="/admin/forgot-password"
                  className="text-xs font-semibold text-[#0052CC] hover:underline"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0052CC] focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
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
                <span className="text-xs font-semibold text-slate-600">Remember me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || isLockedOut}
              className="w-full py-3 bg-[#0052CC] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {isLoading ? (
                <span>Authenticating Enterprise Admin...</span>
              ) : (
                <>
                  <span>Sign In to Enterprise Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* OAuth Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-slate-400 font-semibold">Or Admin Google Sign-In</span>
              </div>
            </div>

            {/* Google Identity Services Button */}
            <GoogleSignInButton
              portal="admin"
              buttonText="Continue with CyberRange Google"
              onSuccess={(data) => {
                navigate('/admin/dashboard');
              }}
              onError={(err) => setErrorMsg(err)}
            />
          </form>

          <div className="pt-4 border-t border-slate-100 text-center space-y-1.5">
            <p className="text-xs text-slate-500">
              Need to register your organization?{' '}
              <Link to="/admin/register" className="font-bold text-[#0052CC] hover:underline">
                Admin Registration
              </Link>
            </p>
            <p className="text-[11px] text-slate-500">
              Student account holder?{' '}
              <Link to="/login" className="font-bold text-blue-600 hover:underline">
                Go to CyberRange Student Portal
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400">
          CyberRange Security Platform &copy; 2026. Confidential Admin Console.
        </p>
      </div>
    </div>
  );
};
