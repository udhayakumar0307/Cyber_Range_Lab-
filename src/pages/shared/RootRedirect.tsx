import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '../../context';

export const RootRedirect: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        if (user.role && user.role.toLowerCase() === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#2D3436] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 max-w-lg w-full shadow-lg space-y-6 animate-in fade-in zoom-in-95">
        {/* Animated Shield Brand Emblem */}
        <div className="w-20 h-20 rounded-3xl bg-blue-50 text-[#0052CC] border border-blue-100 flex items-center justify-center mx-auto shadow-xs relative group">
          <Shield className="w-10 h-10 animate-shield text-[#0052CC]" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-[#28A745]"></span>
          </span>
        </div>

        <div>
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#0052CC] bg-blue-50 px-3 py-1 rounded-full border border-blue-100 inline-block mb-2">
            CyberRange Platform Gateway
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Authenticating Active Session
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed font-normal">
            Validating session tokens and redirecting to your role-based portal destination...
          </p>
        </div>

        {/* Loading Spinner / Progress */}
        <div className="py-2 flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-3 border-[#0052CC] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-600">
            Evaluating Role...
          </span>
        </div>
      </div>
    </div>
  );
};
