import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home, Search } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#2D3436] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 max-w-lg w-full shadow-lg space-y-6 animate-in fade-in zoom-in-95">
        {/* Visual 404 Badge & Icon */}
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-3xl bg-amber-50 text-[#FFA500] border border-amber-100 flex items-center justify-center mx-auto shadow-xs">
            <ShieldAlert className="w-12 h-12 text-[#FFA500]" />
          </div>
          <span className="absolute -bottom-2 -right-2 text-xs font-black bg-rose-600 text-white px-2.5 py-0.5 rounded-full shadow-xs">
            404
          </span>
        </div>

        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
            HTTP 404 — Access Route Unresolved
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Target Page Not Found
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
            The path or security challenge route you requested does not exist or may have been relocated.
          </p>
        </div>

        {/* Valid Navigation Options Box */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs text-left">
          <span className="font-bold text-slate-700 block border-b border-slate-200 pb-1.5">
            Suggested Operational Routes:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-semibold">
            <Link
              to="/admin/dashboard"
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 hover:text-[#0052CC] hover:border-blue-300 transition-colors flex items-center gap-2"
            >
              <Home className="w-4 h-4 text-[#0052CC]" /> Admin Dashboard
            </Link>
            <Link
              to="/admin/labs"
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 hover:text-[#0052CC] hover:border-blue-300 transition-colors flex items-center gap-2"
            >
              <Search className="w-4 h-4 text-[#6F42C1]" /> Lab Marketplace
            </Link>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back Previous Page
          </button>

          <Link
            to="/admin/dashboard"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" /> Return to Main Hub
          </Link>
        </div>
      </div>
    </div>
  );
};
