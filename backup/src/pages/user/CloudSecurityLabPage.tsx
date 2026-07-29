import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface CloudModule {
  num: number;
  title: string;
  diffLabel: string;
  diffStars: number;
  points: number;
  narrative: string;
  mission: string;
  objectives: { text: string; completed?: boolean }[];
  hints: { cost: number; text: string }[];
}

const CLOUD_MODULES: CloudModule[] = [
  {
    num: 1,
    title: 'S3 Anonymous Reconnaissance',
    diffLabel: 'Trivial',
    diffStars: 1,
    points: 100,
    narrative:
      'Orientation & initial cloud recon. TechCorp has left a storage bucket publicly accessible to the internet without requiring authentication.',
    mission: 'Enumerate the public S3 bucket anonymously to discover exposed company assets and recover the first access flag.',
    objectives: [
      { text: 'Check connection details panel for public bucket name' },
      { text: 'List the S3 bucket using --no-sign-request parameter' },
      { text: 'Locate welcome.txt file inside the public bucket' },
      { text: 'Read the hidden key file to submit Stage 1 flag' },
    ],
    hints: [
      { cost: 20, text: 'Use `aws s3 ls s3://<bucket-name> --no-sign-request --endpoint-url http://10.20.0.10:4566` to list files.' },
      { cost: 20, text: 'Use `aws s3 cp s3://<bucket-name>/welcome.txt - --no-sign-request --endpoint-url http://10.20.0.10:4566` to view contents.' }
    ]
  },
  {
    num: 2,
    title: 'Credential Theft & Log Analysis',
    diffLabel: 'Easy',
    diffStars: 2,
    points: 150,
    narrative:
      'Developers accidentally uploaded system diagnostic logs containing embedded hardcoded cloud developer credentials.',
    mission: 'Download system.log from the public bucket, extract the leaked AWS access keys, and decode the Stage 2 flag.',
    objectives: [
      { text: 'Submit Stage 1 flag to trigger system.log generation' },
      { text: 'Download system.log from public S3 bucket' },
      { text: 'Extract hardcoded AWS_ACCESS_KEY_ID & SECRET_KEY' },
      { text: 'Decode ROT13 obfuscated flag string in the logs' },
    ],
    hints: [
      { cost: 20, text: 'Inspect system.log for lines containing AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.' },
      { cost: 20, text: 'Use `tr "A-Za-z" "N-ZA-Mn-za-m"` or python to decode the ROT13 string in the log comment.' }
    ]
  },
  {
    num: 3,
    title: 'Cloud Resource Enumeration',
    diffLabel: 'Medium',
    diffStars: 3,
    points: 200,
    narrative:
      'Now that you possess valid AWS developer credentials, configure your CLI session to discover internal serverless resources.',
    mission: 'Export the stolen credentials, list active Lambda functions targeting LocalStack, and inspect environment variables.',
    objectives: [
      { text: 'Export AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in shell' },
      { text: 'List Lambda functions using aws lambda list-functions' },
      { text: 'Inspect EnumerateResources function configuration' },
      { text: 'Extract Stage 3 flag from environment variables' },
    ],
    hints: [
      { cost: 20, text: 'Run `export AWS_ACCESS_KEY_ID=...` and `export AWS_SECRET_ACCESS_KEY=...` in your shell.' },
      { cost: 20, text: 'Run `aws lambda list-functions --endpoint-url http://10.20.0.10:4566` and check Environment.Variables.' }
    ]
  },
  {
    num: 4,
    title: 'Cloud Privilege Escalation',
    diffLabel: 'Medium',
    diffStars: 3,
    points: 250,
    narrative:
      'The developer user account has overly permissive IAM policies allowing inline policy attachments.',
    mission: 'Enumerate IAM permissions, identify the PutUserPolicy vulnerability, elevate to AdministratorAccess, and loot restricted S3 bucket.',
    objectives: [
      { text: 'List attached policies for current IAM user' },
      { text: 'Identify dangerous iam:PutUserPolicy permission' },
      { text: 'Attach administrator policy document to user' },
      { text: 'Read flag4.txt from restricted S3 bucket' },
    ],
    hints: [
      { cost: 20, text: 'Check `aws iam list-user-policies` and `aws iam get-user-policy` for your username.' },
      { cost: 20, text: 'Use `aws iam put-user-policy` with Action: "*" and Resource: "*"' }
    ]
  },
  {
    num: 5,
    title: 'Corporate Secrets Infiltration',
    diffLabel: 'Hard',
    diffStars: 4,
    points: 300,
    narrative:
      'With full Administrator access achieved across the AWS infrastructure, infiltrate the corporate secrets vault.',
    mission: 'Query AWS Secrets Manager for secret ID company/final/flag and retrieve the master flag value.',
    objectives: [
      { text: 'List secrets stored in AWS Secrets Manager' },
      { text: 'Locate secret ID company/final/flag' },
      { text: 'Execute get-secret-value API call' },
      { text: 'Extract master flag value to complete lab' },
    ],
    hints: [
      { cost: 20, text: 'Run `aws secretsmanager list-secrets --endpoint-url http://10.20.0.10:4566`' },
      { cost: 20, text: 'Run `aws secretsmanager get-secret-value --secret-id company/final/flag --endpoint-url http://10.20.0.10:4566`' }
    ]
  },
];

