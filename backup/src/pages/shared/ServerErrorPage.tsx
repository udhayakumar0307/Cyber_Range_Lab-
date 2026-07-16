import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home, Terminal } from 'lucide-react';

export const ServerErrorPage: React.FC = () => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      setIsRetrying(false);
      window.location.reload();
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#2D3436] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 max-w-lg w-full shadow-lg space-y-6 animate-in fade-in zoom-in-95">
        {/* Visual 500 Icon */}
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-3xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto shadow-xs">
            <AlertTriangle className="w-12 h-12 text-rose-600" />
          </div>
          <span className="absolute -bottom-2 -right-2 text-xs font-black bg-slate-900 text-white px-2.5 py-0.5 rounded-full shadow-xs">
            500
          </span>
        </div>

        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-rose-600 block mb-1">
            HTTP 500 — Internal Exception Encountered
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Unexpected Platform Exception
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
            The server encountered an unexpected error processing your challenge payload or session transaction.
          </p>
        </div>

        {/* Diagnostic Stack Payload Box */}
        <div className="p-4 bg-slate-900 text-slate-200 rounded-2xl space-y-2 text-left font-mono text-xs overflow-x-auto border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5 font-sans font-bold">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-rose-400" /> System Diagnostics
            </span>
            <span className="text-[10px] text-slate-500">ERR_INTERNAL_500</span>
          </div>
          <p className="text-rose-300 text-[11px]">
            &gt; RuntimeException: Connection refused to session state backend engine.
          </p>
          <p className="text-slate-400 text-[10px]">
            Timestamp: {new Date().toISOString()}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying Connection...' : 'Retry Request'}
          </button>

          <Link
            to="/admin/dashboard"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" /> Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};
