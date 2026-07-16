import React, { useState } from 'react';
import { UserLayout } from '../../components/user/UserLayout';
import type { CtfChallenge, CtfCategory } from '../../types/ctf';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Trophy, 
  CheckCircle2, 
  HelpCircle, 
  Download, 
  ArrowLeft, 
  Award, 
  AlertCircle
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
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 space-y-5 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-gray-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700">
                      {activeChallenge.category}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-600">
                      Value: {activeChallenge.currentPoints} Points
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{activeChallenge.title}</h3>
                </div>
                <button
                  onClick={() => setActiveChallenge(null)}
                  className="text-gray-400 hover:text-gray-600 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Challenge Description */}
              <div className="space-y-3">
                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-200">
                  {activeChallenge.description}
                </p>

                {/* Attachments */}
                {activeChallenge.fileUrls && activeChallenge.fileUrls.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
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
                          className="inline-flex items-center px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-mono text-xs rounded-lg border border-blue-200 transition-colors"
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
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                    Available Hints
                  </span>
                  {activeChallenge.hints.map((hint) => (
                    <div key={hint.id} className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2">
                      {hint.unlocked ? (
                        <div className="text-xs text-amber-950 font-medium flex items-start space-x-2">
                          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>{hint.text}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-amber-800 font-semibold">
                            Hint Locked (Penalty: -{hint.cost} pts)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUnlockHint(hint.id)}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
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
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                      : feedback.type === 'already'
                      ? 'bg-blue-100 border-blue-300 text-blue-900'
                      : 'bg-rose-100 border-rose-300 text-rose-900'
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
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Submit Flag Solution
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    required
                    disabled={activeChallenge.isSolved}
                    placeholder="CTF{...}"
                    value={flagInput}
                    onChange={(e) => setFlagInput(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100"
                  />
                  <button
                    type="submit"
                    disabled={activeChallenge.isSolved}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
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
