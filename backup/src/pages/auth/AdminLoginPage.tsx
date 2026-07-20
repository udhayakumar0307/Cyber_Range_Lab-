import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, Eye, EyeOff, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setSessionToken } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const res = await fetch('/api/v1/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          setIsLockedOut(true);
        }
        throw new Error(data.detail || 'Admin authentication failed.');
      }

      if (data.access_token) {
        setSessionToken(data.access_token, data.user);
        localStorage.setItem('role', 'admin');
      }

      setIsLoading(false);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Invalid Official Admin Credentials.');
    }
  };

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
              Protected Portal
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Admin Portal
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Authorized CyberRange Administration Login
            </p>
          </div>
        </div>

        {/* Auth Box */}
        <div className="bg-white border border-slate-200 backdrop-blur-xl rounded-3xl p-8 sm:p-10 shadow-xl space-y-6">
          {errorMsg && (
            <div className={`p-3.5 border rounded-2xl text-xs font-bold text-center flex items-center justify-center gap-2 ${
              isLockedOut 
                ? 'bg-amber-50 border-amber-200 text-amber-800' 
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Official Email
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
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <Link
                  to="/adminform/forgot-password"
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

            <button
              type="submit"
              disabled={isLoading || isLockedOut}
              className="w-full py-3 bg-[#0052CC] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 mt-6 cursor-pointer"
            >
              {isLoading ? (
                <span>Authenticating Admin...</span>
              ) : (
                <>
                  <span>Sign In as Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Need to register your organization?{' '}
              <Link to="/adminform/register" className="font-bold text-[#0052CC] hover:underline">
                Admin Registration
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
