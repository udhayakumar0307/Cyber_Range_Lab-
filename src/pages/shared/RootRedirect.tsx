import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, UserCheck, LogIn } from 'lucide-react';

export const RootRedirect: React.FC = () => {
  const navigate = useNavigate();
  const [simulatedRole, setSimulatedRole] = useState<'admin' | 'user' | 'guest'>('admin');
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleProceed = (roleToUse: 'admin' | 'user' | 'guest') => {
    setIsRedirecting(true);
    setTimeout(() => {
      if (roleToUse === 'admin') {
        navigate('/admin/dashboard');
      } else if (roleToUse === 'user') {
        navigate('/dashboard');
      } else {
        navigate('/login');
      }
    }, 400);
  };

  useEffect(() => {
    // Default auto-redirect after brief landing animation
    const timer = setTimeout(() => {
      handleProceed(simulatedRole);
    }, 1500);

    return () => clearTimeout(timer);
  }, [simulatedRole]);

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
            CyberRange Platform Auth Gateway
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
            {isRedirecting ? 'Redirecting...' : `Evaluating Role: ${simulatedRole.toUpperCase()}`}
          </span>
        </div>

        {/* Interactive Role Selector Sandbox Toolbar */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Dev Sandbox: Test Role Landing Override
          </span>
          <div className="grid grid-cols-3 gap-2 text-xs font-bold">
            <button
              onClick={() => {
                setSimulatedRole('admin');
                handleProceed('admin');
              }}
              className={`p-2.5 rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                simulatedRole === 'admin'
                  ? 'bg-blue-50 text-[#0052CC] border-blue-300 ring-2 ring-[#0052CC]/15 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Shield className="w-3.5 h-3.5" /> Admin Portal
            </button>

            <button
              onClick={() => {
                setSimulatedRole('user');
                handleProceed('user');
              }}
              className={`p-2.5 rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                simulatedRole === 'user'
                  ? 'bg-emerald-50 text-[#28A745] border-emerald-300 ring-2 ring-emerald-500/15 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" /> User View
            </button>

            <button
              onClick={() => {
                setSimulatedRole('guest');
                handleProceed('guest');
              }}
              className={`p-2.5 rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                simulatedRole === 'guest'
                  ? 'bg-purple-50 text-[#6F42C1] border-purple-300 ring-2 ring-purple-500/15 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" /> Login Flow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
