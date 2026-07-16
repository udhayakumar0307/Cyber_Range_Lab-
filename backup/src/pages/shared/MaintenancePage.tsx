import React, { useState } from 'react';
import { Wrench, Clock, CheckCircle2 } from 'lucide-react';

export const MaintenancePage: React.FC = () => {
  const [emailNotify, setEmailNotify] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);

  const handleNotifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailNotify.trim()) return;
    setIsRegistered(true);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#2D3436] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 max-w-lg w-full shadow-lg space-y-6 animate-in fade-in zoom-in-95">
        {/* Animated Maintenance Wrench Icon */}
        <div className="w-20 h-20 rounded-3xl bg-blue-50 text-[#0052CC] border border-blue-100 flex items-center justify-center mx-auto shadow-xs">
          <Wrench className="w-10 h-10 text-[#0052CC] animate-bounce" />
        </div>

        <div>
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#0052CC] bg-blue-50 px-3 py-1 rounded-full border border-blue-100 inline-block mb-2">
            Scheduled System Infrastructure Upgrade
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            CyberRange Under Maintenance
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
            We are deploying scheduled platform hypervisor improvements and updating threat intelligence lab feeds.
          </p>
        </div>

        {/* Maintenance Time Window Banner */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs text-left">
          <div className="flex items-center justify-between font-bold text-slate-800">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#0052CC]" /> Estimated Downtime Window
            </span>
            <span className="text-[#28A745] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              In Progress
            </span>
          </div>

          <div className="flex justify-between text-slate-600 pt-1">
            <span>Window Start:</span>
            <span className="font-semibold text-slate-800">12:00 UTC (Today)</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Target Completion:</span>
            <span className="font-semibold text-slate-800">14:00 UTC (Estimated 2 Hours)</span>
          </div>
        </div>

        {/* Email Notification Form */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <span className="text-xs font-bold text-slate-700 block">
            Get Notified Upon Operational Status Restoration
          </span>

          {!isRegistered ? (
            <form onSubmit={handleNotifySubmit} className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email address..."
                value={emailNotify}
                onChange={(e) => setEmailNotify(e.target.value)}
                className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
              >
                Notify Me
              </button>
            </form>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-[#28A745] rounded-xl text-xs font-bold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              You will receive an email notice when systems resume live operations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
