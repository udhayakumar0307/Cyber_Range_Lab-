import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Flame, 
  Award, 
  Play, 
  Clock, 
  CheckCircle2, 
  ShieldAlert, 
  BookOpen, 
  TrendingUp 
} from 'lucide-react';

interface TrainingLab {
  id: string;
  title: string;
  category: string;
  status: 'live' | 'upcoming' | 'completed';
  timeRemaining?: number; // in seconds
  timeToStart?: number; // in seconds
  score?: string;
  completedAt?: string;
}

export const UserDashboard: React.FC = () => {
  // Live ticking state for student assigned labs
  const [labs, setLabs] = useState<TrainingLab[]>([
    {
      id: 'lab-1',
      title: 'Active Directory Security Basics',
      category: 'Windows Domain Security',
      status: 'live',
      timeRemaining: 7342, // approx 2h 2m 22s
    },
    {
      id: 'lab-2',
      title: 'AI Prompt Injection Sandpit',
      category: 'AI Model Safety',
      status: 'upcoming',
      timeToStart: 495, // approx 8m 15s
    },
    {
      id: 'lab-3',
      title: 'Linux Privilege Escalation Tactics',
      category: 'Linux Infrastructure',
      status: 'completed',
      score: '150 / 150 pts',
      completedAt: '2 days ago',
    }
  ]);

  const [notifications] = useState([
    { id: 'not-1', text: 'You completed Linux Privilege Escalation!', type: 'success', time: '2 days ago' },
    { id: 'not-2', text: 'New lab "AI Prompt Injection Sandpit" assigned to your cohort.', type: 'info', time: '4 hours ago' }
  ]);

  // Live ticking interval logic
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
              // Transition upcoming lab to live status dynamically!
              return {
                ...lab,
                status: 'live',
                timeRemaining: 7200, // 2 hours
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
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner Card */}
      <div className="bg-gradient-to-r from-blue-900 via-[#0052CC] to-indigo-800 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Trophy className="w-80 h-80 text-white" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-blue-100 mb-3 border border-white/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Operator Rank Status: Level 12 Analyst
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Welcome back, Alex!
          </h1>
          <p className="mt-2 text-sm sm:text-base text-blue-100/90 leading-relaxed font-normal">
            Your container systems are ready. Track allocated training labs, submit solution flags, and monitor your standings in real time.
          </p>

          {/* Gamification Level Progression */}
          <div className="mt-5 max-w-md">
            <div className="flex justify-between text-xs font-bold text-blue-200 mb-1">
              <span>Level 12 Experience Progression</span>
              <span>75% to Level 13</span>
            </div>
            <div className="w-full h-2.5 bg-white/25 rounded-full overflow-hidden border border-white/10">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: '75%' }}></div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                alert('Spinning up container session... Connecting to AD Security Basics.');
              }}
              className="bg-white text-[#0052CC] hover:bg-blue-50 font-bold px-4 py-2.5 rounded-lg text-sm transition-colors shadow-sm inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4 text-[#0052CC] fill-[#0052CC]" />
              Resume Active Lab
            </button>
            <a
              href="#help"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/30 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors inline-flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              View Handbook
            </a>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Score widget */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Score</p>
            <p className="text-2xl font-black text-slate-800 mt-1">2,450 pts</p>
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-1.5 inline-block">
              +350 points this week
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0052CC] flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Standings widget */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Global Standings</p>
            <p className="text-2xl font-black text-slate-800 mt-1">#14 / 1,200</p>
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-1.5 inline-block">
              ▲ 3 places in standings
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-[#6F42C1] flex items-center justify-center">
            <Trophy className="w-6 h-6" />
          </div>
        </div>

        {/* Completed labs widget */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Labs Completed</p>
            <p className="text-2xl font-black text-slate-800 mt-1">5 / 12 Labs</p>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full mt-1.5 inline-block">
              42% complete rate
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-[#FFA500] flex items-center justify-center">
            <Flame className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Allocated Labs list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800">Your Assigned Labs</h3>
            <span className="text-xs font-semibold text-[#0052CC] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              Live Training Slots
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {labs.map((lab) => (
              <div 
                key={lab.id}
                className={`bg-white rounded-xl border p-5 shadow-xs flex flex-col justify-between transition-all ${
                  lab.status === 'live' 
                    ? 'border-emerald-300 ring-2 ring-emerald-500/10' 
                    : lab.status === 'upcoming' 
                    ? 'border-amber-300 bg-amber-50/10' 
                    : 'border-slate-200 bg-slate-50/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {lab.category}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      lab.status === 'live' 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                        : lab.status === 'upcoming' 
                        ? 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse' 
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {lab.status.toUpperCase()}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-800 text-sm leading-snug">{lab.title}</h4>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Action or indicator */}
                  {lab.status === 'live' ? (
                    <>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatCountdown(lab.timeRemaining)} left</span>
                      </div>
                      <button 
                        onClick={() => alert(`Entering container console for ${lab.title}...`)}
                        className="bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm"
                      >
                        Enter Lab
                      </button>
                    </>
                  ) : lab.status === 'upcoming' ? (
                    <>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>Starts in {formatCountdown(lab.timeToStart)}</span>
                      </div>
                      <button 
                        disabled 
                        className="bg-slate-100 text-slate-400 font-semibold text-xs px-3.5 py-1.5 rounded-lg border border-slate-200 cursor-not-allowed"
                      >
                        Locked
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-slate-500">{lab.score} solved</span>
                      <span className="text-[11px] text-slate-400 font-medium">{lab.completedAt}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Skill Performance Visualizer Widget */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Personal Activity Solved Weight</h4>
                <p className="text-xs text-slate-500">Solve increments over the training calendar</p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> On Track
              </span>
            </div>

            {/* Custom Interactive SVG Graph */}
            <div className="h-40 w-full relative pt-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120">
                {/* Horizontal gridlines */}
                <line x1="0" y1="20" x2="500" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="60" x2="500" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="100" x2="500" y2="100" stroke="#f1f5f9" strokeWidth="1" />

                {/* Growth path line */}
                <path
                  d="M 10 90 L 80 85 L 160 60 L 240 68 L 320 40 L 400 45 L 480 15"
                  fill="none"
                  stroke="#0052CC"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Nodes */}
                <circle cx="10" cy="90" r="4" fill="#0052CC" stroke="#ffffff" strokeWidth="1.5" />
                <circle cx="80" cy="85" r="4" fill="#0052CC" stroke="#ffffff" strokeWidth="1.5" />
                <circle cx="160" cy="60" r="4" fill="#0052CC" stroke="#ffffff" strokeWidth="1.5" />
                <circle cx="240" cy="68" r="4" fill="#0052CC" stroke="#ffffff" strokeWidth="1.5" />
                <circle cx="320" cy="40" r="4" fill="#0052CC" stroke="#ffffff" strokeWidth="1.5" />
                <circle cx="400" cy="45" r="4" fill="#0052CC" stroke="#ffffff" strokeWidth="1.5" />
                <circle cx="480" cy="15" r="4" fill="#0052CC" stroke="#ffffff" strokeWidth="1.5" />
              </svg>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1 px-1">
                <span>Week 1</span>
                <span>Week 2</span>
                <span>Week 3</span>
                <span>Week 4</span>
                <span>Week 5</span>
                <span>Week 6</span>
                <span>Week 7</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar panels (Activities & Notifications) */}
        <div className="space-y-6">
          {/* Notifications feed */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Platform Alerts & Updates
            </h3>
            <div className="space-y-3">
              {notifications.map((not) => (
                <div 
                  key={not.id}
                  className={`p-3 rounded-lg border text-xs leading-relaxed ${
                    not.type === 'success' 
                      ? 'bg-emerald-50/70 border-emerald-100 text-emerald-800' 
                      : 'bg-blue-50/70 border-blue-100 text-blue-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    {not.type === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <ShieldAlert className="w-3.5 h-3.5 text-[#0052CC]" />
                    )}
                    <span>{not.type === 'success' ? 'Task Completed' : 'Allocation'}</span>
                  </div>
                  <p className="font-medium">{not.text}</p>
                  <span className="text-[10px] text-slate-400 font-semibold block mt-1.5">{not.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Timeline log */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Your Activity Timeline
            </h3>

            <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
              {/* Activity item 1 */}
              <div className="flex gap-4 items-start relative z-10">
                <div className="w-6.5 h-6.5 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 leading-snug">Submitted correct flag flag{"{"}escalation_vector{"}"}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Linux Privilege Escalation (150 pts)</p>
                  <span className="text-[10px] text-slate-400 font-semibold block mt-1">10 mins ago</span>
                </div>
              </div>

              {/* Activity item 2 */}
              <div className="flex gap-4 items-start relative z-10">
                <div className="w-6.5 h-6.5 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center text-[#6F42C1] flex-shrink-0">
                  <Trophy className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 leading-snug">Ranked up to Rank #14 in Standings</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Surpassed 3 players globally</p>
                  <span className="text-[10px] text-slate-400 font-semibold block mt-1">2 hours ago</span>
                </div>
              </div>

              {/* Activity item 3 */}
              <div className="flex gap-4 items-start relative z-10">
                <div className="w-6.5 h-6.5 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-[#0052CC] flex-shrink-0">
                  <BookOpen className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 leading-snug">Enrolled in Active Directory basics</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Session launched automatically</p>
                  <span className="text-[10px] text-slate-400 font-semibold block mt-1">1 day ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
