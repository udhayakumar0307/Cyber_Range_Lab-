import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Clock, 
  CheckCircle2, 
  User, 
  Users,
  LineChart,
  Medal,
  Crown
} from 'lucide-react';

export const LeaderboardPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'personal' | 'college' | 'global'>('personal');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [personalHistory, setPersonalHistory] = useState<any[]>([]);
  
  const [globalRanks, setGlobalRanks] = useState<any[]>([]);
  const [globalTotal, setGlobalTotal] = useState(0);
  const [globalPage, setGlobalPage] = useState(1);

  const [collegeRanks, setCollegeRanks] = useState<any[]>([]);
  const [collegeTotal, setCollegeTotal] = useState(0);
  const [collegePage, setCollegePage] = useState(1);

  const [personalRank, setPersonalRank] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const limit = 10;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const [profileRes, progressRes, personalRankRes] = await Promise.all([
          fetch('/api/v1/auth/me', { headers }),
          fetch('/api/v1/reporting/progress', { headers }),
          fetch('/api/v1/reporting/leaderboard?type=personal', { headers })
        ]);

        if (profileRes.ok && progressRes.ok && personalRankRes.ok) {
          const profile = await profileRes.json();
          const progress = await progressRes.json();
          const pRank = await personalRankRes.json();
          
          setUserProfile(profile);
          setPersonalHistory(progress);
          setPersonalRank(pRank);

          if (profile.account_type !== 'STUDENT') {
            setActiveTab('personal');
          }
        }
      } catch (err) {
        console.error('Error fetching user profile data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const fetchGlobal = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`/api/v1/reporting/leaderboard?type=global&page=${globalPage}&limit=${limit}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setGlobalRanks(data.ranks || []);
          setGlobalTotal(data.total || 0);
        }
      } catch (err) {
        console.error('Error loading global standings:', err);
      }
    };
    fetchGlobal();
  }, [globalPage]);

  useEffect(() => {
    if (!userProfile || userProfile.account_type !== 'STUDENT' || !userProfile.college_id) return;
    
    const fetchCollege = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`/api/v1/reporting/leaderboard?type=college&page=${collegePage}&limit=${limit}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setCollegeRanks(data.ranks || []);
          setCollegeTotal(data.total || 0);
          setErrorMsg('');
        } else {
          const errData = await res.json();
          setErrorMsg(errData.detail || 'Could not load college standings.');
        }
      } catch (err) {
        console.error('Error loading college standings:', err);
      }
    };
    fetchCollege();
  }, [collegePage, userProfile]);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header section */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Training Leaderboards</h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review your solving accuracy history, group standings, and global rankings.
        </p>
      </div>

      {/* Tab Selectors */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs sm:text-sm font-bold w-full md:w-max flex-wrap gap-1 md:gap-0 transition-colors">
        <button
          onClick={() => setActiveTab('personal')}
          className={`flex-1 md:flex-none px-4 py-2 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 ${
            activeTab === 'personal'
              ? 'bg-white dark:bg-slate-900 text-[#2563EB] dark:text-white shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Personal Solves Log</span>
        </button>

        {userProfile?.account_type === 'STUDENT' && (
          <button
            onClick={() => setActiveTab('college')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'college'
                ? 'bg-white dark:bg-slate-900 text-[#2563EB] dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>My College Standings</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('global')}
          className={`flex-1 md:flex-none px-4 py-2 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 ${
            activeTab === 'global'
              ? 'bg-white dark:bg-slate-900 text-[#2563EB] dark:text-white shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Global Leaderboard</span>
        </button>
      </div>

      {/* TAB 1: PERSONAL LOG */}
      {activeTab === 'personal' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs transition-colors">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Solved Flags</span>
              <span className="text-lg font-black text-slate-800 dark:text-slate-100 mt-1 block">{personalHistory.length} Solves</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-1">Across all assignable range modules</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs transition-colors">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Global Rank</span>
              <span className="text-lg font-black text-[#2563EB] dark:text-blue-400 mt-1 block">#{personalRank?.rank || '--'}</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-1">Based on global score standing</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs transition-colors">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Account Classification</span>
              <span className="text-lg font-black text-slate-800 dark:text-slate-100 mt-1 block">{userProfile?.account_type || 'INDIVIDUAL'}</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-1">Profile account registration type</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs transition-colors">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Academic Affiliation</span>
              <span className="text-lg font-black text-slate-800 dark:text-slate-100 mt-1 block truncate">
                {userProfile?.college_id ? 'College Student' : 'Individual'}
              </span>
              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-1 flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Verifiable profile state
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs transition-colors">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Personal Scenario Solves History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                    <th className="px-5 py-3">Module ID</th>
                    <th className="px-5 py-3">Module Title</th>
                    <th className="px-5 py-3">Points Awarded</th>
                    <th className="px-5 py-3">Submission Attempts</th>
                    <th className="px-5 py-3">Completion Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {personalHistory.length > 0 ? (
                    personalHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="px-5 py-3.5 font-bold text-slate-500 dark:text-slate-400">{item.module_id}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-slate-100">{item.module_title}</td>
                        <td className="px-5 py-3.5 font-bold text-[#2563EB] dark:text-blue-400">{item.points} pts</td>
                        <td className="px-5 py-3.5 font-medium text-slate-700 dark:text-slate-300">{item.attempts} attempts</td>
                        <td className="px-5 py-3.5 font-medium text-slate-400 dark:text-slate-500">{item.completed_at}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500 font-semibold">
                        No solved flags recorded yet. Run a lab and solve a module challenge to populate!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COLLEGE STANDINGS */}
      {activeTab === 'college' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs animate-in fade-in duration-200 transition-colors">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">College Cohort Standings</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Ranking among students inside the same college affiliation</p>
            </div>
            <span className="text-xs font-bold text-[#2563EB] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-full border border-blue-100 dark:border-blue-900">
              Active Standings
            </span>
          </div>

          {errorMsg ? (
            <div className="p-6 text-center text-xs font-bold text-rose-500 dark:text-rose-400">{errorMsg}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-3 w-16 text-center">Rank</th>
                      <th className="px-6 py-3">Operator Name</th>
                      <th className="px-6 py-3">Institution Affiliation</th>
                      <th className="px-6 py-3 text-right">Points Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {collegeRanks.map((row) => (
                      <tr 
                        key={row.rank} 
                        className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${row.is_current ? 'bg-blue-50/40 dark:bg-blue-950/30 font-bold' : ''}`}
                      >
                        <td className="px-6 py-4 text-center font-extrabold text-slate-800 dark:text-slate-100">
                          {row.rank === 1 ? (
                            <span className="inline-flex items-center gap-1 text-amber-500"><Crown className="w-3.5 h-3.5 fill-amber-500" /> 1</span>
                          ) : row.rank === 2 ? (
                            <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500"><Medal className="w-3.5 h-3.5 fill-slate-300 dark:fill-slate-600" /> 2</span>
                          ) : (
                            <span>{row.rank}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-xs ${row.is_current ? 'bg-emerald-500' : 'bg-[#2563EB]'}`}>
                            {row.name.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <span className="text-slate-800 dark:text-slate-100 font-bold">{row.name}</span>
                          {row.is_current && (
                            <span className="text-[9px] font-bold text-[#2563EB] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded-md">YOU</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.college}</td>
                        <td className="px-6 py-4 text-right font-extrabold text-[#2563EB] dark:text-blue-400">{row.score} pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <button
                  disabled={collegePage <= 1}
                  onClick={() => setCollegePage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Page {collegePage} of {Math.ceil(collegeTotal / limit) || 1}
                </span>
                <button
                  disabled={collegePage >= Math.ceil(collegeTotal / limit)}
                  onClick={() => setCollegePage(prev => prev + 1)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: GLOBAL LEADERBOARD */}
      {activeTab === 'global' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs animate-in fade-in duration-200 transition-colors">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Global Range Leaderboard</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Ranks everyone currently active inside the CyberRange platform</p>
            </div>
            <span className="text-xs font-bold text-[#2563EB] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-full border border-blue-100 dark:border-blue-900">
              Global Standings
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-3 w-16 text-center">Rank</th>
                  <th className="px-6 py-3">Operator Name</th>
                  <th className="px-6 py-3">College Affiliation</th>
                  <th className="px-6 py-3 text-right">Points Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {globalRanks.map((row) => (
                  <tr 
                    key={row.rank} 
                    className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${row.is_current ? 'bg-blue-50/40 dark:bg-blue-950/30 font-bold' : ''}`}
                  >
                    <td className="px-6 py-4 text-center font-extrabold text-slate-800 dark:text-slate-100">
                      {row.rank === 1 ? (
                        <span className="inline-flex items-center gap-1 text-amber-500"><Crown className="w-3.5 h-3.5 fill-amber-500" /> 1</span>
                      ) : row.rank === 2 ? (
                        <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500"><Medal className="w-3.5 h-3.5 fill-slate-300 dark:fill-slate-600" /> 2</span>
                      ) : (
                        <span>{row.rank}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-xs ${row.is_current ? 'bg-emerald-500' : 'bg-[#2563EB]'}`}>
                        {row.name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <span className="text-slate-800 dark:text-slate-100 font-bold">{row.name}</span>
                      {row.is_current && (
                        <span className="text-[9px] font-bold text-[#2563EB] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded-md">YOU</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.college}</td>
                    <td className="px-6 py-4 text-right font-extrabold text-[#2563EB] dark:text-blue-400">{row.score} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
            <button
              disabled={globalPage <= 1}
              onClick={() => setGlobalPage(prev => Math.max(1, prev - 1))}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Page {globalPage} of {Math.ceil(globalTotal / limit) || 1}
            </span>
            <button
              disabled={globalPage >= Math.ceil(globalTotal / limit)}
              onClick={() => setGlobalPage(prev => prev + 1)}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