interface SolvedEntry {
  points: number;
  timestamp: string;
}

interface SolvedMap {
  [key: string]: SolvedEntry;
}

interface TerminalLine {
  type: 'cmd' | 'out' | 'err' | 'info';
  text: string;
}

export const CloudSecurityLabPage: React.FC = () => {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();

  const [activeModuleNum, setActiveModuleNum] = useState<number>(1);
  // totalScore is read-only from the backend — never mutated client-side
  const [totalScore, setTotalScore] = useState<number>(0);
  const [solvedMap, setSolvedMap] = useState<SolvedMap>({});
  const [completedObjs, setCompletedObjs] = useState<Record<string, boolean>>({});
  const [unlockedHints, setUnlockedHints] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Completion Popup Modal State
  const [completionModal, setCompletionModal] = useState<{
    show: boolean;
    moduleNum: number;
    moduleTitle: string;
    points: number;
    totalScore: number;
    isLastModule: boolean;
  } | null>(null);

  // Flag input state
  const [flagInput, setFlagInput] = useState<string>('');
  const [submittingFlag, setSubmittingFlag] = useState<boolean>(false);
  const [flagFeedback, setFlagFeedback] = useState<{ type: 'correct' | 'incorrect' | 'error'; message: string } | null>(null);

  // Terminal state
  const [terminalConnected, setTerminalConnected] = useState<boolean>(false);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [termCmd, setTermCmd] = useState<string>('');
  const [termBusy, setTermBusy] = useState<boolean>(false);
  const termScreenRef = useRef<HTMLDivElement>(null);

  // Timer
  const LAB_KEY = 'lab_timer_cloud-security-lab';
  const savedTimeStr = localStorage.getItem(LAB_KEY);
  const initialTime = savedTimeStr ? parseInt(savedTimeStr, 10) : 5400;
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    !isNaN(initialTime) && initialTime > 0 ? initialTime : 5400
  );

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/cloud/status');
      if (res.ok) {
        const data = await res.json();
        setTotalScore(data.total_points ?? 0);
        setSolvedMap(data.solved ?? {});

        if (Array.isArray(data.completed_objectives)) {
          const objMap: Record<string, boolean> = {};
          data.completed_objectives.forEach((o: string) => {
            objMap[o] = true;
          });
          setCompletedObjs(objMap);
        }

        // Auto set active module to first unsolved unlocked module
        const solved = data.solved ?? {};
        for (let i = 1; i <= 5; i++) {
          const prevSolved = i === 1 || solved[`mod${i - 1}`];
          if (prevSolved && !solved[`mod${i}`]) {
            setActiveModuleNum(i);
            break;
          }
        }
      }
    } catch (e) {
      console.error('Failed to load cloud status', e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          localStorage.setItem(LAB_KEY, '0');
          return 0;
        }
        const next = prev - 1;
        localStorage.setItem(LAB_KEY, next.toString());
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [LAB_KEY]);

  useEffect(() => {
    if (termScreenRef.current) {
      termScreenRef.current.scrollTop = termScreenRef.current.scrollHeight;
    }
  }, [terminalLines, terminalConnected]);

  const isModuleSolved = (num: number) => !!solvedMap[`mod${num}`];
  const isModuleLocked = (num: number) => {
    if (num === 1) return false;
    return !isModuleSolved(num - 1);
  };

  const currentMod = CLOUD_MODULES.find((m) => m.num === activeModuleNum) || CLOUD_MODULES[0];

  const formatTimer = () => {
    const h = Math.floor(remainingSeconds / 3600);
    const m = Math.floor((remainingSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (remainingSeconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const handleFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagInput.trim() || submittingFlag) return;

    setSubmittingFlag(true);
    setFlagFeedback(null);

    try {
      const res = await apiFetch('/api/v1/cloud/submit-flag', {
        method: 'POST',
        body: JSON.stringify({ module: activeModuleNum, submitted_flag: flagInput.trim() }),
      });

      const data = await res.json();
      if (data.status === 'correct' || data.correct === true) {
        // Score comes exclusively from backend — read total_points from the API response
        const earnedPoints = data.points ?? currentMod.points;
        const newTotal = data.total_points ?? totalScore;  // never fallback-increment client-side

        setSolvedMap((prev) => ({
          ...prev,
          [`mod${activeModuleNum}`]: {
            points: earnedPoints,
            timestamp: new Date().toISOString(),
          },
        }));
        setTotalScore(newTotal);  // always trust backend value
        setFlagInput('');
        setFlagFeedback({ type: 'correct', message: '✓ Correct flag! Module solved.' });

        // Show Module Completion Popup Modal
        setCompletionModal({
          show: true,
          moduleNum: activeModuleNum,
          moduleTitle: currentMod.title,
          points: earnedPoints,
          totalScore: newTotal,
          isLastModule: activeModuleNum === 5,
        });
      } else {
        setFlagFeedback({ type: 'incorrect', message: '✗ Incorrect flag value. Try again.' });
      }
    } catch {
      setFlagFeedback({ type: 'error', message: 'Error submitting flag. Check connection.' });
    } finally {
      setSubmittingFlag(false);
    }
  };

  const handleStartTerminal = () => {
    setTerminalConnected(true);
    setTerminalLines([
      { type: 'info', text: 'Cyber Range Cloud Workstation v2.0 — LocalStack AWS CLI' },
      { type: 'info', text: 'Connected to lab2-student Docker container.' },
      { type: 'info', text: 'Target LocalStack endpoint: http://10.20.0.10:4566' },
      { type: 'info', text: '---------------------------------------------------------' },
    ]);
  };

  const handleDisconnectTerminal = () => {
    setTerminalConnected(false);
    setTerminalLines([]);
  };

  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = termCmd.trim();
    if (!cmd || termBusy || !terminalConnected) return;

    setTerminalLines((prev) => [...prev, { type: 'cmd', text: cmd }]);
    setTermCmd('');
    setTermBusy(true);

    try {
      const res = await apiFetch('/api/v1/cloud/terminal/run', {
        method: 'POST',
        body: JSON.stringify({ command: cmd, module: activeModuleNum }),
      });
      const data = await res.json();
      const output = (data.output || '').trim();
      if (output) {
        setTerminalLines((prev) => [
          ...prev,
          { type: data.exit_code === 0 ? 'out' : 'err', text: output },
        ]);
      }
      if (Array.isArray(data.completed_objectives)) {
        setCompletedObjs((prev) => {
          const next = { ...prev };
          data.completed_objectives.forEach((o: string) => {
            next[o] = true;
          });
          return next;
        });
      }
    } catch {
      setTerminalLines((prev) => [
        ...prev,
        { type: 'err', text: 'Error executing command on server.' },
      ]);
    } finally {
      setTermBusy(false);
    }
  };

  const handleUnlockHint = (hintIndex: number) => {
    const hintKey = `mod${activeModuleNum}_hint${hintIndex}`;
    setUnlockedHints((prev) => ({ ...prev, [hintKey]: true }));
    // Hint penalties are applied by ScoreService at module-completion time, not here.
    // Do NOT mutate totalScore client-side.
  };

  const handleExit = () => {
    apiFetch('/api/v1/cloud/exit', { method: 'POST' }).catch(() => {});
    navigate('/labs', { replace: true });
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="w-6 h-6 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm font-semibold">Loading Cloud Security Track…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-700">

      {/* ─── Top Header Navigation Bar ─── */}
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-30 shadow-xs">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">

          {/* Header Left: Session Badge, Title */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#10B981] border border-emerald-200/80">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
              </span>
              ACTIVE SESSION
            </span>

            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight hidden md:block">
              Cloud Security Track
            </h1>
          </div>

          {/* Header Right: Metrics, Timer, Exit Button */}
          <div className="flex items-center gap-2.5">
            {/* Module Counter Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Module {activeModuleNum} of 5</span>
            </div>

            {/* Score Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-[#2563EB] text-xs font-bold">
              <svg className="w-3.5 h-3.5 text-[#2563EB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Score: <span className="font-extrabold">{totalScore}</span> pts
            </div>

            {/* Session Timer Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono font-semibold">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Session: <span>{formatTimer()}</span>
            </div>

            {/* Exit Session Button */}
            <button
              onClick={handleExit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-all cursor-pointer ml-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Exit Session
            </button>
          </div>

        </div>
      </header>

      {/* ─── Main Content Wrapper ─── */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-140px)]">

          {/* LEFT PANEL (~40% -> lg:col-span-5): Modern White Card Design */}
          <div className="lg:col-span-5 bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
            <div className="space-y-6">

              {/* Module Navigation (1-5) Rounded Numbered Buttons */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">CLOUD SECURITY MODULES</span>
                <div className="flex items-center gap-2">
                  {CLOUD_MODULES.map((m) => {
                    const solved = isModuleSolved(m.num);
                    const locked = isModuleLocked(m.num);
                    const active = m.num === activeModuleNum;

                    return (
                      <button
                        key={m.num}
                        disabled={locked}
                        onClick={() => {
                          setActiveModuleNum(m.num);
                          setFlagFeedback(null);
                          setFlagInput('');
                        }}
                        className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                          active
                            ? 'bg-[#2563EB] text-white shadow-xs'
                            : solved
                            ? 'bg-emerald-100 text-[#10B981] hover:bg-emerald-200'
                            : locked
                            ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {locked ? (
                          <svg className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        ) : solved ? (
                          '✓'
                        ) : (
                          m.num
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Header & Badge & Title */}
              <div className="space-y-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-[#2563EB] border border-blue-200 uppercase tracking-wider">
                  CLOUD SECURITY — MODULE {currentMod.num}
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  {currentMod.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {currentMod.narrative}
                </p>
              </div>

              {/* Mission: Light-Blue Rounded Card */}
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 space-y-1.5 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-[#2563EB] uppercase tracking-wider">
                  <svg className="w-4 h-4 text-[#2563EB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  MISSION
                </div>
                <p className="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed">
                  {currentMod.mission}
                </p>
              </div>

              {/* Objectives: Clean Checklist Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    OBJECTIVES ({currentMod.objectives.length} REQUIRED)
                  </h3>
                  <span className="text-xs font-semibold text-slate-600">
                    {currentMod.objectives.filter((_, idx) =>
                      isModuleSolved(currentMod.num) || !!completedObjs[`mod${currentMod.num}_obj${idx + 1}`]
                    ).length}/{currentMod.objectives.length} completed
                  </span>
                </div>
                <ul className="space-y-2">
                  {currentMod.objectives.map((obj, idx) => {
                    const isObjDone = isModuleSolved(currentMod.num) || !!completedObjs[`mod${currentMod.num}_obj${idx + 1}`];
                    return (
                      <li
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-xl text-xs font-medium border transition-colors ${
                          isObjDone
                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950 font-semibold'
                            : 'bg-slate-50 border-slate-100 text-slate-700'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                            isObjDone
                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isObjDone && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span>{obj.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Hint System: Exactly 2 Hints per Module (-20 pts each) */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    MODULE HINTS (2 MAX)
                  </h3>
                  <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    -20 pts per hint
                  </span>
                </div>

                <div className="space-y-2.5">
                  {/* Hint 1 */}
                  {(() => {
                    const h1Key = `mod${activeModuleNum}_hint1`;
                    const h1Unlocked = !!unlockedHints[h1Key];
                    return (
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">1</span>
                            Hint 1 (-20 pts)
                          </span>
                          {!h1Unlocked ? (
                            <button
                              onClick={() => handleUnlockHint(1)}
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
                            >
                              Unlock Hint 1 (-20 pts)
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-emerald-600">Unlocked</span>
                          )}
                        </div>
                        {h1Unlocked && (
                          <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs font-mono text-slate-800 leading-relaxed">
                            {currentMod.hints[0]?.text}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Hint 2 */}
                  {(() => {
                    const h1Key = `mod${activeModuleNum}_hint1`;
                    const h2Key = `mod${activeModuleNum}_hint2`;
                    const h1Unlocked = !!unlockedHints[h1Key];
                    const h2Unlocked = !!unlockedHints[h2Key];
                    return (
                      <div className={`border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 ${!h1Unlocked ? 'opacity-60' : ''}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">2</span>
                            Hint 2 (-20 pts)
                          </span>
                          {!h2Unlocked ? (
                            <button
                              disabled={!h1Unlocked}
                              onClick={() => handleUnlockHint(2)}
                              className={`px-3 py-1 font-bold text-xs rounded-lg transition-all ${
                                h1Unlocked
                                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer'
                                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {h1Unlocked ? 'Unlock Hint 2 (-20 pts)' : 'Unlock Hint 1 First'}
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-emerald-600">Unlocked</span>
                          )}
                        </div>
                        {h2Unlocked && (
                          <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs font-mono text-slate-800 leading-relaxed">
                            {currentMod.hints[1]?.text}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

            </div>

            {/* Left Panel Bottom: Flag Submission */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="bg-slate-50 border border-[#E5E7EB] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    FLAG SUBMISSION
                  </label>
                  {(() => {
                    const allObjsDone = [1, 2, 3, 4].every(
                      (i) => isModuleSolved(activeModuleNum) || !!completedObjs[`mod${activeModuleNum}_obj${i}`]
                    );
                    if (isModuleSolved(activeModuleNum)) return null;
                    return allObjsDone ? (
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        ✓ Objectives Complete — Ready to Submit
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Complete all 4 objectives to unlock
                      </span>
                    );
                  })()}
                </div>

                {isModuleSolved(activeModuleNum) ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-[#10B981] flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Module completed — flag captured!</span>
                  </div>
                ) : (() => {
                  const allObjsDone = [1, 2, 3, 4].every(
                    (i) => isModuleSolved(activeModuleNum) || !!completedObjs[`mod${activeModuleNum}_obj${i}`]
                  );
                  return (
                    <form onSubmit={handleFlagSubmit} className="space-y-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={flagInput}
                          onChange={(e) => setFlagInput(e.target.value)}
                          placeholder={allObjsDone ? "FLAG{techcorp_...}" : "Complete all objectives above first..."}
                          autoComplete="off"
                          disabled={submittingFlag || !allObjsDone}
                          className="flex-1 bg-white border border-slate-300 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 outline-none transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
                        />
                        <button
                          type="submit"
                          disabled={submittingFlag || !allObjsDone}
                          className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submittingFlag ? 'Submitting...' : 'Submit Flag'}
                        </button>
                      </div>
                      {flagFeedback && (
                        <div
                          className={`text-xs font-semibold ${
                            flagFeedback.type === 'correct' ? 'text-[#10B981]' : 'text-rose-600'
                          }`}
                        >
                          {flagFeedback.message}
                        </div>
                      )}
                    </form>
                  );
                })()}
              </div>
            </div>

          </div>

          {/* RIGHT PANEL (~60% -> lg:col-span-7): Terminal Emulator Container */}
          <div className="lg:col-span-7 bg-[#0B1020] border border-slate-800 rounded-2xl shadow-xl flex flex-col overflow-hidden min-h-[500px] max-h-[calc(100vh-140px)]">

            {/* Terminal Header */}
            <div className="bg-[#111827] border-b border-slate-800/90 px-4 py-3 flex flex-wrap items-center justify-between gap-3">

              {/* Left: Terminal Title & Controls */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <span className="text-xs font-mono font-semibold text-slate-300 tracking-wide flex items-center gap-2">
                  Terminal Emulator &ndash; Execution Environment
                </span>
              </div>

              {/* Right: Status Badge & Actions */}
              <div className="flex items-center gap-3">
                {/* Status Badge */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/70 text-[#00FF9D] border border-emerald-700/50">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      terminalConnected ? 'bg-[#00FF9D] animate-pulse' : 'bg-slate-500'
                    }`}
                  />
                  <span>{terminalConnected ? 'INFRASTRUCTURE ONLINE' : 'INFRASTRUCTURE OFFLINE'}</span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStartTerminal}
                    disabled={terminalConnected}
                    className="px-3.5 py-1.5 bg-[#10B981] hover:bg-emerald-500 active:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start Terminal
                  </button>
                  <button
                    onClick={handleDisconnectTerminal}
                    disabled={!terminalConnected}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 font-semibold text-xs rounded-lg transition-all border border-slate-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Disconnect
                  </button>
                </div>
              </div>

            </div>

            {/* Terminal Body */}
            <div className="flex-1 p-2 bg-[#0B1020] relative flex flex-col overflow-hidden min-h-[400px]">
              {!terminalConnected ? (
                <div className="flex-1 flex flex-col justify-center items-center text-center space-y-3 p-8">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-xs font-mono text-slate-400 max-w-sm">
                    Click <span className="text-[#00FF9D] font-bold">"Start Terminal"</span> to connect to your execution workstation environment.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                  <div
                    ref={termScreenRef}
                    className="flex-1 overflow-y-auto p-3"
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', lineHeight: '1.6' }}
                  >
                    {terminalLines.map((line, i) => (
                      <div key={i}>
                        {line.type === 'cmd' ? (
                          <div>
                            <span style={{ color: '#00FF9D' }}>student-kali$</span>{' '}
                            <span style={{ color: '#f0f6fc' }}>{line.text}</span>
                          </div>
                        ) : line.type === 'out' ? (
                          <pre
                            style={{
                              color: '#00FF9D',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              margin: '2px 0 8px 0',
                              fontFamily: 'inherit',
                              fontSize: 'inherit',
                            }}
                          >
                            {line.text}
                          </pre>
                        ) : line.type === 'err' ? (
                          <pre
                            style={{
                              color: '#f87171',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              margin: '2px 0 8px 0',
                              fontFamily: 'inherit',
                              fontSize: 'inherit',
                            }}
                          >
                            {line.text}
                          </pre>
                        ) : (
                          <div style={{ color: '#64748B' }}>{line.text}</div>
                        )}
                      </div>
                    ))}
                    {termBusy && <div style={{ color: '#64748B' }}>Running command...</div>}
                  </div>

                  <form onSubmit={handleTerminalSubmit} className="shrink-0 border-t border-slate-800/80 bg-[#0d1526]">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span className="font-bold text-xs shrink-0" style={{ color: '#00FF9D', fontFamily: "'JetBrains Mono', monospace" }}>
                        student-kali$
                      </span>
                      <input
                        type="text"
                        value={termCmd}
                        onChange={(e) => setTermCmd(e.target.value)}
                        placeholder="aws s3 ls --no-sign-request --endpoint-url http://10.20.0.10:4566"
                        autoComplete="off"
                        disabled={termBusy}
                        className="flex-1 bg-transparent border-none outline-none text-[#00FF9D] placeholder-slate-600 disabled:opacity-60 text-xs font-mono"
                      />
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Terminal Status Footer */}
            <div className="bg-[#111827]/90 border-t border-slate-800/80 px-4 py-2 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>{terminalConnected ? 'Terminal connected' : 'Terminal not connected'}</span>
              <span>WS Port: 8022 | Docker Container</span>
            </div>
          </div>
        </div>
      </main>

      {/* Module Completion Popup Modal */}
      {completionModal && completionModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-5 transform transition-all scale-100">
            {/* Success Trophy Icon */}
            <div className="w-16 h-16 bg-emerald-100 border border-emerald-200 rounded-full flex items-center justify-center mx-auto shadow-inner text-emerald-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-extrabold tracking-widest uppercase text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                MODULE {completionModal.moduleNum} SOLVED!
              </span>
              <h2 className="text-xl font-black text-slate-900 leading-tight">
                {completionModal.moduleTitle}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {completionModal.isLastModule
                  ? '🎉 Congratulations! You have successfully completed all 5 Cloud Security Lab modules!'
                  : `All 4 objectives verified and flag captured for Module ${completionModal.moduleNum}.`}
              </p>
            </div>

            {/* Score Stats Badge */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-left">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Earned Points</span>
                <span className="text-base font-black text-emerald-600">+{completionModal.points} pts</span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Score</span>
                <span className="text-base font-black text-blue-600">{completionModal.totalScore} pts</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {!completionModal.isLastModule ? (
                <>
                  <button
                    onClick={() => {
                      const nextMod = completionModal.moduleNum + 1;
                      setCompletionModal(null);
                      setActiveModuleNum(nextMod);
                      setFlagFeedback(null);
                    }}
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Next Module (Module {completionModal.moduleNum + 1})</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCompletionModal(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Stay Here
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    Return to Dashboard
                  </button>
                  <button
                    onClick={() => navigate('/labs')}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Available Labs
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CloudSecurityLabPage;
