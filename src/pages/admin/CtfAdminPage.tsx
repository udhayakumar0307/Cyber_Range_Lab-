import React, { useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import type { CtfEvent, CtfChallenge, CtfSubmission, CtfCategory, CtfEventStatus, CtfPrize } from '../../types/ctf';
import { 
  Plus, 
  Snowflake, 
  Megaphone, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Trophy,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Square,
  Settings
} from 'lucide-react';

const INITIAL_EVENTS: CtfEvent[] = [
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
    maxTeamSize: 4,
    rateLimitAttempts: 5,
    rulesMarkdown: '### CTF Rules & Code of Conduct\n1. No denial of service against platform infrastructure.\n2. Flag sharing between teams is strictly prohibited.\n3. Brute forcing flags is rate-limited to 5 attempts/minute.',
    prizes: [
      { rank: 1, title: 'Champion Gold Trophy', reward: '₹50,000 Cash + Gold Certificate' },
      { rank: 2, title: 'Silver Runner-Up Badge', reward: '₹25,000 Cash + Silver Certificate' },
      { rank: 3, title: 'Bronze Podium Award', reward: '₹10,000 Cash + Bronze Certificate' },
    ],
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
    maxTeamSize: 1,
    rateLimitAttempts: 10,
    rulesMarkdown: 'Individual blitz rules apply.',
    prizes: [],
    isFrozen: false,
    isPublic: true,
    totalChallenges: 8,
    totalSolves: 0,
    participantCount: 42,
  }
];

const INITIAL_CHALLENGES: CtfChallenge[] = [
  {
    id: 'chal-1',
    eventId: 'ctf-1',
    title: 'SQLi Vault Breach',
    category: 'Web',
    description: 'Bypass the authentication endpoint on `http://vault.target.local` using second-order SQL injection.',
    basePoints: 500,
    minPoints: 100,
    decayRate: 15,
    currentPoints: 340,
    flag: 'CTF{sql_1nj3ct10n_m4st3r_2026}',
    hints: [
      { id: 'h1', text: 'Inspect the UNION SELECT payload on the search query param.', cost: 50, unlocked: false }
    ],
    solveCount: 14,
  },
  {
    id: 'chal-2',
    eventId: 'ctf-1',
    title: 'Buffer Overflow Payload Assembly',
    category: 'Pwn',
    description: 'Exploit a stack buffer overflow in the binary target to spawn a remote interactive bash shell.',
    basePoints: 500,
    minPoints: 150,
    decayRate: 10,
    currentPoints: 460,
    flag: 'CTF{pwn_r3t2libc_99_syst3m}',
    hints: [
      { id: 'h2', text: 'Use gdb to inspect the offset to EIP (76 bytes).', cost: 75, unlocked: false }
    ],
    solveCount: 4,
  },
  {
    id: 'chal-3',
    eventId: 'ctf-1',
    title: 'Corrupted PCAP Network Stream',
    category: 'Forensics',
    description: 'Reconstruct the exfiltrated ZIP archive hidden within TCP stream #14 of the attached capture file.',
    basePoints: 300,
    minPoints: 100,
    decayRate: 5,
    currentPoints: 220,
    flag: 'CTF{pcap_w1r3sh4rk_f0r3ns1cs}',
    hints: [],
    solveCount: 22,
  }
];

const INITIAL_SUBMISSIONS: CtfSubmission[] = [
  {
    id: 'sub-1',
    challengeId: 'chal-1',
    challengeTitle: 'SQLi Vault Breach',
    teamOrUserName: 'Team ZeroDay (Captain: Alex)',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    isCorrect: true,
    flagSubmitted: 'CTF{sql_1nj3ct10n_m4st3r_2026}',
    pointsEarned: 340,
  },
  {
    id: 'sub-2',
    challengeId: 'chal-2',
    challengeTitle: 'Buffer Overflow Payload Assembly',
    teamOrUserName: 'Binary Ninja (Operator)',
    timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    isCorrect: false,
    flagSubmitted: 'CTF{wrong_flag_attempt_000}',
    pointsEarned: 0,
  }
];

