import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Clock, 
  Terminal as TerminalIcon, 
  CheckCircle2, 
  ArrowLeft, 
  ChevronRight, 
  RefreshCw, 
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

interface Challenge {
  id: string;
  title: string;
  points: number;
  isSolved: boolean;
  description: string;
  instructions: string[];
  hints: string[];
  correctFlag: string;
}

export const ChallengeSession: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { labId } = useParams<{ labId?: string }>();

  const isReconLab = labId === 'lab1-recon' || labId === 'recon-lab';
  const labTitle = isReconLab ? 'Lab: Network Reconnaissance Lab' : 'Lab: Active Directory & Network Security';

  const handleReturn = () => {
    if (user?.role === 'admin') {
      navigate('/admin/labs');
    } else {
      navigate('/labs');
    }
  };

  // Session Duration (ticking countdown)
  const [timeRemaining, setTimeRemaining] = useState(10800); // 3 hours
  const [score, setScore] = useState(0);

  // Challenges list
  const [challenges, setChallenges] = useState<Challenge[]>([
    {
      id: 'ch-1',
      title: 'Module 1: Port Discovery & Enumeration',
      points: 100,
      isSolved: false,
      description: 'The target machine is online at IP address 10.10.0.10 (or 10.10.12.5). Map out all active listening ports and locate developer notes.',
      instructions: [
        'Run an Nmap scan on target: `nmap 10.10.0.10`',
        'Identify active open service ports (21/FTP, 22/SSH, 80/HTTP, 8080/HTTP).',
        'Read `recon_notes.txt` to retrieve the Module 1 flag.'
      ],
      hints: [
        'Use `nmap 10.10.0.10` in your terminal to map ports.',
        'Type `cat recon_notes.txt` to inspect notes left in your folder.'
      ],
      correctFlag: 'flag{recon_complete}'
    },
    {
      id: 'ch-2',
      title: 'Module 2: Service Version Fingerprinting',
      points: 150,
      isSolved: false,
      description: 'Fingerprint service banners and identify running software versions across open target ports.',
      instructions: [
        'Run `nmap -sV 10.10.0.10` to inspect detailed service version strings.',
        'Check service banners on ports 21 (FTP) and 80 (Apache).',
        'Submit the fingerprinting flag.'
      ],
      hints: [
        'Run `nmap -sV 10.10.0.10` to trigger version detection.',
        'Version banners disclose hash key: flag{service_fingerprint}'
      ],
      correctFlag: 'flag{service_fingerprint}'
    },
    {
      id: 'ch-3',
      title: 'Module 3: Hidden Service Discovery',
      points: 200,
      isSolved: false,
      description: 'Locate hidden administration endpoints and unlisted HTTP paths hosted on port 8080.',
      instructions: [
        'Inspect HTTP proxy/admin service running on port 8080.',
        'Discover unlisted administrative endpoint `/admin-secret`.',
        'Retrieve the hidden service discovery flag.'
      ],
      hints: [
        'Scan port 8080 or type `cat recon_notes.txt` to find administrative routes.',
        'The unlisted proxy header contains: flag{hidden_service_found}'
      ],
      correctFlag: 'flag{hidden_service_found}'
    },
    {
      id: 'ch-4',
      title: 'Module 4: Credential Discovery',
      points: 250,
      isSolved: false,
      description: 'Locate exposed credentials and audit misconfigured administration utilities across the file system.',
      instructions: [
        'Audit local administrative binary utilities in your PATH.',
        'Run system helper checks to inspect configuration logs.',
        'Extract the credential discovery flag.'
      ],
      hints: [
        'Run `sys-helper --status` or inspect environment notes.',
        'Admin utility status log contains: flag{service_compromise}'
      ],
      correctFlag: 'flag{service_compromise}'
    },
    {
      id: 'ch-5',
      title: 'Module 5: Full Network Infiltration (Capstone)',
      points: 300,
      isSolved: false,
      description: 'Synthesize all recon findings, exploit misconfigured SUID binaries, and gain root shell access on the target system.',
      instructions: [
        'Inspect SUID permissions using `sudo -l`.',
        'Exploit `/usr/bin/sys-helper` to escalate to root (`sys-helper --exec "/bin/sh"`).',
        'Read `/root/flag.txt` to capture the final capstone flag.'
      ],
      hints: [
        'Run `sys-helper --exec "/bin/sh"` to trigger a privilege escape.',
        'Read the flag: `cat /root/flag.txt` once you escalate to root.'
      ],
      correctFlag: 'flag{suid_helper_root}'
    }
  ]);

  const [activeChallengeIdx, setActiveChallengeIdx] = useState(0);
  const activeChallenge = challenges[activeChallengeIdx];

  // Submission States
  const [flagInput, setFlagInput] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [unlockedHints, setUnlockedHints] = useState<number[]>([]);

  // Mock Terminal Emulator States
  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    'CyberRange Secure Linux Sandbox v1.08',
    'Type "help" to see available commands.',
    'operator@cyberrange-sandbox:~$ '
  ]);
  const [commandInput, setCommandInput] = useState('');
  const [isRoot, setIsRoot] = useState(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Ticking session clock
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to bottom of terminal
  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalHistory]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const handleFlagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagInput.trim()) return;

    if (flagInput.trim() === activeChallenge.correctFlag) {
      setSubmissionStatus('success');
      // Update score and mark solved
      if (!activeChallenge.isSolved) {
        setChallenges(prev =>
          prev.map((ch, idx) => (idx === activeChallengeIdx ? { ...ch, isSolved: true } : ch))
        );
        setScore(prev => prev + activeChallenge.points);
      }
      setTimeout(() => {
        setSubmissionStatus('idle');
        setFlagInput('');
      }, 2500);
    } else {
      setSubmissionStatus('error');
      setTimeout(() => {
        setSubmissionStatus('idle');
      }, 1500);
    }
  };

  // Mock Terminal Command Router
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd) return;

    const userPrompt = isRoot ? 'root@cyberrange-sandbox:~# ' : 'operator@cyberrange-sandbox:~$ ';
    let output: string[] = [`${userPrompt}${cmd}`];

    const tokens = cmd.split(' ');
    const baseCmd = tokens[0];

    switch (baseCmd) {
      case 'help':
        output.push(
          'Available Commands:',
          '  help             Display this guidelines summary',
          '  clear            Clear the terminal logs screen',
          '  whoami           Display active profile identity',
          '  ls               List files in active folder directory',
          '  cat [file]       Read specific target file contents',
          '  nmap [ip]        Execute target service scan mapping',
          '  sudo -l          Audit SUID administrative allocations',
          '  sys-helper       Execute system administrator utility tool'
        );
        break;
      case 'clear':
        setTerminalHistory(['operator@cyberrange-sandbox:~$ ']);
        setCommandInput('');
        return;
      case 'whoami':
        output.push(isRoot ? 'root' : 'operator');
        break;
      case 'ls':
        if (isRoot) {
          output.push('README.txt', 'recon_notes.txt', 'flag.txt');
        } else {
          output.push('README.txt', 'recon_notes.txt', 'sys-helper');
        }
        break;
      case 'cat':
        const targetFile = tokens[1];
        if (!targetFile) {
          output.push('cat: missing operand');
        } else if (targetFile === 'README.txt') {
          output.push(
            '== CyberRange Sandboxed Target Machine ==',
            'This terminal is connected to an isolated lab container.',
            'Perform security audits and escalation sequences to extract solution flags.'
          );
        } else if (targetFile === 'recon_notes.txt') {
          output.push(
            '== Developer Notes ==',
            'Internal network targets verified: 10.10.12.5 is online.',
            'Initial scanning complete. Log hash reference: flag{recon_complete}'
          );
        } else if (targetFile === 'flag.txt' && isRoot) {
          output.push('SUCCESS: Escalation Flag acquired: flag{suid_helper_root}');
        } else if (targetFile === 'flag.txt' && !isRoot) {
          output.push('cat: flag.txt: Permission denied');
        } else {
          output.push(`cat: ${targetFile}: No such file or directory`);
        }
        break;
      case 'nmap':
        const targetIp = tokens.slice(1).join(' ');
        if (!targetIp) {
          output.push('nmap: missing target IP address');
        } else if (targetIp.includes('10.10.0.10') || targetIp.includes('10.10.12.5')) {
          output.push(
            'Starting Nmap 7.93 ( https://nmap.org )...',
            'Nmap scan report for target-host (10.10.0.10)',
            'Host is up (0.0012s latency).',
            'PORT     STATE SERVICE       VERSION',
            '21/tcp   open  ftp           vsftpd 3.0.3 (Anonymous access allowed)',
            '22/tcp   open  ssh           OpenSSH 8.9p1 Ubuntu 3ubuntu0.1',
            '80/tcp   open  http          Apache httpd 2.4.52 ((Ubuntu) flag{service_fingerprint})',
            '8080/tcp open  http-proxy    Mock Admin Proxy v2.4 (Endpoint: /admin-secret - flag{hidden_service_found})',
            'Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel',
            'Nmap done: 1 IP address (1 host up) scanned in 1.84 seconds.'
          );
        } else {
          output.push(`nmap: ${targetIp}: Target host offline or unreachable`);
        }
        break;
      case 'sudo':
        if (tokens[1] === '-l') {
          output.push(
            'User operator may run the following commands on this machine:',
            '  (root) NOPASSWD: /usr/bin/sys-helper'
          );
        } else {
          output.push('sudo: password required');
        }
        break;
      case 'sys-helper':
        if (tokens[1] === '--exec' && tokens[2] === '"/bin/sh"') {
          setIsRoot(true);
          output.push(
            'Privilege elevation sequence initialized...',
            'Mounting root workspace... [OK]',
            'Spawning secure root shell instance...'
          );
        } else if (tokens[1] === '--help' || !tokens[1]) {
          output.push(
            'Usage: sys-helper [options]',
            'Options:',
            '  --help          Show this helper documentation node',
            '  --status        Fetch compute container status telemetry',
            '  --exec [cmd]    Execute binary command with root credentials'
          );
        } else if (tokens[1] === '--status') {
          output.push('System status: Active', 'Memory utilization: 42%', 'Security: Vulnerable configurations detected.');
        } else {
          output.push(`sys-helper: invalid option: ${tokens[1]}`);
        }
        break;
      default:
        output.push(`bash: ${baseCmd}: command not found`);
    }

    // Add prompt suffix
    const nextPrompt = isRoot || (baseCmd === 'sys-helper' && tokens[1] === '--exec' && tokens[2] === '"/bin/sh"')
      ? 'root@cyberrange-sandbox:~# ' 
      : 'operator@cyberrange-sandbox:~$ ';
    output.push(nextPrompt);

    setTerminalHistory(prev => [...prev, ...output]);
    setCommandInput('');
  };

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] overflow-hidden">
      {/* Session Top Header bar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-20 flex-shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleReturn}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
            title="Return to Labs list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="border-l border-slate-200 pl-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0052CC] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              Active Session
            </span>
            <h1 className="font-bold text-slate-800 text-sm leading-tight mt-0.5">
              {labTitle}
            </h1>
          </div>
        </div>

        {/* Center score */}
        <div className="hidden sm:flex items-center gap-4">
          <span className="text-xs font-bold text-slate-500">
            Progress Score: <span className="text-slate-800 font-extrabold">{score} pts</span>
          </span>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
            <span>Challenges:</span>
            <span className="text-slate-800 font-extrabold">
              {challenges.filter(c => c.isSolved).length} / {challenges.length}
            </span>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-4">
          {/* Countdown timer */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
            timeRemaining < 900 
              ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse' 
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            <Clock className="w-4 h-4" />
            <span>{formatTime(timeRemaining)}</span>
          </div>

          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to exit this challenge session? Your container states will be suspended.')) {
                handleReturn();
              }
            }}
            className="bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-700 border border-slate-200 font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors"
          >
            Exit Session
          </button>
        </div>
      </header>

      {/* Main split viewport container */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Left Pane: Instructions, milestones & submissions */}
        <div className="w-full md:w-[42%] border-r border-slate-200 bg-white flex flex-col min-h-0 overflow-y-auto">
          {/* Challenge navigation tab selection header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50 flex-shrink-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lab Challenges</span>
            <div className="flex gap-1.5">
              {challenges.map((ch, idx) => (
                <button
                  key={ch.id}
                  onClick={() => {
                    setActiveChallengeIdx(idx);
                    setUnlockedHints([]);
                  }}
                  className={`w-7 h-7 rounded-lg border text-xs font-extrabold transition-all flex items-center justify-center ${
                    idx === activeChallengeIdx
                      ? 'bg-blue-50 text-[#0052CC] border-blue-300 ring-2 ring-[#0052CC]/15 shadow-xs'
                      : ch.isSolved
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                  title={ch.title}
                >
                  {ch.isSolved ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Core Instruction Details Body */}
          <div className="flex-1 p-6 space-y-6">
            {/* Title section */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Challenge {activeChallengeIdx + 1} of {challenges.length}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  +{activeChallenge.points} pts
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight mt-1">
                {activeChallenge.title}
              </h2>
            </div>

            {/* Description */}
            <div className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              {activeChallenge.description}
            </div>

            {/* Step-by-step checklist instructions */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Milestones Checklist</h3>
              <div className="space-y-2">
                {activeChallenge.instructions.map((inst, idx) => (
                  <div key={idx} className="flex gap-2.5 items-start text-xs text-slate-600 leading-relaxed">
                    <ChevronRight className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span>{inst}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hints Section */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hints Assistance</h3>
              <div className="space-y-2">
                {activeChallenge.hints.map((hint, idx) => {
                  const isUnlocked = unlockedHints.includes(idx);
                  return (
                    <div 
                      key={idx}
                      className={`p-3 rounded-lg border transition-all ${
                        isUnlocked 
                          ? 'bg-blue-50/50 border-blue-100 text-xs text-slate-600 leading-relaxed' 
                          : 'bg-slate-50 border-slate-200 flex items-center justify-between gap-3'
                      }`}
                    >
                      {isUnlocked ? (
                        <div>
                          <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider block mb-1">Hint #{idx + 1}</span>
                          <p>{hint}</p>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs font-semibold text-slate-500">Hint #{idx + 1} (Unlocks for -25 pts)</span>
                          <button
                            onClick={() => {
                              if (window.confirm('Unlock this hint for a 25-point penalty?')) {
                                setUnlockedHints(prev => [...prev, idx]);
                                setScore(prev => Math.max(0, prev - 25));
                              }
                            }}
                            className="bg-white hover:bg-blue-50 text-[#0052CC] hover:text-blue-700 border border-slate-200 hover:border-blue-300 font-bold text-xs px-2.5 py-1 rounded-lg transition-colors shadow-xs"
                          >
                            Unlock
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Submission panel (Sticky Bottom) */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
            <form onSubmit={handleFlagSubmit} className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Submit Flag Credentials
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="flag{...}"
                  value={flagInput}
                  onChange={(e) => setFlagInput(e.target.value)}
                  disabled={activeChallenge.isSolved}
                  className={`flex-1 px-3 py-2 bg-white border rounded-lg text-sm font-mono placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    activeChallenge.isSolved
                      ? 'border-emerald-200 bg-emerald-50/30 text-emerald-700 cursor-not-allowed'
                      : submissionStatus === 'success'
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/10'
                      : submissionStatus === 'error'
                      ? 'border-rose-400 bg-rose-50 text-rose-800 ring-2 ring-rose-500/10 animate-shake'
                      : 'border-slate-200 focus:ring-[#0052CC]/15 focus:border-[#0052CC]'
                  }`}
                />
                <button
                  type="submit"
                  disabled={activeChallenge.isSolved || submissionStatus === 'success'}
                  className={`font-bold text-xs px-4 py-2 rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                    activeChallenge.isSolved
                      ? 'bg-emerald-100 text-emerald-600 border border-emerald-200 cursor-not-allowed'
                      : 'bg-[#0052CC] hover:bg-blue-700 text-white cursor-pointer'
                  }`}
                >
                  {activeChallenge.isSolved ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Solved</span>
                    </>
                  ) : (
                    <span>Submit</span>
                  )}
                </button>
              </div>

              {submissionStatus === 'success' && (
                <p className="text-[11px] font-bold text-emerald-600 animate-in fade-in flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Correct flag submitted! +{activeChallenge.points} points awarded.</span>
                </p>
              )}
              {submissionStatus === 'error' && (
                <p className="text-[11px] font-bold text-rose-500 animate-in fade-in flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Incorrect flag. Inspect command listings and try again.</span>
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Right Pane: Interactive compute terminal sandbox */}
        <div className="flex-1 bg-slate-950 flex flex-col min-h-0 overflow-hidden">
          {/* Terminal Console toolbar */}
          <div className="h-10 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-emerald-500" />
              <span className="font-mono text-emerald-400">Terminal Emulator Console</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md font-bold text-emerald-400">
                SSH Target: 10.10.12.5
              </span>
              <button 
                onClick={() => {
                  setIsRoot(false);
                  setTerminalHistory([
                    'CyberRange Secure Linux Sandbox v1.08',
                    'Type "help" to see available commands.',
                    'operator@cyberrange-sandbox:~$ '
                  ]);
                }}
                className="hover:text-white p-1 hover:bg-slate-800 rounded-md transition-colors"
                title="Reset local console terminal state"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Terminal logs pane */}
          <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-emerald-400 space-y-2 selection:bg-emerald-950">
            {terminalHistory.map((line, idx) => (
              <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                {line}
              </div>
            ))}
            <div ref={terminalBottomRef} />
          </div>

          {/* Terminal input form */}
          <form onSubmit={handleCommandSubmit} className="h-10 bg-slate-900 border-t border-slate-800 flex items-center px-4 flex-shrink-0">
            <span className="font-mono text-xs text-emerald-500 mr-2 flex-shrink-0">
              {isRoot ? 'root@cyberrange-sandbox:~#' : 'operator@cyberrange-sandbox:~$'}
            </span>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-emerald-400 focus:ring-0 placeholder-emerald-800"
              placeholder='Type commands here... (e.g. "help", "ls", "nmap 10.10.12.5")'
              autoFocus
            />
          </form>
        </div>
      </div>
    </div>
  );
};
