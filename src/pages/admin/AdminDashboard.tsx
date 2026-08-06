import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FlaskConical, 
  UsersRound, 
  UserPlus, 
  Store, 
  Clock, 
  ShieldCheck,
  BookOpen,
  Award,
  Check
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<any>({
    databaseConnected: false,
    purchasedLabs: {
      total: 0,
      totalSeats: 0,
      seatsUsed: 0,
      seatsRemaining: 0,
      utilizationPercentage: 0
    },
    students: {
      total: 0,
      active: 0,
      inactive: 0
    },
    groups: {
      total: 0,
      withActive: 0,
      empty: 0
    },
    assignments: {
      total: 0,
      running: 0,
      scheduled: 0,
      completed: 0,
      expired: 0
    }
  });

  useEffect(() => {
    const fetchDashboardSummary = async () => {
      const token = localStorage.getItem('token');
      try {
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('/api/v1/admin/dashboard/summary', { headers });

        if (res.ok) {
          const data = await res.json();
          setSummaryData(data);
        }
      } catch (err) {
        console.error('Error fetching dashboard summary:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardSummary();
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-slate-400 font-medium">Loading summary details...</div>;
  }

  const isDbConnected = summaryData.databaseConnected;

  return (
    <div className="space-y-8 animate-in fade-in duration-200 text-xs">
      {/* 1. Professor Command Center Hero Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-[#0052CC] to-indigo-800 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <ShieldCheck className="w-80 h-80 text-white" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide text-blue-100 border border-white/20 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#28A745] animate-pulse"></span>
            Organization Educator Portal
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Professor Command Center
          </h1>
          <p className="mt-2 text-sm sm:text-base text-blue-100/90 leading-relaxed font-normal">
            Track student cohort progress, manage lab seat assignments, purchase curriculum modules, and monitor learning outcomes.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/admin/labs"
              className="bg-white text-[#0052CC] hover:bg-blue-50 font-bold px-4 py-2.5 rounded-lg text-sm transition-colors shadow-sm inline-flex items-center gap-2"
            >
              <Store className="w-4 h-4" />
              Browse Lab Marketplace
            </Link>
            <Link
              to="/admin/users"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/30 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Manage Students & Groups
            </Link>
          </div>
        </div>
      </div>

      {/* 2. LIVE DATABASE COUNTS OVERVIEW */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            Educational Overview
          </h2>
          <span className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
            isDbConnected 
              ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800' 
              : 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-850'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${isDbConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {isDbConnected ? 'Database Connected' : 'Database Offline'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Purchased Labs */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Purchased Labs</span>
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#0052CC]">
                <FlaskConical className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {summaryData.purchasedLabs.total}
              </div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {summaryData.purchasedLabs.seatsRemaining} Seats Available
              </p>
            </div>
          </div>

          {/* Card 2: Students */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Students</span>
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-[#28A745]">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {summaryData.students.total}
              </div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {summaryData.students.active} Active Students
              </p>
            </div>
          </div>

          {/* Card 3: Groups */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Groups</span>
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-[#FFA500]">
                <UsersRound className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {summaryData.groups.total}
              </div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {summaryData.groups.withActive} Active Groups
              </p>
            </div>
          </div>

          {/* Card 4: Assignments */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Assignments</span>
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-[#6F42C1]">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {summaryData.assignments.total}
              </div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {summaryData.assignments.running} Running • {summaryData.assignments.completed} Completed
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ABOUT CYBERRANGE PLATFORM SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
            About CyberRange Platform
          </h3>
          <p className="text-slate-500 font-semibold mt-2 leading-relaxed">
            CyberRange is an enterprise cybersecurity learning platform designed for universities, engineering colleges, training institutes, and organizations.
            The platform enables educators to purchase cybersecurity labs, manage students and groups, assign labs, monitor learning progress, generate analytics, and export detailed reports from a centralized dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 dark:border-slate-800 pt-6">
          {/* What Professors Can Do Card */}
          <div className="p-5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-800/60 rounded-xl space-y-3">
            <h4 className="text-sm font-extrabold text-[#0052CC] dark:text-blue-400 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> What Professors Can Do
            </h4>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-350">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#0052CC]" /> Purchase cybersecurity labs</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#0052CC]" /> Manage students</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#0052CC]" /> Create groups</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#0052CC]" /> Assign labs</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#0052CC]" /> Track student progress</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#0052CC]" /> View analytics</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#0052CC]" /> Export reports</li>
            </ul>
          </div>

          {/* What Students Experience Card */}
          <div className="p-5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/60 rounded-xl space-y-3">
            <h4 className="text-sm font-extrabold text-[#28A745] dark:text-emerald-400 flex items-center gap-2">
              <Award className="w-4 h-4" /> What Students Experience
            </h4>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-350">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#28A745]" /> Access assigned labs</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#28A745]" /> Perform practical exercises</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#28A745]" /> Submit flags</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#28A745]" /> Track progress</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#28A745]" /> View scores</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#28A745]" /> Complete learning paths</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