export const CtfAdminPage: React.FC = () => {
  const [events, setEvents] = useState<CtfEvent[]>(INITIAL_EVENTS);
  const [challenges, setChallenges] = useState<CtfChallenge[]>(INITIAL_CHALLENGES);
  const [submissions] = useState<CtfSubmission[]>(INITIAL_SUBMISSIONS);
  const [activeTab, setActiveTab] = useState<'events' | 'challenges' | 'submissions'>('challenges');

  const [activeEvent, setActiveEvent] = useState<CtfEvent>(INITIAL_EVENTS[0]);

  // Scoreboard Freeze state
  const [isFrozen, setIsFrozen] = useState(false);

  // Broadcast Modal State
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');

  // Challenge Modal State
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<CtfCategory>('Web');
  const [newDesc, setNewDesc] = useState('');
  const [newBasePoints, setNewBasePoints] = useState(500);
  const [newFlag, setNewFlag] = useState('');
  const [newHintText, setNewHintText] = useState('');

  // Full Configurator Wizard State
  const [isConfigWizardOpen, setIsConfigWizardOpen] = useState(false);
  const [wizardTab, setWizardTab] = useState<'meta' | 'rules' | 'scoring' | 'prizes'>('meta');
  const [cfgTitle, setCfgTitle] = useState(activeEvent.title);
  const [cfgDesc, setCfgDesc] = useState(activeEvent.description);
  const [cfgMode, setCfgMode] = useState(activeEvent.mode);
  const [cfgMaxTeamSize, setCfgMaxTeamSize] = useState(activeEvent.maxTeamSize || 4);
  const [cfgScoringType, setCfgScoringType] = useState(activeEvent.scoringType);
  const [cfgRateLimit, setCfgRateLimit] = useState(activeEvent.rateLimitAttempts || 5);
  const [cfgRulesMarkdown, setCfgRulesMarkdown] = useState(activeEvent.rulesMarkdown || '');
  const [cfgPrize1, setCfgPrize1] = useState(activeEvent.prizes?.[0]?.reward || '₹50,000 Cash');
  const [cfgPrize2, setCfgPrize2] = useState(activeEvent.prizes?.[1]?.reward || '₹25,000 Cash');
  const [cfgPrize3, setCfgPrize3] = useState(activeEvent.prizes?.[2]?.reward || '₹10,000 Cash');

  // Lifecycle Action Handlers
  const handleStartCompetition = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, status: 'live' as CtfEventStatus } : e))
    );
    setActiveEvent((prev) => ({ ...prev, status: 'live' }));
  };

  const handlePauseCompetition = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, status: 'paused' as CtfEventStatus } : e))
    );
    setActiveEvent((prev) => ({ ...prev, status: 'paused' }));
  };

  const handleResumeCompetition = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, status: 'live' as CtfEventStatus } : e))
    );
    setActiveEvent((prev) => ({ ...prev, status: 'live' }));
  };

  const handleExtendCompetition = (eventId: string, minutes: number) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const newEndMs = new Date(e.endTime).getTime() + minutes * 60 * 1000;
          return {
            ...e,
            endTime: new Date(newEndMs).toISOString(),
            extendedMinutes: (e.extendedMinutes || 0) + minutes,
          };
        }
        return e;
      })
    );
    setActiveEvent((prev) => {
      const newEndMs = new Date(prev.endTime).getTime() + minutes * 60 * 1000;
      return {
        ...prev,
        endTime: new Date(newEndMs).toISOString(),
        extendedMinutes: (prev.extendedMinutes || 0) + minutes,
      };
    });
  };

  const handleEndCompetition = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, status: 'concluded' as CtfEventStatus } : e))
    );
    setActiveEvent((prev) => ({ ...prev, status: 'concluded' }));
  };

  const handleToggleFreeze = () => {
    setIsFrozen(!isFrozen);
    setEvents((prev) =>
      prev.map((ev) => (ev.id === activeEvent.id ? { ...ev, isFrozen: !isFrozen } : ev))
    );
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle || !announcementContent) return;
    setAnnouncementTitle('');
    setAnnouncementContent('');
    setIsBroadcastOpen(false);
    alert('Broadcast Announcement pushed to all active CTF participants!');
  };

  const handleCreateChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    const newChal: CtfChallenge = {
      id: `chal-${Date.now()}`,
      eventId: activeEvent.id,
      title: newTitle || 'New Cryptographic Cipher',
      category: newCategory,
      description: newDesc || 'Decrypt the ciphertext payload using RSA public key parameters.',
      basePoints: Number(newBasePoints) || 500,
      minPoints: 100,
      decayRate: 10,
      currentPoints: Number(newBasePoints) || 500,
      flag: newFlag || 'CTF{sample_flag_solution_2026}',
      hints: newHintText ? [{ id: `h-${Date.now()}`, text: newHintText, cost: 50, unlocked: false }] : [],
      solveCount: 0,
    };
    setChallenges([newChal, ...challenges]);
    setIsChallengeModalOpen(false);
  };

  const handleSaveWizardConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedPrizes: CtfPrize[] = [
      { rank: 1, title: 'Gold Champion', reward: cfgPrize1 },
      { rank: 2, title: 'Silver Runner-Up', reward: cfgPrize2 },
      { rank: 3, title: 'Bronze Podium', reward: cfgPrize3 },
    ];

    const updatedEvent: CtfEvent = {
      ...activeEvent,
      title: cfgTitle,
      description: cfgDesc,
      mode: cfgMode,
      maxTeamSize: cfgMaxTeamSize,
      scoringType: cfgScoringType,
      rateLimitAttempts: cfgRateLimit,
      rulesMarkdown: cfgRulesMarkdown,
      prizes: updatedPrizes,
    };

    setEvents((prev) => prev.map((ev) => (ev.id === activeEvent.id ? updatedEvent : ev)));
    setActiveEvent(updatedEvent);
    setIsConfigWizardOpen(false);
  };

  const handleDeleteChallenge = (id: string) => {
    setChallenges((prev) => prev.filter((c) => c.id !== id));
  };

  const getStatusBadge = (status: CtfEventStatus) => {
    switch (status) {
      case 'live':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-emerald-400"></span> LIVE COMPETITION
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Pause className="w-3.5 h-3.5 mr-1" /> SUBMISSIONS PAUSED
          </span>
        );
      case 'upcoming':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <Clock className="w-3.5 h-3.5 mr-1" /> UPCOMING SCHEDULED
          </span>
        );
      case 'concluded':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-500/20 text-gray-300 border border-gray-500/30">
            <Square className="w-3.5 h-3.5 mr-1" /> COMPETITION CONCLUDED
          </span>
        );
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                <Trophy className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold text-gray-900">CTFd Competition Hub</h1>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Configure competition parameters, manage life cycle transitions, and operate live events.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsConfigWizardOpen(true)}
              className="inline-flex items-center px-3 py-2 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-xs rounded-lg border border-gray-300 shadow-xs transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4 mr-1.5 text-blue-600" /> Event Configurator
            </button>

            <button
              onClick={() => setIsBroadcastOpen(true)}
              className="inline-flex items-center px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-xs rounded-lg border border-purple-200 transition-colors cursor-pointer"
            >
              <Megaphone className="w-4 h-4 mr-1.5" /> Broadcast Notice
            </button>

            <button
              onClick={handleToggleFreeze}
              className={`inline-flex items-center px-3 py-2 font-semibold text-xs rounded-lg transition-colors cursor-pointer border ${
                isFrozen
                  ? 'bg-cyan-600 text-white border-cyan-700 hover:bg-cyan-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Snowflake className={`w-4 h-4 mr-1.5 ${isFrozen ? 'animate-spin' : 'text-cyan-500'}`} />
              {isFrozen ? 'Scoreboard FROZEN' : 'Freeze Scoreboard'}
            </button>

            <button
              onClick={() => setIsChallengeModalOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add CTF Challenge
            </button>
          </div>
        </div>

        {/* Active Event Banner Highlight Card */}
        {activeEvent && (
          <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden space-y-5">
            <div className="absolute right-0 top-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  {getStatusBadge(activeEvent.status)}
                  {activeEvent.extendedMinutes ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      +{activeEvent.extendedMinutes}m Extended
                    </span>
                  ) : null}
                  {isFrozen && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center">
                      <Snowflake className="w-3 h-3 mr-1" /> Scoreboard Frozen
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-extrabold tracking-tight">{activeEvent.title}</h2>
                <p className="text-xs text-gray-300">{activeEvent.description}</p>
              </div>

              {/* One-Click Admin Lifecycle Action Toolbar */}
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/15 flex flex-wrap items-center gap-2">
                {activeEvent.status !== 'live' && activeEvent.status !== 'concluded' && (
                  <button
                    onClick={() => handleStartCompetition(activeEvent.id)}
                    className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 mr-1" /> Start CTF Now
                  </button>
                )}

                {activeEvent.status === 'live' && (
                  <>
                    <button
                      onClick={() => handlePauseCompetition(activeEvent.id)}
                      className="inline-flex items-center px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-xs"
                    >
                      <Pause className="w-3.5 h-3.5 mr-1" /> Pause Submissions
                    </button>
                    <button
                      onClick={() => handleExtendCompetition(activeEvent.id, 60)}
                      className="inline-flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg shadow-xs"
                    >
                      +1h Extend
                    </button>
                    <button
                      onClick={() => handleEndCompetition(activeEvent.id)}
                      className="inline-flex items-center px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-xs"
                    >
                      <Square className="w-3.5 h-3.5 mr-1" /> Force End
                    </button>
                  </>
                )}

                {activeEvent.status === 'paused' && (
                  <button
                    onClick={() => handleResumeCompetition(activeEvent.id)}
                    className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Resume Event
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Controls */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('challenges')}
              className={`py-3 px-1 border-b-2 font-semibold text-sm transition-colors cursor-pointer ${
                activeTab === 'challenges'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Challenge Bank ({challenges.length})
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`py-3 px-1 border-b-2 font-semibold text-sm transition-colors cursor-pointer ${
                activeTab === 'events'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              CTF Competitions ({events.length})
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              className={`py-3 px-1 border-b-2 font-semibold text-sm transition-colors cursor-pointer ${
                activeTab === 'submissions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Live Submissions Feed ({submissions.length})
            </button>
          </nav>
        </div>

        {/* Tab 1: Challenge Bank Grid */}
        {activeTab === 'challenges' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {challenges.map((chal) => (
              <div
                key={chal.id}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-100 text-purple-700">
                      {chal.category}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {chal.currentPoints} pts (Base: {chal.basePoints})
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-gray-900">{chal.title}</h3>
                  <p className="text-xs text-gray-600 line-clamp-3">{chal.description}</p>
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs font-mono text-gray-500">
                    <span>Solves: {chal.solveCount} Users</span>
                    <span>Decay Rate: {chal.decayRate}%</span>
                  </div>

                  <div className="bg-gray-50 p-2 rounded-lg font-mono text-xs text-gray-700 truncate border border-gray-200">
                    <span className="font-bold text-gray-500 mr-2">FLAG:</span> {chal.flag}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-purple-600 font-semibold">
                      {chal.hints.length} Hint(s) Configured
                    </span>
                    <button
                      onClick={() => handleDeleteChallenge(chal.id)}
                      className="p-1 text-gray-400 hover:text-rose-600 transition-colors"
                      title="Delete Challenge"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: CTF Events Roster */}
        {activeTab === 'events' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4">Event Title</th>
                  <th className="py-3.5 px-4">Status & Mode</th>
                  <th className="py-3.5 px-4">Execution Window</th>
                  <th className="py-3.5 px-4">Competitors</th>
                  <th className="py-3.5 px-4 text-right">Lifecycle Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50/80">
                    <td className="py-4 px-4 font-bold text-gray-900 max-w-xs">{ev.title}</td>
                    <td className="py-4 px-4 space-y-1">
                      <div>{getStatusBadge(ev.status)}</div>
                      <span className="capitalize text-xs font-semibold text-gray-500 block">
                        {ev.mode} Mode (Max {ev.maxTeamSize || 4}/team)
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-gray-600">
                      <div>Start: {new Date(ev.startTime).toLocaleString()}</div>
                      <div>End: {new Date(ev.endTime).toLocaleString()}</div>
                    </td>
                    <td className="py-4 px-4 font-mono text-xs">
                      {ev.totalSolves} Solves / {ev.participantCount} Players
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {ev.status !== 'live' && ev.status !== 'concluded' && (
                          <button
                            onClick={() => handleStartCompetition(ev.id)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded border border-emerald-200"
                          >
                            Start
                          </button>
                        )}
                        {ev.status === 'live' && (
                          <button
                            onClick={() => handlePauseCompetition(ev.id)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded border border-amber-200"
                          >
                            Pause
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setActiveEvent(ev);
                            setIsConfigWizardOpen(true);
                          }}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded"
                        >
                          Configure
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Submissions Audit Feed */}
        {activeTab === 'submissions' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Real-Time Submission Stream</h3>
            <div className="space-y-3">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
                    sub.isCorrect
                      ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50/50 border-rose-200 text-rose-950'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {sub.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm">{sub.teamOrUserName}</span>
                        <span className="text-xs font-mono text-gray-500">• {new Date(sub.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs font-medium mt-0.5">
                        Challenge: <span className="font-bold">{sub.challengeTitle}</span> — Submitted Flag: <code className="bg-white/80 px-1.5 py-0.5 rounded text-[11px]">{sub.flagSubmitted}</code>
                      </p>
                    </div>
                  </div>

                  {sub.isCorrect && (
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      +{sub.pointsEarned} pts
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Multi-Section Event Configuration Wizard Modal */}
        {isConfigWizardOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-gray-100 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-gray-900">CTF Competition Configurator</h3>
                </div>
                <button onClick={() => setIsConfigWizardOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                  ✕
                </button>
              </div>

              {/* Config Wizard Tabs */}
              <div className="grid grid-cols-4 gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setWizardTab('meta')}
                  className={`py-2 rounded-lg transition-colors ${
                    wizardTab === 'meta' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Metadata & Mode
                </button>
                <button
                  type="button"
                  onClick={() => setWizardTab('scoring')}
                  className={`py-2 rounded-lg transition-colors ${
                    wizardTab === 'scoring' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Scoring & Rate Limits
                </button>
                <button
                  type="button"
                  onClick={() => setWizardTab('rules')}
                  className={`py-2 rounded-lg transition-colors ${
                    wizardTab === 'rules' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Rules (Markdown)
                </button>
                <button
                  type="button"
                  onClick={() => setWizardTab('prizes')}
                  className={`py-2 rounded-lg transition-colors ${
                    wizardTab === 'prizes' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Prizes & Awards
                </button>
              </div>

              <form onSubmit={handleSaveWizardConfig} className="space-y-4">
                {wizardTab === 'meta' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        Event Title
                      </label>
                      <input
                        type="text"
                        required
                        value={cfgTitle}
                        onChange={(e) => setCfgTitle(e.target.value)}
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        Description Summary
                      </label>
                      <textarea
                        rows={2}
                        value={cfgDesc}
                        onChange={(e) => setCfgDesc(e.target.value)}
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                          Participation Mode
                        </label>
                        <select
                          value={cfgMode}
                          onChange={(e) => setCfgMode(e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="team">Team Competition</option>
                          <option value="individual">Individual Operators</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                          Max Team Size ({cfgMaxTeamSize} Players)
                        </label>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={cfgMaxTeamSize}
                          onChange={(e) => setCfgMaxTeamSize(Number(e.target.value))}
                          className="w-full mt-2"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardTab === 'scoring' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                          Scoring Formula Model
                        </label>
                        <select
                          value={cfgScoringType}
                          onChange={(e) => setCfgScoringType(e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="dynamic">Dynamic Decay (Solves reduce value)</option>
                          <option value="static">Static Fixed Points</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                          Flag Rate Limit (Attempts/Min)
                        </label>
                        <input
                          type="number"
                          value={cfgRateLimit}
                          onChange={(e) => setCfgRateLimit(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardTab === 'rules' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Event Code of Conduct & Rules (Markdown)
                    </label>
                    <textarea
                      rows={6}
                      value={cfgRulesMarkdown}
                      onChange={(e) => setCfgRulesMarkdown(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {wizardTab === 'prizes' && (
                  <div className="space-y-3">
                    <span className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Podium Rewards Breakdown
                    </span>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-amber-700 font-bold block">1st Place Gold Prize</label>
                        <input
                          type="text"
                          value={cfgPrize1}
                          onChange={(e) => setCfgPrize1(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-700 font-bold block">2nd Place Silver Prize</label>
                        <input
                          type="text"
                          value={cfgPrize2}
                          onChange={(e) => setCfgPrize2(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-amber-800 font-bold block">3rd Place Bronze Prize</label>
                        <input
                          type="text"
                          value={cfgPrize3}
                          onChange={(e) => setCfgPrize3(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsConfigWizardOpen(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                  >
                    Save Configuration
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Broadcast Announcement Modal */}
        {isBroadcastOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-base font-bold text-purple-900 flex items-center">
                  <Megaphone className="w-4 h-4 mr-2 text-purple-600" /> Push Broadcast Alert
                </h3>
                <button onClick={() => setIsBroadcastOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSendBroadcast} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Announcement Headline
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Scoreboard Freeze Active / New Challenge Released!"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Announcement Content
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide details for all connected competitors..."
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsBroadcastOpen(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm"
                  >
                    Push Broadcast
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Challenge Modal */}
        {isChallengeModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-lg font-bold text-gray-900">Add Jeopardy CTF Challenge</h3>
                <button onClick={() => setIsChallengeModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateChallenge} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Challenge Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Reverse Memory Cipher"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as CtfCategory)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Web">Web Exploitation</option>
                      <option value="Pwn">Binary Exploitation (Pwn)</option>
                      <option value="Reverse">Reverse Engineering</option>
                      <option value="Crypto">Cryptography</option>
                      <option value="Forensics">Digital Forensics</option>
                      <option value="OSINT">OSINT</option>
                      <option value="Misc">Miscellaneous</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Description & Instructions (Markdown)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Analyze target host at http://... and locate the hidden flag."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Base Points
                    </label>
                    <input
                      type="number"
                      required
                      value={newBasePoints}
                      onChange={(e) => setNewBasePoints(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Flag Solution String
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="CTF{...}"
                      value={newFlag}
                      onChange={(e) => setNewFlag(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Unlockable Hint (50pt Deduction)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Check offset in gdb analysis..."
                    value={newHintText}
                    onChange={(e) => setNewHintText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsChallengeModalOpen(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                  >
                    Save Challenge
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
