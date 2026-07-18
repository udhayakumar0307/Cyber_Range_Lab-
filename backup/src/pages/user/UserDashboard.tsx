import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, 
  Flame, 
  Award, 
  Play, 
  Clock, 
  CheckCircle2, 
  ShieldAlert, 
  BookOpen, 
  TrendingUp,
  FlaskConical,
  Flag,
  ArrowRight
} from 'lucide-react';

interface TrainingLab {
  id: string;
  title: string;
  category: string;
  status: 'live' | 'upcoming' | 'completed';
  timeRemaining?: number;
  timeToStart?: number;
  score?: string;
  completedAt?: string;
  description?: string;
  totalChallenges?: number;
  solvedChallenges?: number;
  tags?: string[];
  duration?: string;
}

export const UserDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [labs, setLabs] = useState<TrainingLab[]>([
    {
      id: 'command-line-lab',
      title: 'Command Line Lab',
      category: 'Linux Infrastructure',
      status: 'live',
      timeRemaining: 7342,
      description: 'Master the Linux command line. Audit permissions, search files, manage processes, and solve real world scripting challenges.',
      totalChallenges: 20,
      solvedChallenges: 0,
      tags: ['Linux', 'Terminal', 'Docker', 'Scripting'],
      duration: '4 hrs'
    },
    {
      id: 'lab-2',
      title: 'Network Defense Lab',
      category: 'Network Security',
      status: 'upcoming',
      timeToStart: 9900,
      description: 'Learn network scanning, traffic analysis, firewall rules, and intrusion detection system challenges.',
      totalChallenges: 15,
      solvedChallenges: 0,
      tags: ['Network', 'Wireshark', 'Firewall'],
      duration: '5 hrs'
    }
  ]);

  const [recentActivities] = useState([
    { id: 'act-1', title: 'Lab Completed', desc: 'Command Line Lab - Module 3', time: '2 hours ago', type: 'success' },
    { id: 'act-2', title: 'Achievement Unlocked', desc: 'Linux Explorer', time: '5 hours ago', type: 'achievement' },
    { id: 'act-3', title: 'CTF Challenge Solved', desc: 'Web Exploitation - Easy', time: '1 day ago', type: 'ctf' },
    { id: 'act-4', title: 'Lab Progress', desc: 'Network Defense Lab - Module 1', time: '2 days ago', type: 'progress' }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLabs((prevLabs) =>
        prevLabs.map((lab) => {
          if (lab.status === 'live' && lab.timeRemaining && lab.timeRemaining > 0) {
            return { ...lab, timeRemaining: lab.timeRemaining - 1 };
          }
          if (lab.status === 'upcoming' && lab.timeToStart && lab.timeToStart > 0) {
            const nextTimeToStart = lab.timeToStart - 1;
            if (nextTimeToStart === 0) {
              return {
                ...lab,
                status: 'live',
                timeRemaining: 7200,
                timeToStart: undefined
              };
            }
            return { ...lab, timeToStart: nextTimeToStart };
          }
          return lab;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatCountdown = (seconds?: number) => {
    if (seconds === undefined) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `Starts in ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Welcome Banner Card */}
      <div className="bg-gradient-to-r from-blue-900 via-[#2563EB] to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Trophy className="w-80 h-80 text-white" />
        </div>
        <div className="relative z-10 max-w-2xl space-y-3">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Welcome back, Udhaya! 👋
          </h1>
          <p className="text-sm text-blue-100/90 leading-relaxed">
            Continue your cybersecurity journey. Complete labs, earn points, and climb the leaderboard.
          </p>

          {/* Experience Progress */}
          <div className="pt-2 max-w-lg">
            <div className="flex justify-between text-xs font-bold text-blue-100 mb-1.5">
              <span>Level 12 Operator</span>
              <span>75% to Level 13</span>
            </div>
            <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden border border-white/10">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: '75%' }}></div>
            </div>
          </div>

          <div className="pt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/labs/command-line-lab/session')}
              className="bg-[#2563EB] hover:bg-blue-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md inline-flex items-center gap-2 border border-white/20"
            >
              <Play className="w-4 h-4 fill-white" />
              Resume Last Lab
            </button>
            <a
              href="#help"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold px-4 py-2.5 rounded-xl text-xs transition-all inline-flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              View Handbook
            </a>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* TOTAL SCORE */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-[11px] font-bold text-[#64748B] dark:text-[#CBD5E1] uppercase tracking-wider">TOTAL SCORE</p>
            <p className="text-2xl font-black text-[#0F172A] dark:text-white mt-1">2,450 pts</p>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full mt-2 inline-flex items-center gap-1">
              ▲ +350 points this week
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* GLOBAL RANK */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-[11px] font-bold text-[#64748B] dark:text-[#CBD5E1] uppercase tracking-wider">GLOBAL RANK</p>
            <p className="text-2xl font-black text-[#0F172A] dark:text-white mt-1">#14 / 1,200</p>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full mt-2 inline-flex items-center gap-1">
              ▲ 3 places in standings
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Trophy className="w-6 h-6" />
          </div>
        </div>

        {/* LABS COMPLETED */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-[11px] font-bold text-[#64748B] dark:text-[#CBD5E1] uppercase tracking-wider">LABS COMPLETED</p>
            <p className="text-2xl font-black text-[#0F172A] dark:text-white mt-1">5 / 12 Labs</p>
            <div className="w-36 h-1.5 bg-blue-50 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-[#2563EB] rounded-full" style={{ width: '42%' }}></div>
            </div>
            <span className="text-[10px] text-[#64748B] dark:text-[#CBD5E1] font-semibold mt-1 block">42% complete rate</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <FlaskConical className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Your Assigned Labs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0F172A] dark:text-white">Your Assigned Labs</h2>
            <button 
              onClick={() => navigate('/labs')}
              className="text-xs font-bold text-[#2563EB] hover:underline flex items-center gap-1"
            >
              View All Labs <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {labs.map((lab) => (
              <div 
                key={lab.id}
                className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-md">
                      {lab.category}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      lab.status === 'live'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                    }`}>
                      {lab.status.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="font-bold text-[#0F172A] dark:text-white text-sm leading-snug">{lab.title}</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#CBD5E1] leading-relaxed line-clamp-3">{lab.description}</p>

                  {lab.status === 'live' ? (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[10px] font-bold text-[#64748B] dark:text-[#CBD5E1]">
                        <span>Progress</span>
                        <span>{lab.solvedChallenges} / {lab.totalChallenges} Solved</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-[#2563EB] rounded-full" style={{ width: '0%' }}></div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 pt-1">
                      <Clock className="w-4 h-4" />
                      <span>{formatCountdown(lab.timeToStart)}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1 pt-1">
                    {lab.tags?.map((tag, idx) => (
                      <span key={idx} className="text-[10px] font-bold text-[#64748B] dark:text-[#CBD5E1] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between text-xs">
                  <span className="font-bold text-[#64748B] dark:text-[#CBD5E1]">Duration: {lab.duration}</span>
                  {lab.status === 'live' ? (
                    <button 
                      onClick={() => navigate('/labs/command-line-lab/session')}
                      className="bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                    >
                      Continue <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => navigate('/labs')}
                      className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs px-4 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155]"
                    >
                      View Details
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0F172A] dark:text-white">Recent Activity</h2>
            <button className="text-xs font-bold text-[#2563EB] hover:underline">View All →</button>
          </div>

          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-5 shadow-xs space-y-4 transition-colors">
            {recentActivities.map((act) => (
              <div key={act.id} className="flex items-start gap-3 text-xs border-b border-[#E2E8F0] dark:border-[#334155] pb-3 last:border-0 last:pb-0">
                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[#0F172A] dark:text-white">{act.title}</p>
                  <p className="text-[11px] text-[#64748B] dark:text-[#CBD5E1] mt-0.5">{act.desc}</p>
                  <span className="text-[10px] text-slate-400 block mt-1">{act.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
