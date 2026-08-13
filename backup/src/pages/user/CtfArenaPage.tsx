import React, { useState } from 'react';
import { UserLayout } from '../../components/user/UserLayout';
import type { CtfChallenge, CtfCategory, CtfEventStatus } from '../../types/ctf';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Trophy, 
  CheckCircle2, 
  HelpCircle, 
  Download, 
  ArrowLeft, 
  Award, 
  AlertCircle,
  Pause,
  Lock,
  Square
} from 'lucide-react';

const ARENA_CHALLENGES: CtfChallenge[] = [
  {
    id: 'chal-1',
    eventId: 'ctf-1',
    title: 'SQLi Vault Breach',
    category: 'Web',
    description: 'Bypass the authentication endpoint on `http://vault.target.local:8080/login` using second-order SQL injection. Extract the admin flag string from the database.',
    basePoints: 500,
    minPoints: 100,
    decayRate: 15,
    currentPoints: 340,
    flag: 'CTF{sql_1nj3ct10n_m4st3r_2026}',
    fileUrls: [{ name: 'target_source.zip', url: '#' }],
    hints: [
      { id: 'h1', text: 'Inspect the UNION SELECT payload on the search query parameter.', cost: 50, unlocked: false }
    ],
    solveCount: 14,
    isSolved: true,
  },
  {
    id: 'chal-2',
    eventId: 'ctf-1',
    title: 'Buffer Overflow Payload Assembly',
    category: 'Pwn',
    description: 'Exploit a stack buffer overflow in the binary target to spawn a remote interactive bash shell and read `/root/flag.txt`.',
    basePoints: 500,
    minPoints: 150,
    decayRate: 10,
    currentPoints: 460,
    flag: 'CTF{pwn_r3t2libc_99_syst3m}',
    fileUrls: [{ name: 'vulnerable_binary.elf', url: '#' }],
    hints: [
      { id: 'h2', text: 'Use gdb to inspect the offset to EIP (76 bytes).', cost: 75, unlocked: false }
    ],
    solveCount: 4,
    isSolved: false,
  },
  {
    id: 'chal-3',
    eventId: 'ctf-1',
    title: 'Corrupted PCAP Network Stream',
    category: 'Forensics',
    description: 'Reconstruct the exfiltrated ZIP archive hidden within TCP stream #14 of the attached packet capture file.',
    basePoints: 300,
    minPoints: 100,
    decayRate: 5,
    currentPoints: 220,
    flag: 'CTF{pcap_w1r3sh4rk_f0r3ns1cs}',
    fileUrls: [{ name: 'capture_exfil.pcapng', url: '#' }],
    hints: [],
    solveCount: 22,
    isSolved: true,
  },
  {
    id: 'chal-4',
    eventId: 'ctf-1',
    title: 'RSA Public Key Decryption Failure',
    category: 'Crypto',
    description: 'The target system reuses low-exponent RSA keys ($e = 3$). Perform Hastad Broadcast Attack to decrypt the flag payload.',
    basePoints: 400,
    minPoints: 100,
    decayRate: 8,
    currentPoints: 380,
    flag: 'CTF{rsa_broadcast_attack_cracked}',
    fileUrls: [{ name: 'public_keys.json', url: '#' }],
    hints: [
      { id: 'h3', text: 'Take the cube root of the combined ciphertext integer.', cost: 40, unlocked: false }
    ],
    solveCount: 8,
    isSolved: false,
  },
  {
    id: 'chal-5',
    eventId: 'ctf-1',
    title: 'Obfuscated DotNet Assembly Reverse',
    category: 'Reverse',
    description: 'Decompile the protected .NET assembly using ILSpy or dnSpy to find the internal key generation algorithm.',
    basePoints: 450,
    minPoints: 120,
    decayRate: 12,
    currentPoints: 410,
    flag: 'CTF{dotnet_dnspy_decompiled_win}',
    fileUrls: [{ name: 'license_checker.exe', url: '#' }],
    hints: [],
    solveCount: 6,
    isSolved: false,
  },
  {
    id: 'chal-6',
    eventId: 'ctf-1',
    title: 'Threat Actor Infrastructure Mapping',
    category: 'OSINT',
    description: 'Track the domain registrar history and public SSL certificates of `APT-38-c2.org` to reveal the primary C2 IP address.',
    basePoints: 250,
    minPoints: 100,
    decayRate: 5,
    currentPoints: 180,
    flag: 'CTF{osint_crt_shodan_found}',
    fileUrls: [],
    hints: [
      { id: 'h4', text: 'Search crt.sh for historical SAN certificate DNS entries.', cost: 30, unlocked: false }
    ],
    solveCount: 31,
    isSolved: false,
  }
];

