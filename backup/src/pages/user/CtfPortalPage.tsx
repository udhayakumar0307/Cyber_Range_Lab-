import React, { useState } from 'react';
import { UserLayout } from '../../components/user/UserLayout';
import type { CtfEvent, CtfTeam, CtfEventStatus } from '../../types/ctf';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, 
  Clock, 
  ArrowRight, 
  Award,
  Sparkles,
  Pause,
  Square
} from 'lucide-react';

const MOCK_EVENTS: CtfEvent[] = [
  {
    id: 'ctf-1',
    title: 'CyberRange National Cyber Defense Championship 2026',
    description: 'Premier Jeopardy & Attack-Defense competition testing binary exploitation, web vulnerabilities, digital forensics, and cryptography.',
    bannerUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    startTime: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 240 * 60 * 1000).toISOString(),
    mode: 'team',
    scoringType: 'dynamic',
    status: 'live',
    isFrozen: false,
    isPublic: true,
    totalChallenges: 12,
    totalSolves: 184,
    participantCount: 86,
  },
  {
    id: 'ctf-2',
    title: 'Autumn Red Team Invitational (Solo Operators)',
    description: 'Individual operator blitz tournament focused on rapid SUID privilege escalation and OSINT threat mapping.',
    startTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    mode: 'individual',
    scoringType: 'static',
    status: 'upcoming',
    isFrozen: false,
    isPublic: true,
    totalChallenges: 8,
    totalSolves: 0,
    participantCount: 42,
  }
];

export const CtfPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const [events] = useState<CtfEvent[]>(MOCK_EVENTS);
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

  const renderStatusBadge = (status: CtfEventStatus) => {
    switch (status) {
      case 'live':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 animate-pulse">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-emerald-500"></span> Live Competition
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
            <Pause className="w-3.5 h-3.5 mr-1 text-amber-600" /> Submissions Paused
          </span>
        );
      case 'upcoming':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
            <Clock className="w-3.5 h-3.5 mr-1" /> Upcoming Scheduled
          </span>
        );
      case 'concluded':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
            <Square className="w-3.5 h-3.5 mr-1 text-gray-500" /> Concluded
          </span>
        );
    }
  };

  return (
    <UserLayout>
      <div className="space-y-8">
        {/* Banner */}
        <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-8 shadow-xl overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider border border-purple-500/30">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Competition Arena
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">Cyber Range CTF Tournaments</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                Test your security exploitation capabilities in Jeopardy and Attack-Defense challenges. Solve flags, unlock hints, and compete for global rank standings.
              </p>
            </div>

            {/* My Team Badge Widget */}
            <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15 min-w-[280px]">
              {myTeam ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Your Team</span>
                    <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                      Rank #{myTeam.rank}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{myTeam.name}</h3>
                  <div className="flex items-center justify-between text-xs text-gray-300 font-mono pt-1">
                    <span>Code: <code className="text-white font-bold">{myTeam.inviteCode}</code></span>
                    <span>Score: <strong className="text-purple-300">{myTeam.totalPoints} pts</strong></span>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <p className="text-xs text-gray-300 font-medium">Not currently in a CTF team</p>
                  <button
                    onClick={() => setIsTeamModalOpen(true)}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
                  >
                    Create or Join Team
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Competition Event Cards */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-purple-600" /> Active & Upcoming CTF Events
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    {renderStatusBadge(event.status)}

                    <span className="text-xs font-semibold px-2.5 py-1 bg-purple-50 text-purple-700 rounded-md capitalize border border-purple-100">
                      {event.mode} Mode ({event.scoringType})
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">{event.description}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-xl text-center text-xs font-mono border border-gray-200">
                    <div>
                      <span className="text-gray-400 text-[10px] block uppercase">Challenges</span>
                      <span className="font-bold text-gray-900 text-sm">{event.totalChallenges}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block uppercase">Solves</span>
                      <span className="font-bold text-emerald-600 text-sm">{event.totalSolves}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block uppercase">Players</span>
                      <span className="font-bold text-purple-600 text-sm">{event.participantCount}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50/80 px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => navigate(`/ctf/events/${event.id}/scoreboard`)}
                    className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center"
                  >
                    <Award className="w-4 h-4 mr-1" /> View Leaderboard
                  </button>

                  <button
                    onClick={() => navigate(`/ctf/events/${event.id}`)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Enter Competition Arena <ArrowRight className="w-4 h-4 ml-1.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal: Team Registration */}
        {isTeamModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-lg font-bold text-gray-900">CTF Team Portal Setup</h3>
                <button onClick={() => setIsTeamModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                  ✕
                </button>
              </div>

              {/* Toggle Tabs */}
              <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setTeamTab('create')}
                  className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                    teamTab === 'create' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Create New Team
                </button>
                <button
                  onClick={() => setTeamTab('join')}
                  className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                    teamTab === 'join' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Join Existing Team
                </button>
              </div>

              {teamTab === 'create' ? (
                <form onSubmit={handleCreateTeam} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Team Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Binary Hunters"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    You will become the Team Captain. A unique 6-digit invite code will be generated to share with your teammates.
                  </p>
                  <div className="flex items-center justify-end space-x-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setIsTeamModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm"
                    >
                      Create Team
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleJoinTeam} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Enter Team Invite Code
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ZD8824"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-mono tracking-widest uppercase focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Ask your team captain for the 6-character access code to join their roster.
                  </p>
                  <div className="flex items-center justify-end space-x-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setIsTeamModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm"
                    >
                      Join Roster
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
};
