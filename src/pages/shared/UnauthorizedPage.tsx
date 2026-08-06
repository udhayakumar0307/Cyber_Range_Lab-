import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, ShieldAlert, Home, Send, CheckCircle2 } from 'lucide-react';

export const UnauthorizedPage: React.FC = () => {
  const [isRequested, setIsRequested] = useState(false);

  const handleRequestAccess = () => {
    setIsRequested(true);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#2D3436] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 max-w-lg w-full shadow-lg space-y-6 animate-in fade-in zoom-in-95">
        {/* Visual 403 Icon */}
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-3xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-12 h-12 text-rose-600" />
          </div>
          <span className="absolute -bottom-2 -right-2 text-xs font-black bg-slate-900 text-white px-2.5 py-0.5 rounded-full shadow-xs">
            403
          </span>
        </div>

        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-rose-600 block mb-1">
            HTTP 403 — Access Control Restriction
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Administrative Access Denied
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
            You do not possess the required administrator security role to access this restricted route.
          </p>
        </div>

        {/* Permission Info Box */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs text-left">
          <div className="flex items-center justify-between font-bold text-slate-800 border-b border-slate-200 pb-1.5">
            <span className="flex items-center gap-1.5 text-slate-700">
              <ShieldAlert className="w-4 h-4 text-amber-500" /> Insufficient Account Privileges
            </span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Admin modules require elevated administrative permissions. If you believe this is an error, request access approval from your security administrator.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {!isRequested ? (
            <button
              onClick={handleRequestAccess}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Request Role Elevation
            </button>
          ) : (
            <div className="w-full p-2.5 bg-emerald-50 border border-emerald-200 text-[#28A745] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Role elevation request sent to Admin lead.
            </div>
          )}

          <Link
            to="/dashboard"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" /> Return to User Portal
          </Link>
        </div>
      </div>
    </div>
  );
};