export const CtfArenaPage: React.FC = () => {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [eventStatus] = useState<CtfEventStatus>('live'); // Active event status state
  const [challenges, setChallenges] = useState<CtfChallenge[]>(ARENA_CHALLENGES);
  const [selectedCategory, setSelectedCategory] = useState<'All' | CtfCategory>('All');
  const [activeChallenge, setActiveChallenge] = useState<CtfChallenge | null>(null);

  // Flag Submission Form State inside Modal
  const [flagInput, setFlagInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'already'; text: string } | null>(null);

  const categories: ('All' | CtfCategory)[] = ['All', 'Web', 'Pwn', 'Reverse', 'Crypto', 'Forensics', 'OSINT'];

  const filteredChallenges = challenges.filter(
    (c) => selectedCategory === 'All' || c.category === selectedCategory
  );

  const totalPointsEarned = challenges
    .filter((c) => c.isSolved)
    .reduce((acc, curr) => acc + curr.currentPoints, 0);

  const totalSolvedCount = challenges.filter((c) => c.isSolved).length;

  const isSubmissionsLocked = eventStatus === 'paused' || eventStatus === 'concluded';

  const handleOpenChallenge = (chal: CtfChallenge) => {
    setActiveChallenge(chal);
    setFlagInput('');
    setFeedback(null);
  };

  const handleUnlockHint = (hintId: string) => {
    if (!activeChallenge) return;
    setChallenges((prev) =>
      prev.map((c) => {
        if (c.id === activeChallenge.id) {
          const updatedHints = c.hints.map((h) => (h.id === hintId ? { ...h, unlocked: true } : h));
          return { ...c, hints: updatedHints };
        }
        return c;
      })
    );

    setActiveChallenge((prev) => {
      if (!prev) return null;
      const updatedHints = prev.hints.map((h) => (h.id === hintId ? { ...h, unlocked: true } : h));
      return { ...prev, hints: updatedHints };
    });
  };

  const handleSubmitFlag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChallenge || !flagInput.trim()) return;

    if (isSubmissionsLocked) {
      setFeedback({
        type: 'error',
        text: eventStatus === 'paused'
          ? 'Submissions temporarily locked by competition admin.'
          : 'Competition concluded. Submissions are closed.',
      });
      return;
    }

    if (activeChallenge.isSolved) {
      setFeedback({ type: 'already', text: 'You have already solved this challenge!' });
      return;
    }

    const cleanInput = flagInput.trim();
    if (cleanInput === activeChallenge.flag) {
      setFeedback({
        type: 'success',
        text: `CONGRATULATIONS! Flag Correct! You earned +${activeChallenge.currentPoints} pts for your team!`,
      });

      // Mark as solved
      setChallenges((prev) =>
        prev.map((c) => (c.id === activeChallenge.id ? { ...c, isSolved: true, solveCount: c.solveCount + 1 } : c))
      );

      setActiveChallenge((prev) => (prev ? { ...prev, isSolved: true, solveCount: prev.solveCount + 1 } : null));
    } else {
      setFeedback({
        type: 'error',
        text: 'Incorrect flag submission. Double-check your syntax and payload output.',
      });
    }
  };

  return (
    <UserLayout>
      <div className="space-y-6">
        {/* Real-Time Lifecycle Banner Indicator */}
        {eventStatus === 'paused' && (
          <div className="p-4 bg-amber-500 text-white rounded-2xl shadow-md flex items-center space-x-3 border border-amber-600 animate-pulse">
            <Pause className="w-6 h-6 text-amber-100 shrink-0" />
            <div>
              <h4 className="font-extrabold text-sm uppercase tracking-wider">
                COMPETITION PAUSED BY ADMIN — SUBMISSIONS TEMPORARILY LOCKED
              </h4>
              <p className="text-xs text-amber-100 mt-0.5">
                The competition organizers have temporarily paused flag submission processing. Standings remain saved.
              </p>
            </div>
          </div>
        )}

        {eventStatus === 'concluded' && (
          <div className="p-4 bg-gray-800 text-white rounded-2xl shadow-md flex items-center space-x-3 border border-gray-700">
            <Square className="w-6 h-6 text-gray-400 shrink-0" />
            <div>
              <h4 className="font-extrabold text-sm uppercase tracking-wider">
                COMPETITION CONCLUDED — FINAL STANDINGS LOCKED
              </h4>
              <p className="text-xs text-gray-300 mt-0.5">
                This CTF competition has officially ended. Thank you for participating! Check the live scoreboard for final rankings.
              </p>
            </div>
          </div>
        )}

        {/* Arena Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="space-y-1">
            <button
              onClick={() => navigate('/ctf')}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to CTF Portal
            </button>
            <div className="flex items-center space-x-3">
              <span className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                <Trophy className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">
                  National Cyber Defense Championship 2026
                </h1>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Event ID: {eventId || 'ctf-1'} • Jeopardy Mode • Dynamic Point Decay Engine
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-200 text-center font-mono">
              <span className="text-[10px] text-gray-400 uppercase block font-sans font-semibold">Your Score</span>
              <span className="text-lg font-bold text-emerald-600">{totalPointsEarned} pts</span>
            </div>

            <div className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-200 text-center font-mono">
              <span className="text-[10px] text-gray-400 uppercase block font-sans font-semibold">Solves</span>
              <span className="text-lg font-bold text-purple-600">
                {totalSolvedCount} / {challenges.length}
              </span>
            </div>

            <button
              onClick={() => navigate(`/ctf/events/${eventId || 'ctf-1'}/scoreboard`)}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer flex items-center"
            >
              <Award className="w-4 h-4 mr-1.5" /> Live Scoreboard
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {cat === 'All' ? 'All Categories' : cat}
            </button>
          ))}
        </div>

        {/* Jeopardy Challenge Matrix Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredChallenges.map((chal) => (
            <div
              key={chal.id}
              onClick={() => handleOpenChallenge(chal)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                chal.isSolved
                  ? 'bg-emerald-50/60 border-emerald-300 shadow-xs hover:border-emerald-400'
                  : 'bg-white border-gray-200 shadow-xs hover:shadow-md hover:border-purple-300'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-100 text-purple-700">
                    {chal.category}
                  </span>

                  {chal.isSolved ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Solved
                    </span>
                  ) : (
                    <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {chal.currentPoints} pts
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-bold text-gray-900">{chal.title}</h3>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{chal.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs font-mono text-gray-500">
                <span>{chal.solveCount} Team Solves</span>
                <span className="text-purple-600 font-bold hover:underline">Inspect Challenge →</span>
              </div>
            </div>
          ))}
        </div>

        {/* Challenge Modal */}
        {activeChallenge && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-355">
                      {activeChallenge.category}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-455">
                      Value: {activeChallenge.currentPoints} Points
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{activeChallenge.title}</h3>
                </div>
                <button
                  onClick={() => setActiveChallenge(null)}
                  className="text-slate-400 hover:text-slate-655 dark:hover:text-slate-200 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Challenge Description */}
              <div className="space-y-3">
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  {activeChallenge.description}
                </p>

                {/* Attachments */}
                {activeChallenge.fileUrls && activeChallenge.fileUrls.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Attached File Assets
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {activeChallenge.fileUrls.map((f, idx) => (
                        <a
                          key={idx}
                          href={f.url}
                          onClick={(e) => {
                            e.preventDefault();
                            alert(`Downloading asset: ${f.name}`);
                          }}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 font-mono text-xs rounded-lg border border-blue-200 dark:border-blue-900/40 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5" /> {f.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Hints Accordion */}
              {activeChallenge.hints && activeChallenge.hints.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Available Hints
                  </span>
                  {activeChallenge.hints.map((hint) => (
                    <div key={hint.id} className="p-3 bg-amber-50/50 dark:bg-amber-950/10 rounded-xl border border-amber-200 dark:border-amber-900/30 space-y-2">
                      {hint.unlocked ? (
                        <div className="text-xs text-amber-950 dark:text-amber-300 font-medium flex items-start space-x-2">
                          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>{hint.text}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-amber-805 dark:text-amber-400 font-semibold">
                            Hint Locked (Penalty: -{hint.cost} pts)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUnlockHint(hint.id)}
                            className="px-3 py-1 bg-amber-605 hover:bg-amber-705 dark:bg-amber-600 dark:hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                          >
                            Unlock Hint (-{hint.cost} pts)
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Feedback Banner */}
              {feedback && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
                    feedback.type === 'success'
                      ? 'bg-emerald-100 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-400'
                      : feedback.type === 'already'
                      ? 'bg-blue-100 dark:bg-blue-950/20 border-blue-300 dark:border-blue-900/30 text-blue-900 dark:text-blue-400'
                      : 'bg-rose-100 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/30 text-rose-900 dark:text-rose-400'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{feedback.text}</span>
                </div>
              )}

              {/* Flag Submission Form */}
              <form onSubmit={handleSubmitFlag} className="space-y-3 pt-3 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Submit Flag Solution</span>
                  {isSubmissionsLocked && (
                    <span className="text-rose-600 flex items-center normal-case font-semibold">
                      <Lock className="w-3 h-3 mr-1" /> Locked by Admin
                    </span>
                  )}
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    required
                    disabled={activeChallenge.isSolved || isSubmissionsLocked}
                    placeholder={
                      isSubmissionsLocked
                        ? 'Flag submissions locked by Admin...'
                        : 'CTF{...}'
                    }
                    value={flagInput}
                    onChange={(e) => setFlagInput(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 rounded-xl text-sm font-mono text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none disabled:bg-slate-100 dark:disabled:bg-slate-900/50"
                  />
                  <button
                    type="submit"
                    disabled={activeChallenge.isSolved || isSubmissionsLocked}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors disabled:opacity-50 cursor-pointer flex-shrink-0 shadow-emerald-500/20"
                  >
                    Submit Flag
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
};
