import React, { useEffect, useState } from 'react';
import { UserLayout } from '../../components/user/UserLayout';
import type { CtfEvent, CtfTeam } from '../../types/ctf';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, 
  Clock, 
  ArrowRight, 
  Award,
  Sparkles,
  AlertCircle
} from 'lucide-react';

export const CtfPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<CtfEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [myTeam, setMyTeam] = useState<CtfTeam | null>({
    id: 'team-1',
    name: 'Team ZeroDay',
    inviteCode: 'ZD8824',
    captainName: 'Operator One (You)',
    members: ['Operator One (You)', 'Alex Security', 'Elena Cyber'],
    totalPoints: 1280,
    rank: 3,
    solves: ['chal-1', 'chal-3'],
  });

  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamTab, setTeamTab] = useState<'create' | 'join'>('create');
  const [newTeamName, setNewTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/v1/ctf', { headers });
      if (!res.ok) throw new Error('Failed to load CTF tournaments.');
      const data = await res.json();
      setEvents(data);
    } catch (err: any) {
      setError(err.message || 'Error occurred while loading tournaments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName) return;
    const created: CtfTeam = {
      id: `team-${Date.now()}`,
      name: newTeamName,
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      captainName: 'Operator One (You)',
      members: ['Operator One (You)'],
      totalPoints: 0,
      rank: 12,
      solves: [],
    };
    setMyTeam(created);
    setIsTeamModalOpen(false);
  };

  const handleJoinTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode) return;
    const joined: CtfTeam = {
      id: `team-joined`,
      name: `Squad Alpha (${joinCode})`,
      inviteCode: joinCode,
      captainName: 'Leader Alpha',
      members: ['Leader Alpha', 'Operator One (You)'],
      totalPoints: 450,
      rank: 7,
      solves: ['chal-1'],
    };
    setMyTeam(joined);
    setIsTeamModalOpen(false);
  };

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <UserLayout>
      <div className="space-y-8 animate-in fade-in duration-200">
        
        {/* Portal Hero */}
        <div className="bg-slate-900 text-white rounded-3xl p-8 border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/25 px-3 py-1 rounded-full text-xs font-bold text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
              Capture The Flag Platform
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              CTF Competitions
            </h1>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 p-3.5 border border-rose-500/20 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Tournament Stream */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Available Tournaments</h2>
            </div>

            {/* Promo banner — team CTF events */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">New — Team CTF Events</span>
              </div>
              <h3 className="text-lg font-extrabold mb-1">Squad up for the next Capture The Flag</h3>
              <p className="text-sm text-indigo-100">
                Cryptography, Web Exploitation & Network Reconnaissance — teams of 4, live scoring, leaderboard bragging rights. Ask your admin to get your college enrolled.
              </p>
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-400 font-semibold">
                Loading CTF Tournaments...
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 text-sm">
                No active or upcoming tournaments scheduled. Check back later!
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => {
                  const isLive = event.status === 'active';
                  const isUpcoming = event.status === 'scheduled';
                  const isConcluded = event.status === 'completed';

                  return (
                    <div
                      key={event.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:shadow-md transition-shadow"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-extrabold text-slate-800 dark:text-slate-100">{event.title}</h3>
                          {isLive && (
                            <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/35 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">
                              Live
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/35 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                              Scheduled
                            </span>
                          )}
                          {isConcluded && (
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                              Concluded
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {event.description || 'No description provided.'}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {formatDateTime(event.start_time ?? '')}
                          </span>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {isLive && (
                          <button
                            onClick={() => navigate(`/ctf/${event.id}/challenges`)}
                            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-500/25"
                          >
                            Enter Arena
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                        {isConcluded && (
                          <button
                            onClick={() => navigate(`/ctf/${event.id}/scoreboard`)}
                            className="flex items-center gap-1.5 bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
                          >
                            Scoreboard
                          </button>
                        )}
                        {isUpcoming && (
                          <button
                            disabled
                            className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700"
                          >
                            Starting Soon
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Team / Profile sidebar */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">My Team Details</h2>
            </div>

            {myTeam ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
                  <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">{myTeam.name}</h3>
                  <div className="flex justify-between items-center mt-2 text-xs">
                    <span className="font-medium text-slate-400">Invite Code:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      {myTeam.inviteCode}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-400">Leaderboard Rank:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">#{myTeam.rank}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-400">Total Points:</span>
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">{myTeam.totalPoints} pts</span>
                  </div>
                </div>

                {/* Team Members */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                  <h4 className="text-xs font-bold text-slate-500 mb-2">Team Operators</h4>
                  <div className="space-y-1.5">
                    {myTeam.members.map((member, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">{member}</span>
                        {member.includes('You') && (
                          <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-150 dark:border-indigo-900/35 px-1.5 py-0.5 rounded">
                            Operator
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm text-center space-y-4">
                <p className="text-xs text-slate-400">
                  CTFs are played in squads. Join an existing team or create a new team banner.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setTeamTab('join');
                      setIsTeamModalOpen(true);
                    }}
                    className="flex-1 text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 py-2 rounded-xl transition-colors"
                  >
                    Join Team
                  </button>
                  <button
                    onClick={() => {
                      setTeamTab('create');
                      setIsTeamModalOpen(true);
                    }}
                    className="flex-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl transition-colors shadow-md shadow-indigo-500/20"
                  >
                    Create Team
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Team Modal */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {teamTab === 'create' ? 'Create a Team' : 'Join a Team'}
              </h3>
              <button
                onClick={() => setIsTeamModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>

            {teamTab === 'create' ? (
              <form onSubmit={handleCreateTeam} className="space-y-4 pt-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Team Name</label>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="e.g. ZeroDay Hunters"
                    className="w-full text-sm rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 focus:border-indigo-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl transition-colors shadow-md"
                >
                  Create Team Banner
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoinTeam} className="space-y-4 pt-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Enter Team Invite Code</label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="e.g. ZD8824"
                    className="w-full text-sm rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 focus:border-indigo-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl transition-colors shadow-md"
                >
                  Request Squad Entry
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </UserLayout>
  );
};
