import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [isTokenExpired, setIsTokenExpired] = useState(searchParams.get('token') === 'expired');
  const [errorMsg, setErrorMsg] = useState('');
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Strength rules
  const hasMinLength = newPassword.length >= 8;
  const hasNumber = /\d/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const isMatching = newPassword.length > 0 && newPassword === confirmPassword;

  const strengthCount = [hasMinLength, hasNumber, hasSpecial].filter(Boolean).length;

  const getStrengthLabel = () => {
    if (strengthCount === 0) return { label: 'Empty', color: 'bg-slate-200', width: 'w-0' };
    if (strengthCount === 1) return { label: 'Weak', color: 'bg-rose-500', width: 'w-1/3' };
    if (strengthCount === 2) return { label: 'Medium', color: 'bg-amber-500', width: 'w-2/3' };
    return { label: 'Strong', color: 'bg-[#28A745]', width: 'w-full' };
  };

  const strengthInfo = getStrengthLabel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!hasMinLength || !hasNumber || !hasSpecial || !isMatching) return;
    if (!token) {
      setIsTokenExpired(true);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.message && (data.message.toLowerCase().includes('expired') || data.message.toLowerCase().includes('token'))) {
          setIsTokenExpired(true);
          return;
        }
        throw new Error(data.message || 'Failed to reset password.');
      }
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#2D3436] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Ambient Mesh Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[450px] h-[450px] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-15%] left-[-15%] w-[550px] h-[550px] bg-purple-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse"></div>

      <div className="w-full max-w-[460px] mx-auto z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0052CC] to-[#6F42C1] text-white shadow-lg shadow-blue-500/20">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight bg-gradient-to-r from-slate-900 to-[#0052CC] bg-clip-text text-transparent">
              Set New Password
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
              Create a strong credentials passcode
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-3xl p-8 sm:p-10 shadow-xl space-y-6">
          {/* Expired Token Error Handler View */}
          {isTokenExpired ? (
            <div className="text-center space-y-4 py-2 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 shadow-xs">
                <AlertTriangle className="w-9 h-9" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900">Reset Link Expired</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  This security password reset link has expired or has already been consumed.
                </p>
              </div>

              <Link
                to="/forgot-password"
                className="w-full py-3.5 bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all inline-block"
              >
                Request New Password Reset Link
              </Link>
            </div>
          ) : isSuccess ? (
            /* Success Feedback View */
            <div className="text-center space-y-4 py-2 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#28A745] flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
                <CheckCircle2 className="w-9 h-9 text-[#28A745]" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900">Password Updated!</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Your platform password has been reset successfully. You can now log in with your new credentials.
                </p>
              </div>

              <Link
                to="/login"
                className="w-full py-3.5 bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all inline-block text-center"
              >
                Proceed to Login
              </Link>
            </div>
          ) : (
            /* Form View */
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold text-center">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1">New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
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

              {/* Dynamic Strength Meter Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <span className="text-slate-500">Password Complexity:</span>
                  <span className="text-slate-800">{strengthInfo.label}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-300 ${strengthInfo.color} ${strengthInfo.width}`}></div>
                </div>
              </div>

              {/* Requirements Checklist */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  {hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5 text-[#28A745]" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                  <span className={hasMinLength ? 'text-slate-800 font-bold' : 'text-slate-400'}>
                    At least 8 characters long
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {hasNumber ? <CheckCircle2 className="w-3.5 h-3.5 text-[#28A745]" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                  <span className={hasNumber ? 'text-slate-800 font-bold' : 'text-slate-400'}>
                    Includes at least 1 number (0-9)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {hasSpecial ? <CheckCircle2 className="w-3.5 h-3.5 text-[#28A745]" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                  <span className={hasSpecial ? 'text-slate-800 font-bold' : 'text-slate-400'}>
                    Includes special character (!@#$%^&*)
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1">Confirm New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
                  />
                </div>
                {confirmPassword && (
                  <p className={`text-[11px] font-bold mt-1 ${isMatching ? 'text-[#28A745]' : 'text-rose-500'}`}>
                    {isMatching ? '✓ Passwords match' : '✕ Passwords do not match'}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !hasMinLength || !hasNumber || !hasSpecial || !isMatching}
                className="w-full py-3.5 bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Updating Security Key...
                  </>
                ) : (
                  'Reset & Save New Password'
                )}
              </button>
            </form>
          )}

          {/* Footer Navigation */}
          <div className="text-center pt-2 border-t border-slate-100">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#0052CC] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
