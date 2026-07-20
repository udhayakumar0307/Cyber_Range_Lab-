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
  Settings,
  Copy,
  ChevronRight,
  ChevronLeft,
  Filter,
  BookOpen,
} from 'lucide-react';

// ─── Seed Data ────────────────────────────────────────────────────────────────

const INITIAL_EVENTS: CtfEvent[] = [
  {
    id: 'ctf-1',
    title: 'CyberRange National Cyber Defense Championship 2026',
    description:
      'Premier Jeopardy & Attack-Defense competition testing binary exploitation, web vulnerabilities, digital forensics, and cryptography.',
    bannerUrl:
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    startTime: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 240 * 60 * 1000).toISOString(),
    mode: 'team',
    scoringType: 'dynamic',
    status: 'live',
    maxTeamSize: 4,
    rateLimitAttempts: 5,
    rulesMarkdown:
      '### CTF Rules & Code of Conduct\n1. No denial of service against platform infrastructure.\n2. Flag sharing between teams is strictly prohibited.\n3. Brute forcing flags is rate-limited to 5 attempts/minute.',
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
    description:
      'Individual operator blitz tournament focused on rapid SUID privilege escalation and OSINT threat mapping.',
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
  },
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
    hints: [{ id: 'h1', text: 'Inspect the UNION SELECT payload on the search query param.', cost: 50, unlocked: false }],
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
    hints: [{ id: 'h2', text: 'Use gdb to inspect the offset to EIP (76 bytes).', cost: 75, unlocked: false }],
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
  },
  {
    id: 'chal-4',
    eventId: 'ctf-2',
    title: 'SUID Binary Escalation',
    category: 'Pwn',
    description: 'Locate and abuse a misconfigured SUID binary on the target host to escalate to root and read /root/flag.txt.',
    basePoints: 400,
    minPoints: 120,
    decayRate: 8,
    currentPoints: 400,
    flag: 'CTF{suid_privesc_r00t_2026}',
    hints: [{ id: 'h4', text: 'Run `find / -perm -4000 2>/dev/null` to locate SUID binaries.', cost: 40, unlocked: false }],
    solveCount: 0,
  },
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
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const CtfAdminPage: React.FC = () => {
  const [events, setEvents] = useState<CtfEvent[]>(INITIAL_EVENTS);
  const [challenges, setChallenges] = useState<CtfChallenge[]>(INITIAL_CHALLENGES);
  const [submissions] = useState<CtfSubmission[]>(INITIAL_SUBMISSIONS);
  const [activeTab, setActiveTab] = useState<'events' | 'challenges' | 'submissions'>('challenges');
  const [activeEvent, setActiveEvent] = useState<CtfEvent>(INITIAL_EVENTS[0]);

  // ── Task 1.2: Challenge Bank filter state
  const [selectedEventFilter, setSelectedEventFilter] = useState<'all' | string>('all');

  // Task 1.3: Derived filtered challenges
  const filteredChallenges =
    selectedEventFilter === 'all'
      ? challenges
      : challenges.filter((c) => c.eventId === selectedEventFilter);

  // Scoreboard Freeze
  const [isFrozen, setIsFrozen] = useState(false);

  // Broadcast Modal
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');

  // ── Challenge Creator Modal (Task 4)
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<CtfCategory>('Web');
  const [newDesc, setNewDesc] = useState('');
  const [newBasePoints, setNewBasePoints] = useState(500);
  const [newFlag, setNewFlag] = useState('');
  const [newHintText, setNewHintText] = useState('');
  const [newChallengeEventId, setNewChallengeEventId] = useState<string>(INITIAL_EVENTS[0].id); // Task 4.1

  // ── Config Wizard (existing)
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

  // ── Task 2: Create New CTF Event Wizard
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3 | 4>(1);
  // Step 1 fields
  const [newEvTitle, setNewEvTitle] = useState('');
  const [newEvTagline, setNewEvTagline] = useState('');
  const [newEvDesc, setNewEvDesc] = useState('');
  const [newEvBanner, setNewEvBanner] = useState('');
  const [newEvStart, setNewEvStart] = useState('');
  const [newEvEnd, setNewEvEnd] = useState('');
  const [newEvPublic, setNewEvPublic] = useState(true);
  // Step 2 fields
  const [newEvMode, setNewEvMode] = useState<'team' | 'individual'>('team');
  const [newEvMaxTeam, setNewEvMaxTeam] = useState(4);
  const [newEvAccessCode, setNewEvAccessCode] = useState(false);
  // Step 3 fields
  const [newEvScoring, setNewEvScoring] = useState<'static' | 'dynamic'>('dynamic');
  const [newEvBasePoints, setNewEvBasePoints] = useState(500);
  const [newEvMinPoints, setNewEvMinPoints] = useState(100);
  const [newEvRateLimit, setNewEvRateLimit] = useState(5);
  // Step 4 fields
  const [newEvRules, setNewEvRules] = useState('### Rules & Code of Conduct\n1. No flag sharing.\n2. No DoS attacks on platform infrastructure.');
  const [newEvPrize1, setNewEvPrize1] = useState('₹50,000 Cash + Gold Certificate');
  const [newEvPrize2, setNewEvPrize2] = useState('₹25,000 Cash + Silver Certificate');
  const [newEvPrize3, setNewEvPrize3] = useState('₹10,000 Cash + Bronze Certificate');

  // ── Task 5: Clone Modal
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [challengeToClone, setChallengeToClone] = useState<CtfChallenge | null>(null);
  const [cloneTargetEventId, setCloneTargetEventId] = useState<string>(INITIAL_EVENTS[0].id);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const resetCreateEventWizard = () => {
    setCreateStep(1);
    setNewEvTitle(''); setNewEvTagline(''); setNewEvDesc(''); setNewEvBanner('');
    setNewEvStart(''); setNewEvEnd(''); setNewEvPublic(true);
    setNewEvMode('team'); setNewEvMaxTeam(4); setNewEvAccessCode(false);
    setNewEvScoring('dynamic'); setNewEvBasePoints(500); setNewEvMinPoints(100); setNewEvRateLimit(5);
    setNewEvRules('### Rules & Code of Conduct\n1. No flag sharing.\n2. No DoS attacks on platform infrastructure.');
    setNewEvPrize1('₹50,000 Cash + Gold Certificate');
    setNewEvPrize2('₹25,000 Cash + Silver Certificate');
    setNewEvPrize3('₹10,000 Cash + Bronze Certificate');
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

  // ─── Lifecycle Handlers ─────────────────────────────────────────────────────

  const handleStartCompetition = (eventId: string) => {
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, status: 'live' as CtfEventStatus } : e)));
    setActiveEvent((prev) => ({ ...prev, status: 'live' }));
  };

  const handlePauseCompetition = (eventId: string) => {
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, status: 'paused' as CtfEventStatus } : e)));
    setActiveEvent((prev) => ({ ...prev, status: 'paused' }));
  };

  const handleResumeCompetition = (eventId: string) => {
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, status: 'live' as CtfEventStatus } : e)));
    setActiveEvent((prev) => ({ ...prev, status: 'live' }));
  };

  const handleExtendCompetition = (eventId: string, minutes: number) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const newEndMs = new Date(e.endTime).getTime() + minutes * 60 * 1000;
          return { ...e, endTime: new Date(newEndMs).toISOString(), extendedMinutes: (e.extendedMinutes || 0) + minutes };
        }
        return e;
      })
    );
    setActiveEvent((prev) => {
      const newEndMs = new Date(prev.endTime).getTime() + minutes * 60 * 1000;
      return { ...prev, endTime: new Date(newEndMs).toISOString(), extendedMinutes: (prev.extendedMinutes || 0) + minutes };
    });
  };

  const handleEndCompetition = (eventId: string) => {
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, status: 'concluded' as CtfEventStatus } : e)));
    setActiveEvent((prev) => ({ ...prev, status: 'concluded' }));
  };

  const handleToggleFreeze = () => {
    setIsFrozen(!isFrozen);
    setEvents((prev) => prev.map((ev) => (ev.id === activeEvent.id ? { ...ev, isFrozen: !isFrozen } : ev)));
  };

  // ─── Broadcast ──────────────────────────────────────────────────────────────

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle || !announcementContent) return;
    setAnnouncementTitle('');
    setAnnouncementContent('');
    setIsBroadcastOpen(false);
    alert('Broadcast Announcement pushed to all active CTF participants!');
  };

  // ─── Challenge CRUD ──────────────────────────────────────────────────────────

  const handleCreateChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    const newChal: CtfChallenge = {
      id: `chal-${Date.now()}`,
      eventId: newChallengeEventId, // Task 4.3: use selected event
      title: newTitle || 'New Challenge',
      category: newCategory,
      description: newDesc || 'Exploit the target system and retrieve the flag.',
      basePoints: Number(newBasePoints) || 500,
      minPoints: 100,
      decayRate: 10,
      currentPoints: Number(newBasePoints) || 500,
      flag: newFlag || 'CTF{sample_flag_solution_2026}',
      hints: newHintText ? [{ id: `h-${Date.now()}`, text: newHintText, cost: 50, unlocked: false }] : [],
      solveCount: 0,
    };
    setChallenges([newChal, ...challenges]);
    // Update event challenge count
    setEvents((prev) =>
      prev.map((ev) => ev.id === newChallengeEventId ? { ...ev, totalChallenges: ev.totalChallenges + 1 } : ev)
    );
    setNewTitle(''); setNewCategory('Web'); setNewDesc(''); setNewBasePoints(500); setNewFlag(''); setNewHintText('');
    setIsChallengeModalOpen(false);
  };

  const handleDeleteChallenge = (id: string) => {
    setChallenges((prev) => prev.filter((c) => c.id !== id));
  };

  // ─── Task 5: Clone Challenge ─────────────────────────────────────────────────

  const handleOpenClone = (chal: CtfChallenge) => {
    setChallengeToClone(chal);
    setCloneTargetEventId(events[0].id);
    setIsCloneModalOpen(true);
  };

  const handleConfirmClone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToClone) return;
    const cloned: CtfChallenge = {
      ...challengeToClone,
      id: `chal-clone-${Date.now()}`,
      eventId: cloneTargetEventId,
      isSolved: false,
      solveCount: 0,
      hints: challengeToClone.hints.map((h) => ({ ...h, unlocked: false })),
    };
    setChallenges((prev) => [cloned, ...prev]);
    setEvents((prev) =>
      prev.map((ev) => ev.id === cloneTargetEventId ? { ...ev, totalChallenges: ev.totalChallenges + 1 } : ev)
    );
    setIsCloneModalOpen(false);
    setChallengeToClone(null);
  };

  // ─── Config Wizard ───────────────────────────────────────────────────────────

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

  // ─── Task 2.8: Publish New CTF Event ────────────────────────────────────────

  const handlePublishEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const prizes: CtfPrize[] = [
      { rank: 1, title: 'Gold Champion', reward: newEvPrize1 },
      { rank: 2, title: 'Silver Runner-Up', reward: newEvPrize2 },
      { rank: 3, title: 'Bronze Podium', reward: newEvPrize3 },
    ];
    const newEvent: CtfEvent = {
      id: `ctf-${Date.now()}`,
      title: newEvTitle,
      description: newEvDesc,
      bannerUrl: newEvBanner || undefined,
      startTime: newEvStart ? new Date(newEvStart).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      endTime: newEvEnd ? new Date(newEvEnd).toISOString() : new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      mode: newEvMode,
      scoringType: newEvScoring,
      status: 'upcoming',
      maxTeamSize: newEvMaxTeam,
      rateLimitAttempts: newEvRateLimit,
      rulesMarkdown: newEvRules,
      prizes,
      isFrozen: false,
      isPublic: newEvPublic,
      totalChallenges: 0,
      totalSolves: 0,
      participantCount: 0,
    };
    setEvents((prev) => [...prev, newEvent]);
    setIsCreateEventOpen(false);
    resetCreateEventWizard();
    // Switch to events tab to see the new competition
    setActiveTab('events');
  };

  // ─── Task 3.3: Jump to event challenge bank ──────────────────────────────────

  const handleManageChallenges = (eventId: string) => {
    setSelectedEventFilter(eventId);
    setActiveTab('challenges');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="space-y-6 animate-in fade-in duration-200">

        {/* ── Top Header Action Bar ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-xl">
                <Trophy className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">CTFd Competition Control Center</h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Create competitions, manage challenge banks, and operate live events.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Task 2.1: Create New CTF Event button */}
            <button
              onClick={() => { setIsCreateEventOpen(true); setCreateStep(1); }}
              className="inline-flex items-center px-4 py-2.5 bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create New CTF Event
            </button>

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

        {/* ── Active Event Banner ────────────────────────────────────────────── */}
        {activeEvent && (
          <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
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

              {/* Lifecycle Action Toolbar */}
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/15 flex flex-wrap items-center gap-2">
                {activeEvent.status !== 'live' && activeEvent.status !== 'concluded' && (
                  <button
                    onClick={() => handleStartCompetition(activeEvent.id)}
                    className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg"
                  >
                    <Play className="w-3.5 h-3.5 mr-1" /> Start CTF Now
                  </button>
                )}
                {activeEvent.status === 'live' && (
                  <>
                    <button onClick={() => handlePauseCompetition(activeEvent.id)} className="inline-flex items-center px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg">
                      <Pause className="w-3.5 h-3.5 mr-1" /> Pause Submissions
                    </button>
                    <button onClick={() => handleExtendCompetition(activeEvent.id, 60)} className="inline-flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg">
                      +1h Extend
                    </button>
                    <button onClick={() => handleEndCompetition(activeEvent.id)} className="inline-flex items-center px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg">
                      <Square className="w-3.5 h-3.5 mr-1" /> Force End
                    </button>
                  </>
                )}
                {activeEvent.status === 'paused' && (
                  <button onClick={() => handleResumeCompetition(activeEvent.id)} className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg">
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Resume Event
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab Controls ──────────────────────────────────────────────────── */}
        <div className="border-b border-slate-200 dark:border-slate-800">
          <nav className="flex space-x-8">
            {(['challenges', 'events', 'submissions'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-1 border-b-2 font-bold text-xs transition-colors cursor-pointer capitalize ${
                  activeTab === tab
                    ? 'border-[#0052CC] dark:border-blue-400 text-[#0052CC] dark:text-blue-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab === 'challenges' && `Challenge Bank (${filteredChallenges.length})`}
                {tab === 'events' && `CTF Competitions (${events.length})`}
                {tab === 'submissions' && `Live Submissions Feed (${submissions.length})`}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Tab 1: Challenge Bank ─────────────────────────────────────────── */}
        {activeTab === 'challenges' && (
          <div className="space-y-4">
            {/* Task 3.1: Global Filter Dropdown */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Filter by CTF Event:</span>
                <select
                  value={selectedEventFilter}
                  onChange={(e) => setSelectedEventFilter(e.target.value)}
                  className="text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-[#0052CC]/20 outline-none text-slate-800 dark:text-slate-100"
                >
                  <option value="all">All Events ({challenges.length} Challenges)</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({challenges.filter((c) => c.eventId === ev.id).length} challenges)
                    </option>
                  ))}
                </select>
              </div>
              {selectedEventFilter !== 'all' && (
                <button
                  onClick={() => setSelectedEventFilter('all')}
                  className="text-xs font-bold text-[#0052CC] dark:text-blue-400 hover:underline"
                >
                  Clear Filter → Show All
                </button>
              )}
            </div>

            {filteredChallenges.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-extrabold text-slate-500 dark:text-slate-400">No Challenges Found</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Add the first challenge to this CTF event using the button above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredChallenges.map((chal) => {
                  const parentEvent = events.find((ev) => ev.id === chal.eventId);
                  return (
                    <div
                      key={chal.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            {chal.category}
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            {chal.currentPoints} pts
                          </span>
                        </div>
                        <h3 className="text-base font-black text-slate-900 dark:text-slate-100">{chal.title}</h3>
                        {/* Show parent event label */}
                        {parentEvent && (
                          <span className="inline-flex items-center text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800 max-w-full truncate">
                            📁 {parentEvent.title}
                          </span>
                        )}
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{chal.description}</p>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between text-xs font-mono text-gray-500">
                          <span>Solves: {chal.solveCount}</span>
                          <span>Decay: {chal.decayRate}%</span>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg font-mono text-xs text-gray-700 truncate border border-gray-200">
                          <span className="font-bold text-gray-500 mr-1">FLAG:</span> {chal.flag}
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-purple-600 font-semibold">{chal.hints.length} Hint(s)</span>
                          <div className="flex items-center space-x-1">
                            {/* Task 5.1: Clone button */}
                            <button
                              onClick={() => handleOpenClone(chal)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Clone Challenge to another CTF Event"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: CTF Events Roster ──────────────────────────────────────── */}
        {activeTab === 'events' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Event Title</th>
                    <th className="py-3.5 px-4">Status & Mode</th>
                    <th className="py-3.5 px-4">Execution Window</th>
                    <th className="py-3.5 px-4">Competitors</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-4 px-4 font-black text-slate-900 dark:text-slate-100 max-w-xs">{ev.title}</td>
                      <td className="py-4 px-4 space-y-1">
                        <div>{getStatusBadge(ev.status)}</div>
                        <span className="capitalize text-xs font-bold text-slate-500 dark:text-slate-400 block">
                          {ev.mode} Mode (Max {ev.maxTeamSize || 4}/team)
                        </span>
                      </td>
                      <td className="py-4 px-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                        <div>Start: {new Date(ev.startTime).toLocaleString()}</div>
                        <div>End: {new Date(ev.endTime).toLocaleString()}</div>
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-slate-800 dark:text-slate-200">
                        {ev.totalSolves} Solves / {ev.participantCount} Players
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2 flex-wrap gap-y-1">
                          {ev.status !== 'live' && ev.status !== 'concluded' && (
                            <button
                              onClick={() => handleStartCompetition(ev.id)}
                              className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-[#28A745] dark:text-emerald-400 text-xs font-bold rounded-lg border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                            >
                              Start
                            </button>
                          )}
                          {ev.status === 'live' && (
                            <button
                              onClick={() => handlePauseCompetition(ev.id)}
                              className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-lg border border-amber-200 dark:border-amber-800 cursor-pointer"
                            >
                              Pause
                            </button>
                          )}
                          {/* Task 3.3: Manage Challenges button */}
                          <button
                            onClick={() => handleManageChallenges(ev.id)}
                            className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-[#0052CC] dark:text-blue-400 text-xs font-bold rounded-lg border border-blue-200 dark:border-blue-800 flex items-center space-x-1 cursor-pointer"
                          >
                          <BookOpen className="w-3 h-3" />
                          <span>Manage Challenges ({challenges.filter((c) => c.eventId === ev.id).length})</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveEvent(ev);
                            setCfgTitle(ev.title);
                            setCfgDesc(ev.description);
                            setCfgMode(ev.mode);
                            setCfgMaxTeamSize(ev.maxTeamSize || 4);
                            setCfgScoringType(ev.scoringType);
                            setCfgRateLimit(ev.rateLimitAttempts || 5);
                            setCfgRulesMarkdown(ev.rulesMarkdown || '');
                            setCfgPrize1(ev.prizes?.[0]?.reward || '');
                            setCfgPrize2(ev.prizes?.[1]?.reward || '');
                            setCfgPrize3(ev.prizes?.[2]?.reward || '');
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
        </div>
      )}

        {/* ── Tab 3: Submissions Audit Feed ─────────────────────────────────── */}
        {activeTab === 'submissions' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Real-Time Submission Stream</h3>
            <div className="space-y-3">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
                    sub.isCorrect
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-slate-900 dark:text-slate-100'
                      : 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-slate-900 dark:text-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {sub.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{sub.teamOrUserName}</span>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">• {new Date(sub.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs font-medium mt-0.5 text-slate-600 dark:text-slate-300">
                        Challenge: <span className="font-bold text-slate-800 dark:text-slate-200">{sub.challengeTitle}</span> — Flag:{' '}
                        <code className="bg-white/80 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-900 dark:text-slate-100">{sub.flagSubmitted}</code>
                      </p>
                    </div>
                  </div>
                  {sub.isCorrect && (
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">+{sub.pointsEarned} pts</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── Task 2: Create New CTF Event Wizard Modal ─────────────────────── */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {isCreateEventOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <Plus className="w-5 h-5 mr-2 text-emerald-600" /> Create New CTF Competition
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Step {createStep} of 4</p>
                </div>
                <button onClick={() => setIsCreateEventOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
              </div>

              {/* Step Progress Bar */}
              <div className="flex space-x-1">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`flex-1 h-1.5 rounded-full transition-colors ${
                      s <= createStep ? 'bg-emerald-500' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>

              <form onSubmit={createStep === 4 ? handlePublishEvent : (e) => { e.preventDefault(); setCreateStep((prev) => Math.min(prev + 1, 4) as any); }}>
                {/* Step 1: General Metadata */}
                {createStep === 1 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Step 1 — General Metadata</h4>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Event Title *</label>
                      <input required type="text" value={newEvTitle} onChange={(e) => setNewEvTitle(e.target.value)} placeholder="e.g. CyberRange Winter Invitational 2026" className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Tagline</label>
                      <input type="text" value={newEvTagline} onChange={(e) => setNewEvTagline(e.target.value)} placeholder="e.g. Hack the planet. Claim your rank." className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Description</label>
                      <textarea rows={3} value={newEvDesc} onChange={(e) => setNewEvDesc(e.target.value)} placeholder="What is this competition about?" className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Start Date & Time</label>
                        <input type="datetime-local" value={newEvStart} onChange={(e) => setNewEvStart(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">End Date & Time</label>
                        <input type="datetime-local" value={newEvEnd} onChange={(e) => setNewEvEnd(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Banner Image URL (optional)</label>
                      <input type="url" value={newEvBanner} onChange={(e) => setNewEvBanner(e.target.value)} placeholder="https://..." className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={newEvPublic} onChange={(e) => setNewEvPublic(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                      <span className="text-sm font-semibold text-gray-700">Publicly Visible to Students</span>
                    </label>
                  </div>
                )}

                {/* Step 2: Participation & Sizing */}
                {createStep === 2 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Step 2 — Participation & Sizing</h4>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Participation Mode</label>
                      <select value={newEvMode} onChange={(e) => setNewEvMode(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                        <option value="team">Team Competition</option>
                        <option value="individual">Individual Operators</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        Max Team Size: <span className="text-emerald-600 font-bold">{newEvMaxTeam} Players</span>
                      </label>
                      <input type="range" min={1} max={5} value={newEvMaxTeam} onChange={(e) => setNewEvMaxTeam(Number(e.target.value))} className="w-full mt-1" />
                      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                        <span>Solo (1)</span><span>5 Players Max</span>
                      </div>
                    </div>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={newEvAccessCode} onChange={(e) => setNewEvAccessCode(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                      <span className="text-sm font-semibold text-gray-700">Require Access/Registration Code to Join</span>
                    </label>
                  </div>
                )}

                {/* Step 3: Scoring & Rate Limits */}
                {createStep === 3 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Step 3 — Scoring & Security</h4>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Scoring Model</label>
                      <select value={newEvScoring} onChange={(e) => setNewEvScoring(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                        <option value="dynamic">Dynamic Decay — Points decrease as more teams solve</option>
                        <option value="static">Static Fixed Points — Points are fixed per challenge</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Default Base Points</label>
                        <input type="number" value={newEvBasePoints} onChange={(e) => setNewEvBasePoints(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Minimum Points Floor</label>
                        <input type="number" value={newEvMinPoints} onChange={(e) => setNewEvMinPoints(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Flag Attempt Rate Limit (per minute)</label>
                      <input type="number" value={newEvRateLimit} onChange={(e) => setNewEvRateLimit(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                  </div>
                )}

                {/* Step 4: Rules & Prizes */}
                {createStep === 4 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Step 4 — Rules & Prize Breakdown</h4>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Code of Conduct & Rules (Markdown)</label>
                      <textarea rows={5} value={newEvRules} onChange={(e) => setNewEvRules(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div className="space-y-2">
                      <span className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">Podium Prize Rewards</span>
                      <div>
                        <label className="text-xs font-bold text-amber-700 block">🥇 1st Place Gold</label>
                        <input type="text" value={newEvPrize1} onChange={(e) => setNewEvPrize1(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block">🥈 2nd Place Silver</label>
                        <input type="text" value={newEvPrize2} onChange={(e) => setNewEvPrize2(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-amber-800 block">🥉 3rd Place Bronze</label>
                        <input type="text" value={newEvPrize3} onChange={(e) => setNewEvPrize3(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step Navigation */}
                <div className="flex items-center justify-between pt-5 border-t border-gray-100 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (createStep === 1) setIsCreateEventOpen(false);
                      else setCreateStep((prev) => Math.max(prev - 1, 1) as any);
                    }}
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    {createStep === 1 ? 'Cancel' : 'Back'}
                  </button>
                  <button
                    type="submit"
                    className={`inline-flex items-center px-5 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors ${
                      createStep === 4
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {createStep === 4 ? '🚀 Publish Competition' : (
                      <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── Task 5: Clone Challenge Modal ─────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {isCloneModalOpen && challengeToClone && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-base font-bold text-gray-900 flex items-center">
                  <Copy className="w-4 h-4 mr-2 text-blue-600" /> Clone Challenge
                </h3>
                <button onClick={() => setIsCloneModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Cloning Challenge</span>
                <h4 className="font-bold text-gray-900">{challengeToClone.title}</h4>
                <span className="inline-block px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-700 rounded">{challengeToClone.category}</span>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{challengeToClone.description}</p>
              </div>

              <form onSubmit={handleConfirmClone} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Target CTF Competition</label>
                  <select
                    value={cloneTargetEventId}
                    onChange={(e) => setCloneTargetEventId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">The challenge will be duplicated with all flag data, hints, and point values. Solve counts will reset to 0.</p>
                </div>
                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                  <button type="button" onClick={() => setIsCloneModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">
                    Clone Challenge
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── Config Wizard Modal (existing) ────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {isConfigWizardOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-gray-100 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-gray-900">CTF Competition Configurator</h3>
                </div>
                <button onClick={() => setIsConfigWizardOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
              </div>

              <div className="grid grid-cols-4 gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold">
                {(['meta', 'scoring', 'rules', 'prizes'] as const).map((tab) => (
                  <button key={tab} type="button" onClick={() => setWizardTab(tab)} className={`py-2 rounded-lg capitalize transition-colors ${wizardTab === tab ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>
                    {tab === 'meta' ? 'Metadata & Mode' : tab === 'scoring' ? 'Scoring & Limits' : tab === 'rules' ? 'Rules (Markdown)' : 'Prizes & Awards'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSaveWizardConfig} className="space-y-4">
                {wizardTab === 'meta' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Event Title</label>
                      <input required type="text" value={cfgTitle} onChange={(e) => setCfgTitle(e.target.value)} className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Description Summary</label>
                      <textarea rows={2} value={cfgDesc} onChange={(e) => setCfgDesc(e.target.value)} className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Participation Mode</label>
                        <select value={cfgMode} onChange={(e) => setCfgMode(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="team">Team Competition</option>
                          <option value="individual">Individual Operators</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Max Team Size ({cfgMaxTeamSize} Players)</label>
                        <input type="range" min={1} max={5} value={cfgMaxTeamSize} onChange={(e) => setCfgMaxTeamSize(Number(e.target.value))} className="w-full mt-2" />
                      </div>
                    </div>
                  </div>
                )}

                {wizardTab === 'scoring' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Scoring Formula Model</label>
                        <select value={cfgScoringType} onChange={(e) => setCfgScoringType(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="dynamic">Dynamic Decay (Solves reduce value)</option>
                          <option value="static">Static Fixed Points</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Flag Rate Limit (Attempts/Min)</label>
                        <input type="number" value={cfgRateLimit} onChange={(e) => setCfgRateLimit(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  </div>
                )}

                {wizardTab === 'rules' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">Event Code of Conduct & Rules (Markdown)</label>
                    <textarea rows={6} value={cfgRulesMarkdown} onChange={(e) => setCfgRulesMarkdown(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}

                {wizardTab === 'prizes' && (
                  <div className="space-y-3">
                    <span className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">Podium Rewards Breakdown</span>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-amber-700 font-bold block">🥇 1st Place Gold Prize</label>
                        <input type="text" value={cfgPrize1} onChange={(e) => setCfgPrize1(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-700 font-bold block">🥈 2nd Place Silver Prize</label>
                        <input type="text" value={cfgPrize2} onChange={(e) => setCfgPrize2(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-amber-800 font-bold block">🥉 3rd Place Bronze Prize</label>
                        <input type="text" value={cfgPrize3} onChange={(e) => setCfgPrize3(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => setIsConfigWizardOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">Save Configuration</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── Add Challenge Modal (Task 4) ────────────────────────────────────*/}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {isChallengeModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-lg font-bold text-gray-900">Add Jeopardy CTF Challenge</h3>
                <button onClick={() => setIsChallengeModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
              </div>

              <form onSubmit={handleCreateChallenge} className="space-y-4">
                {/* Task 4.2: Target CTF Event Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Target CTF Event *</label>
                  <select
                    required
                    value={newChallengeEventId}
                    onChange={(e) => setNewChallengeEventId(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-blue-900"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Challenge Title</label>
                    <input required type="text" placeholder="e.g. Reverse Memory Cipher" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Category</label>
                    <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as CtfCategory)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
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
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Description & Instructions (Markdown)</label>
                  <textarea rows={3} placeholder="Analyze target host at http://..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Base Points</label>
                    <input type="number" required value={newBasePoints} onChange={(e) => setNewBasePoints(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Flag Solution String</label>
                    <input required type="text" placeholder="CTF{...}" value={newFlag} onChange={(e) => setNewFlag(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Unlockable Hint (50pt Deduction)</label>
                  <input type="text" placeholder="e.g. Check offset in gdb analysis..." value={newHintText} onChange={(e) => setNewHintText(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => setIsChallengeModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">Save Challenge</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Broadcast Modal ────────────────────────────────────────────────── */}
        {isBroadcastOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-base font-bold text-purple-900 flex items-center">
                  <Megaphone className="w-4 h-4 mr-2 text-purple-600" /> Push Broadcast Alert
                </h3>
                <button onClick={() => setIsBroadcastOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
              </div>
              <form onSubmit={handleSendBroadcast} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Announcement Headline</label>
                  <input required type="text" placeholder="e.g. Scoreboard Freeze Active!" value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Announcement Content</label>
                  <textarea required rows={3} placeholder="Provide details for all connected competitors..." value={announcementContent} onChange={(e) => setAnnouncementContent(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                  <button type="button" onClick={() => setIsBroadcastOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm">Push Broadcast</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
};
