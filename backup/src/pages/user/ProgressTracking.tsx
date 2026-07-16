import React, { useState } from 'react';
import { 
  Award, 
  Clock, 
  TrendingUp, 
  ShieldCheck, 
  Calendar,
  Zap,
  Target
} from 'lucide-react';

interface DomainProficiency {
  domain: string;
  scorePercentage: number;
  solvedCount: number;
  totalCount: number;
  color: string;
}

interface Badge {
  id: string;
  title: string;
  category: string;
  dateAwarded: string;
  description: string;
}

export const ProgressTracking: React.FC = () => {
  const [timePeriod, setTimePeriod] = useState('30days');

  // Mock domain proficiency data
  const [domains] = useState<DomainProficiency[]>(
    [
      { 
        domain: 'Web Application Security', 
        scorePercentage: 80, 
        solvedCount: 8, 
        totalCount: 10,
        color: 'bg-[#0052CC]' 
      },
      { 
        domain: 'Active Directory & Network Security', 
        scorePercentage: 60, 
        solvedCount: 6, 
        totalCount: 10,
        color: 'bg-[#6F42C1]' 
      },
      { 
        domain: 'Linux Infrastructure & Escales', 
        scorePercentage: 95, 
        solvedCount: 19, 
        totalCount: 20,
        color: 'bg-[#28A745]' 
      },
      { 
        domain: 'AI Model Safety & Prompts', 
        scorePercentage: 40, 
        solvedCount: 2, 
        totalCount: 5,
        color: 'bg-[#FFA500]' 
      }
    ]
  );

  // Mock unlocked badges list
  const [badges] = useState<Badge[]>([
    {
      id: 'b-1',
      title: 'Privilege Escalation Specialist',
      category: 'Linux Infrastructure',
      dateAwarded: '2 days ago',
      description: 'Awarded for achieving 100% completion in local SUID and privilege escalation tactics.'
    },
    {
      id: 'b-2',
      title: 'Active Directory Defender',
      category: 'Windows Domain Security',
      dateAwarded: '1 week ago',
      description: 'Granted for identifying Kerberoasting vulnerabilities and securing domain controllers.'
    },
    {
      id: 'b-3',
      title: 'Reconnaissance Practitioner',
      category: 'Information Gathering',
      dateAwarded: '2 weeks ago',
      description: 'Acquired for demonstrating proficiency in port scanning, service mapping, and initial footprinting.'
    }
  ]);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Progress & Achievements</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Analyze your training milestones, skill categories, and study session logs.
          </p>
        </div>

        {/* Date Filter Toolbar */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/15"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Overview KPI Box Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Training Hours</span>
          <span className="text-xl font-black text-slate-800 mt-1 block">14.5 Hours</span>
          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
            <Clock className="w-3 h-3" /> +2.3 hrs spent this week
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Session</span>
          <span className="text-xl font-black text-slate-800 mt-1 block">42 Minutes</span>
          <span className="text-[10px] text-slate-400 font-semibold mt-1 block">Across 18 total sessions</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Badges Unlocked</span>
          <span className="text-xl font-black text-slate-800 mt-1 block">{badges.length} Badges</span>
          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
            <Award className="w-3 h-3" /> Next milestone at 5 badges
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pacing Standing</span>
          <span className="text-xl font-black text-slate-800 mt-1 block">Top 15%</span>
          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
            <TrendingUp className="w-3 h-3" /> 8% above cohort average
          </span>
        </div>
      </div>

      {/* Row 1 Grid: Skill Domains & Score Trajectory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Domain proficiencies progress bar deck */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">Skill Domain Category Ratings</h3>
            <p className="text-xs text-slate-500 mt-0.5">Solve percentages across security disciplines</p>
          </div>

          <div className="space-y-4 my-6">
            {domains.map((dom, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700">{dom.domain}</span>
                  <span className="text-slate-800">{dom.scorePercentage}% ({dom.solvedCount}/{dom.totalCount})</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${dom.color}`}
                    style={{ width: `${dom.scorePercentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-[#0052CC] font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 flex-shrink-0" />
            <span>Top proficiency demonstrated in Linux Infrastructure (95%).</span>
          </div>
        </div>

        {/* Score Trajectory Line Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">Score Accumulation Trajectory</h3>
            <p className="text-xs text-slate-500 mt-0.5">Cumulative points growth timeline</p>
          </div>

          {/* SVG Line Graph */}
          <div className="h-44 w-full relative pt-4 pb-2 my-4">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120">
              {/* Gridlines */}
              <line x1="0" y1="20" x2="500" y2="20" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="60" x2="500" y2="60" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="100" x2="500" y2="100" stroke="#f1f5f9" strokeWidth="1" />

              {/* Linear area path gradient */}
              <path
                d="M 10 100 L 90 90 L 170 70 L 250 50 L 330 45 L 410 20 L 490 15"
                fill="none"
                stroke="#0052CC"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Tooltip circles */}
              <circle cx="10" cy="100" r="4.5" fill="#0052CC" stroke="#ffffff" strokeWidth="2" />
              <circle cx="90" cy="90" r="4.5" fill="#0052CC" stroke="#ffffff" strokeWidth="2" />
              <circle cx="170" cy="70" r="4.5" fill="#0052CC" stroke="#ffffff" strokeWidth="2" />
              <circle cx="250" cy="50" r="4.5" fill="#0052CC" stroke="#ffffff" strokeWidth="2" />
              <circle cx="330" cy="45" r="4.5" fill="#0052CC" stroke="#ffffff" strokeWidth="2" />
              <circle cx="410" cy="20" r="4.5" fill="#0052CC" stroke="#ffffff" strokeWidth="2" />
              <circle cx="490" cy="15" r="4.5" fill="#0052CC" stroke="#ffffff" strokeWidth="2" />
            </svg>
            <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2 px-1">
              <span>Week 1 (450)</span>
              <span>Week 2 (950)</span>
              <span>Week 3 (1350)</span>
              <span>Week 4 (1800)</span>
              <span>Week 5 (2100)</span>
              <span>Week 6 (2450)</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-800 font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>Score increased by 650 points in the last 2 weeks.</span>
          </div>
        </div>
      </div>

      {/* Row 2 Grid: Study Hours & Unlocked Badges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Hours Bar chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Weekly Study Active Hours</h3>
            <p className="text-xs text-slate-500 mt-0.5">Session durations breakdown</p>
          </div>

          {/* SVG Bar Chart */}
          <div className="h-44 w-full relative pt-4 pb-2 my-4">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 300 120">
              <line x1="0" y1="20" x2="300" y2="20" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="60" x2="300" y2="60" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="100" x2="300" y2="100" stroke="#f1f5f9" strokeWidth="1" />

              {/* Bars */}
              <rect x="25" y="60" width="22" height="40" fill="#28A745" rx="3" opacity="0.85" />
              <rect x="95" y="40" width="22" height="60" fill="#28A745" rx="3" opacity="0.85" />
              <rect x="165" y="55" width="22" height="45" fill="#28A745" rx="3" opacity="0.85" />
              <rect x="235" y="25" width="22" height="75" fill="#28A745" rx="3" opacity="0.85" />
            </svg>
            <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2 px-3">
              <span>Week 1</span>
              <span>Week 2</span>
              <span>Week 3</span>
              <span>Week 4</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span className="font-semibold">Target: 4 hrs / week</span>
            <span className="font-bold text-slate-700">Avg: 3.6 hrs</span>
          </div>
        </div>

        {/* Unlocked Badges credentials roster */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-slate-800 text-sm">Unlocked Badges & Credentials</h3>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                Verifiable
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Certificates earned from target range completions</p>
          </div>

          {/* Badges stack list */}
          <div className="divide-y divide-slate-100 my-4 max-h-56 overflow-y-auto pr-1">
            {badges.map((badge) => (
              <div key={badge.id} className="py-3 flex items-start gap-3.5 first:pt-0 last:pb-0">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#FFA500] border border-amber-100 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">{badge.title}</span>
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-md">
                      {badge.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    {badge.description}
                  </p>
                  <span className="text-[9px] text-slate-400 font-semibold block mt-1">Earned {badge.dateAwarded}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Next Milestone tracking */}
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Target className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Next Milestone Certificate Target</span>
                <span className="text-xs font-bold text-slate-700 mt-0.5 block">OWASP AppSec Practitioner</span>
              </div>
            </div>
            <button 
              onClick={() => alert('Finish 2 more Web Application Security challenges to acquire badge.')}
              className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-colors shadow-xs"
            >
              60% Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
