import { apiFetch as routedApiFetch, makeUnconfiguredOrgName, parseApiErrorMessage } from '../../lib/api';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, User, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';

import { useAuth } from '../../context';
import { PasswordStrengthMeter, evaluatePasswordPolicy } from '../../components/PasswordStrengthMeter';

export const AdminRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { setSessionToken } = useAuth();

  const [step, setStep] = useState<'form' | 'verification'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form inputs — kept intentionally minimal. Organization, address, GST and
  // designation are filled in later from the admin dashboard's "Update
  // Profile" prompt, once the account exists.
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const policy = evaluatePasswordPolicy(password, email, adminName);
    if (!policy.isValid) {
      setError('Password does not meet platform security requirements.');
      return;
    }

    setLoading(true);
    try {
      const res = await routedApiFetch('/api/v1/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_name: adminName,
          email,
          phone,
          password,
          // The backend's org/address fields are still required server-side —
          // this form just doesn't ask for them up front. primary_affiliation_type
          // "organization" (rather than the default "college") skips the
          // college_id requirement; a clearly-not-real name plus blank address
          // fields let the admin fill in the real institution later from
          // "Update Profile" without any backend change.
          primary_affiliation_type: 'organization',
          organization_name: makeUnconfiguredOrgName(email),
          institution_type: 'Company',
          address: '',
          country: '',
          state: '',
          city: '',
          pincode: ''
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(parseApiErrorMessage(data, 'Registration failed.'));
      }

      if (data.access_token) {
        await setSessionToken(data.access_token, data.user);
        localStorage.setItem('role', 'admin');
      }

      setStep('verification');
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">CyberRange Enterprise</h1>
              <p className="text-xs text-blue-100">Institutional Admin Account Registration</p>
            </div>
          </div>
          <Link
            to="/admin/login"
            className="text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Admin Login
          </Link>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                {error}
              </div>
            )}

            {/* Admin Profile & Credentials */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <User className="w-4 h-4 text-blue-600" />
                <span>Primary Admin Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Admin Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Alex Mercer"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="admin@institution.ac.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Set Account Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                  <PasswordStrengthMeter password={password} email={email} username={adminName} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[11px] font-bold text-rose-500 mt-1">Passwords do not match</p>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[11px] font-semibold text-slate-400 text-center leading-relaxed">
              You can add your institution, address and other organization details later from your admin dashboard.
            </p>

            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Already registered?{' '}
                <Link to="/admin/login" className="text-blue-600 font-bold hover:underline">
                  Sign in
                </Link>
              </span>

              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md inline-flex items-center gap-2 disabled:opacity-50"
              >
                <span>{loading ? 'Registering Account...' : 'Create Admin Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Registration Complete!</h2>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-md mx-auto">
                We have sent a verification code to <span className="font-bold text-slate-700">{email}</span>. Please verify your email address to activate all administrative privileges.
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-8 py-3 rounded-xl shadow-md transition-all inline-flex items-center gap-2"
              >
                <span>Go to Admin Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
