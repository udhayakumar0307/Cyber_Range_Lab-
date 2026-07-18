import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Terminal, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const CommandLineLabSession: React.FC = () => {
  const navigate = useNavigate();
  const { token: contextToken } = useAuth();
  const token = contextToken || localStorage.getItem('token');

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-[#0F172A] dark:text-white transition-colors duration-200">
      {/* Header bar */}
      <header className="bg-white dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] px-6 py-4 flex items-center justify-between shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/labs')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#64748B] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-white transition-colors"
            title="Return to Labs Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="h-6 w-[1px] bg-[#E2E8F0] dark:bg-[#334155]"></div>
          
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#2563EB] text-white shadow-xs">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-[#0F172A] dark:text-white text-sm sm:text-base leading-none">Command Line Lab</h1>
              <span className="text-[10px] font-semibold text-[#64748B] dark:text-[#CBD5E1] uppercase tracking-wider">Linux Infrastructure</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 px-3 py-1 rounded-full flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping"></span>
            Active Session
          </span>
          
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs font-bold text-[#64748B] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-white px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Dashboard
          </button>
        </div>
      </header>

      {/* Embedded Lab IFrame */}
      <div className="flex-1 bg-slate-900 relative overflow-hidden">
        {token ? (
          <iframe
            src={`http://localhost:5000/?token=${token}`}
            className="w-full h-full border-0 absolute inset-0"
            title="Command Line Lab terminal interface"
            allow="clipboard-read; clipboard-write"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4 bg-white dark:bg-[#0F172A]">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-full">
              <Shield className="w-12 h-12" />
            </div>
            <h2 className="text-lg font-black text-[#0F172A] dark:text-white">Session Verification Failed</h2>
            <p className="text-sm text-[#64748B] dark:text-[#CBD5E1] max-w-md">
              Your authentication session token could not be verified. Please log in again to access the labs.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2 bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
