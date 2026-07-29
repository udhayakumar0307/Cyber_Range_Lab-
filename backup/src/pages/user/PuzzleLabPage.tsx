import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { RealTerminal } from '../../components/RealTerminal';
import { 
  Puzzle, 
  Terminal as TerminalIcon, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Sparkles,
  ArrowLeft,
  Lock,
  Award,
  Target,
  BookOpen,
  Code2,
  X,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface PuzzleLevel {
  levelNum: number;
  label: string; // e.g. "Level 0 → Level 1"
  id: string;
  title: string;
  diffLabel: string;
  points: number;
  estimatedTime: string;
  goal: string;
  commandsNeeded: string[];
  readingMaterial: { title: string; hint: string }[];
  objectives: string[];
}

const PUZZLE_LEVELS: PuzzleLevel[] = [
  {
    levelNum: 0,
    label: 'Level 0 → Level 1',
    id: 'puzzle-lab_module1',
    title: 'The Permission Audit Begins',
    diffLabel: 'Easy',
    points: 100,
    estimatedTime: '5 min',
    goal: 'A developer named alice reports she cannot read /opt/labs/level0/deploy.log. Fix file permissions so alice (and root) can read it, then retrieve the Level 1 passkey.',
    commandsNeeded: ['chmod', 'ls', 'cat'],
    readingMaterial: [
      { title: 'Linux Permission Auditing', hint: 'Use ls -l /opt/labs/level0/deploy.log to inspect initial octal permissions.' },
      { title: 'chmod Syntax Guide', hint: 'Understand owner, group, and others permission bits to grant read access.' }
    ],
    objectives: [
      'Inspect initial permissions on /opt/labs/level0/deploy.log',
      'Modify permissions so alice and root can read the file',
      'Execute cat /opt/labs/level0/deploy.log',
      'Submit Level 1 passkey flag'
    ]
  },
  {
    levelNum: 1,
    label: 'Level 1 → Level 2',
    id: 'puzzle-lab_module2',
    title: 'Hidden Configuration Discovery',
    diffLabel: 'Easy',
    points: 100,
    estimatedTime: '5 min',
    goal: 'The operations team stored a critical configuration in a hidden file /opt/labs/level1/.secret_config. Use directory listing options to reveal and read it.',
    commandsNeeded: ['ls', 'cat'],
    readingMaterial: [
      { title: 'Linux Hidden Files Convention', hint: 'Files starting with dot (.) are hidden from normal ls output.' },
      { title: 'ls Command Flags', hint: 'Use ls -a or ls -la to list all hidden files.' }
    ],
    objectives: [
      'Navigate to /opt/labs/level1/',
      'Execute ls -a to reveal hidden files',
      'Read .secret_config file',
      'Submit Level 2 passkey flag'
    ]
  },
  {
    levelNum: 2,
    label: 'Level 2 → Level 3',
    id: 'puzzle-lab_module3',
    title: 'Ownership & Access Control',
    diffLabel: 'Easy',
    points: 150,
    estimatedTime: '10 min',
    goal: 'The configuration file /opt/labs/level2/config.conf is owned by the wrong user. Change ownership to root:techcorp so the configuration becomes readable.',
    commandsNeeded: ['chown', 'chgrp', 'ls', 'cat'],
    readingMaterial: [
      { title: 'Linux File Ownership', hint: 'chown owner:group filename sets both owner and group.' },
      { title: 'Group Access Control', hint: 'Ensure the file is owned by root:techcorp.' }
    ],
    objectives: [
      'Inspect ownership of /opt/labs/level2/config.conf',
      'Change ownership to root:techcorp using chown',
      'Verify updated ownership with ls -l',
      'Submit Level 3 passkey flag'
    ]
  },
  {
    levelNum: 3,
    label: 'Level 3 → Level 4',
    id: 'puzzle-lab_module4',
    title: 'Special Permissions — setuid',
    diffLabel: 'Medium',
    points: 150,
    estimatedTime: '10 min',
    goal: 'The utility script /opt/labs/level3/check_status.sh needs elevated privileges to run. Set the setuid bit so it executes as root when called by users.',
    commandsNeeded: ['chmod', 'ls', 'cat'],
    readingMaterial: [
      { title: 'Linux setuid Bit', hint: 'setuid allows an executable to run with the permissions of the file owner.' },
      { title: 'chmod Symbolic & Octal setuid', hint: 'Use chmod u+s or chmod 4755 on the script file.' }
    ],
    objectives: [
      'Inspect permissions on /opt/labs/level3/check_status.sh',
      'Set the setuid bit on check_status.sh',
      'Execute /opt/labs/level3/check_status.sh',
      'Submit Level 4 passkey flag'
    ]
  },
  {
    levelNum: 4,
    label: 'Level 4 → Level 5',
    id: 'puzzle-lab_module5',
    title: 'Process Isolation & SUID Audit',
    diffLabel: 'Medium',
    points: 200,
    estimatedTime: '15 min',
    goal: 'Identify misconfigured SUID binaries across the filesystem, remove unauthorized elevated permissions, and capture the flag.',
    commandsNeeded: ['find', 'chmod', 'ls', 'whoami'],
    readingMaterial: [
      { title: 'SUID Auditing with find', hint: 'Search with find / -perm -4000 2>/dev/null to list all SUID binaries.' },
      { title: 'GTFOBins PrivEsc Reference', hint: 'Cross-reference SUID binary names with GTFOBins bypass techniques.' }
    ],
    objectives: [
      'Find all SUID binaries using find / -perm -4000',
      'Identify binary with unauthorized root permissions',
      'Strip dangerous SUID bit using chmod u-s <path>',
      'Submit Level 5 passkey flag'
    ]
  },
  {
    levelNum: 5,
    label: 'Level 5 → Level 6',
    id: 'puzzle-lab_module6',
    title: 'umask & Default Permissions',
    diffLabel: 'Medium',
    points: 200,
    estimatedTime: '15 min',
    goal: 'New files in /opt/labs/level5/ are created with insecure permissions. Calculate and set umask 0022 so new files are 644 and directories are 755.',
    commandsNeeded: ['umask', 'chmod', 'cat'],
    readingMaterial: [
      { title: 'Understanding umask', hint: 'umask subtracts default creation permissions (666 - 022 = 644).' },
      { title: 'Persistent Environment Setup', hint: 'Set umask 0022 in shell or profile startup files.' }
    ],
    objectives: [
      'Check current umask setting',
      'Set umask to 0022',
      'Verify newly created files receive 644 permissions',
      'Submit Level 6 passkey flag'
    ]
  },
  {
    levelNum: 6,
    label: 'Level 6 → Level 7',
    id: 'puzzle-lab_module7',
    title: 'Practical Permission Audit Challenge',
    diffLabel: 'Hard',
    points: 250,
    estimatedTime: '20 min',
    goal: 'Read /opt/labs/level6/AUDIT_SPEC.txt and audit/remediate permissions across multiple target files according to specification.',
    commandsNeeded: ['chmod', 'ls', 'find', 'cat'],
    readingMaterial: [
      { title: 'Multi-File Audit Techniques', hint: 'Compare file permissions against AUDIT_SPEC.txt using ls -l.' },
      { title: 'Permissions Best Practices', hint: 'Ensure owner-only, group-readable, and public files match exact modes.' }
    ],
    objectives: [
      'Read /opt/labs/level6/AUDIT_SPEC.txt',
      'Audit permissions of all files in /opt/labs/level6/',
      'Remediate permission modes (600, 640, 644)',
      'Run validator script and submit Level 7 passkey flag'
    ]
  },
  {
    levelNum: 7,
    label: 'Level 7 → Level 8',
    id: 'puzzle-lab_module8',
    title: 'On-board the New Team',
    diffLabel: 'Hard',
    points: 250,
    estimatedTime: '20 min',
    goal: 'Provision user accounts bob, charlie, and diana with bash shells and home directories, and assign them to the junior_admins group.',
    commandsNeeded: ['groupadd', 'useradd', 'usermod'],
    readingMaterial: [
      { title: 'User Account Provisioning', hint: 'Use useradd -m -s /bin/bash <username>.' },
      { title: 'Group Membership Management', hint: 'Use groupadd junior_admins and usermod -a -G junior_admins.' }
    ],
    objectives: [
      'Create group junior_admins with groupadd',
      'Create users bob, charlie, diana with home directories and bash shell',
      'Add users to junior_admins group',
      'Execute /opt/labs/level7/validate_users.sh and submit Level 8 flag'
    ]
  },
  {
    levelNum: 8,
    label: 'Level 8 → Level 9',
    id: 'puzzle-lab_module9',
    title: 'Password Policies & Shadow File',
    diffLabel: 'Hard',
    points: 300,
    estimatedTime: '20 min',
    goal: 'Configure password aging policies for user bob using chage (-M 90 -W 14) and verify shadow file enforcement.',
    commandsNeeded: ['chage', 'passwd', 'cat'],
    readingMaterial: [
      { title: 'Password Expiration with chage', hint: 'Use chage -M 90 bob for max days and -W 14 for warning days.' },
      { title: 'Shadow File Inspection', hint: 'Inspect /etc/shadow or use chage -l bob to verify.' }
    ],
    objectives: [
      'Inspect user bob aging policy with chage -l bob',
      'Configure 90-day password expiration (-M 90)',
      'Set 14-day password expiration warning (-W 14)',
      'Run validator script and submit Level 9 passkey flag'
    ]
  },
  {
    levelNum: 9,
    label: 'Level 9 → Level 10',
    id: 'puzzle-lab_module10',
    title: 'Group Permissions & Shared Resources',
    diffLabel: 'Advanced',
    points: 300,
    estimatedTime: '25 min',
    goal: 'Configure /opt/labs/level9/shared_repo/ with setgid (chmod g+s) and developers group ownership for team collaboration.',
    commandsNeeded: ['chgrp', 'chmod', 'ls'],
    readingMaterial: [
      { title: 'Directory setgid Bit', hint: 'setgid on directories (chmod g+s / 2775) causes new files to inherit group ownership.' },
      { title: 'Collaborative Permissions', hint: 'Set chgrp developers and grant group write access (chmod g+w).' }
    ],
    objectives: [
      'Set group ownership of shared_repo to developers',
      'Apply setgid bit using chmod g+s',
      'Ensure group write permissions (chmod g+w)',
      'Run validator script and submit Level 10 passkey flag'
    ]
  },
  {
    levelNum: 10,
    label: 'Level 10 → Level 11',
    id: 'puzzle-lab_module11',
    title: 'sudo Basics & sudoers Security (Capstone)',
    diffLabel: 'Advanced',
    points: 350,
    estimatedTime: '30 min',
    goal: 'Edit /etc/sudoers safely with visudo to grant the %junior_admins group passwordless sudo access for specified administration commands.',
    commandsNeeded: ['visudo', 'sudo', 'systemctl', 'journalctl'],
    readingMaterial: [
      { title: 'visudo & Sudoers Syntax', hint: 'Always edit sudoers with visudo to prevent syntax lockouts.' },
      { title: 'Group Sudo Delegation', hint: 'Use %junior_admins ALL=(ALL) NOPASSWD: /bin/systemctl, ...' }
    ],
    objectives: [
      'Open sudoers file safely using visudo',
      'Add NOPASSWD sudo rule for %junior_admins group',
      'Test sudo privilege execution without password',
      'Run capstone validator script and submit Level 11 Capstone flag'
    ]
  }
];

export const PuzzleLabPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeLevelIndex, setActiveLevelIndex] = useState(0);
  const [completedLevels, setCompletedLevels] = useState<Record<number, boolean>>({});
  const [flagInput, setFlagInput] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);

  const currentLevel = PUZZLE_LEVELS[activeLevelIndex];

  // Dynamic Total Obtainable Max Points (100 + 150 + 200 + 250 + 300 = 1000 Pts)
  const TOTAL_MAX_POINTS = PUZZLE_LEVELS.reduce((sum, lvl) => sum + lvl.points, 0);

  // Fetch completion status from backend API
  useEffect(() => {
    let cancelled = false;
    const fetchProgress = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/reporting/dashboard', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          const recent = data.recent_activity || [];
          const doneMap: Record<number, boolean> = {};
          recent.forEach((act: any) => {
            if (act.module_id && act.module_id.startsWith('puzzle-lab_module')) {
              const numStr = act.module_id.replace('puzzle-lab_module', '');
              const num = parseInt(numStr, 10);
              if (!isNaN(num)) {
                doneMap[num - 1] = true;
              }
            }
          });
          setCompletedLevels(doneMap);
        }
      } catch (err) {
        // Fallback gracefully
      }
    };
    fetchProgress();
    return () => { cancelled = true; };
  }, []);

  const handleFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagInput.trim()) return;

    setSubmissionStatus('submitting');
    setStatusMessage('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/reporting/submit-flag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          lab_id: 'puzzle-lab',
          module_id: currentLevel.id,
          flag: flagInput.trim()
        })
      });

      const data = await res.json();
      if (res.ok && (data.status === 'correct' || data.success || data.already_completed)) {
        setSubmissionStatus('success');
        setStatusMessage(`Flag Verified! +${data.points_awarded || currentLevel.points} Pts Awarded.`);
        setCompletedLevels(prev => ({ ...prev, [activeLevelIndex]: true }));
        setFlagInput('');
      } else {
        setSubmissionStatus('error');
        setStatusMessage(data.detail || data.message || 'Invalid flag payload. Check your terminal output and verify the level requirements.');
      }
    } catch (err) {
      setSubmissionStatus('error');
      setStatusMessage('Network connectivity error submitting flag.');
    }
  };

  const totalPointsEarned = PUZZLE_LEVELS.reduce((sum, lvl, idx) => {
    return completedLevels[idx] ? sum + lvl.points : sum;
  }, 0);

  const completedCount = Object.keys(completedLevels).filter(k => completedLevels[parseInt(k, 10)]).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F14] text-slate-900 dark:text-[#FFFFFF] flex flex-col font-sans selection:bg-[#2563EB] selection:text-white transition-colors duration-200">
      {/* Header Bar */}
      <header className="h-16 border-b border-slate-200 dark:border-[#1F2937] bg-white dark:bg-[#111827]/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs dark:shadow-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/labs')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-[#1A1F2E] rounded-xl text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Return to Available Labs"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-[#3B82F6]/10 border border-blue-200 dark:border-[#3B82F6]/30 flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA] shadow-xs dark:shadow-[0_0_12px_rgba(59,130,246,0.3)]">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white text-base tracking-tight flex items-center gap-2">
                OverTheWire SysAdmin Wargame
                <span className="text-[10px] font-extrabold uppercase bg-blue-50 dark:bg-[#3B82F6]/20 text-[#2563EB] dark:text-[#60A5FA] border border-blue-200 dark:border-[#3B82F6]/40 px-2 py-0.5 rounded-full">
                  Level Path
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">Progressive level wargame challenges to master Linux security.</p>
            </div>
          </div>
        </div>

        {/* Global Stats & Toggle Terminal */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 bg-slate-100 dark:bg-[#1A1F2E] border border-slate-200 dark:border-[#1F2937] px-4 py-2 rounded-xl text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-[#2563EB] dark:text-[#60A5FA]">
              <Award className="w-4 h-4 text-[#2563EB] dark:text-[#3B82F6]" />
              <span>{totalPointsEarned} / {TOTAL_MAX_POINTS} Pts</span>
            </div>
            <div className="w-px h-3.5 bg-slate-300 dark:bg-[#1F2937]"></div>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#9CA3AF]">
              <Target className="w-4 h-4 text-[#10B981]" />
              <span>{completedCount} / {PUZZLE_LEVELS.length} Levels Solved</span>
            </div>
          </div>

          <button
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              isTerminalOpen
                ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                : 'bg-slate-100 dark:bg-[#1A1F2E] text-slate-700 dark:text-[#60A5FA] border-slate-200 dark:border-[#1F2937] hover:bg-slate-200 dark:hover:bg-[#253248]'
            }`}
          >
            <TerminalIcon className="w-4 h-4" />
            <span>{isTerminalOpen ? 'Terminal Active' : 'Console Window'}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: OverTheWire Style Level List */}
        <aside className="w-64 border-r border-slate-200 dark:border-[#1F2937] bg-white dark:bg-[#111827] p-4 space-y-2 overflow-y-auto flex-shrink-0">
          <div className="px-3 py-2 text-[11px] font-bold text-slate-500 dark:text-[#9CA3AF] uppercase tracking-wider border-b border-slate-100 dark:border-[#1F2937] mb-2 flex items-center justify-between">
            <span>Levels</span>
            <span>OverTheWire</span>
          </div>

          <div className="space-y-1 font-mono text-xs">
            {PUZZLE_LEVELS.map((lvl, idx) => {
              const isSelected = idx === activeLevelIndex;
              const isDone = !!completedLevels[idx];
              const isUnlocked = idx === 0 || !!completedLevels[idx - 1] || isDone;

              return (
                <button
                  key={lvl.id}
                  disabled={!isUnlocked}
                  onClick={() => {
                    setActiveLevelIndex(idx);
                    setSubmissionStatus('idle');
                    setStatusMessage('');
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-all flex items-center justify-between group ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-[#1A1F2E] border-[#2563EB] dark:border-[#3B82F6] text-[#2563EB] dark:text-[#60A5FA] font-bold shadow-xs'
                      : isDone
                      ? 'bg-slate-50 dark:bg-[#1A1F2E]/60 border-slate-200 dark:border-[#1F2937] text-emerald-600 dark:text-[#10B981]'
                      : isUnlocked
                      ? 'bg-white dark:bg-[#111827] border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A1F2E]'
                      : 'opacity-40 border-transparent text-slate-400 dark:text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isDone ? (
                      <span className="text-[#10B981] font-bold">✓</span>
                    ) : !isUnlocked ? (
                      <Lock className="w-3 h-3 text-slate-400 dark:text-gray-500" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] dark:bg-[#3B82F6]"></span>
                    )}
                    <span className="font-semibold text-[11px]">{lvl.label}</span>
                  </div>

                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#0B0F14] text-slate-500 dark:text-[#9CA3AF]">
                    +{lvl.points}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Main Content Panel: Question & Side-by-Side Terminal View */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-[#0B0F14]">
          <div className={`mx-auto gap-6 transition-all duration-300 ${
            isTerminalOpen ? 'grid grid-cols-1 xl:grid-cols-2 max-w-7xl' : 'max-w-4xl space-y-6'
          }`}>
            {/* Left Column / Full Width: Question & Level Goal */}
            <div className="space-y-6">
              {/* Level Goal Card */}
              <div className="bg-white dark:bg-[#1A1F2E] border border-slate-200 dark:border-[#1F2937] rounded-2xl p-6 space-y-4 shadow-xs dark:shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1F2937] pb-4">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#2563EB] dark:text-[#60A5FA] uppercase tracking-wider">
                      {currentLevel.label}
                    </span>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                      SysAdmin {currentLevel.label}: {currentLevel.title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-[#111827] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#1F2937] text-xs font-bold">
                      {currentLevel.diffLabel} (+{currentLevel.points} Pts)
                    </span>
                    {completedLevels[activeLevelIndex] && (
                      <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-[#10B981]/20 text-[#10B981] border border-emerald-200 dark:border-[#10B981]/40 text-xs font-bold flex items-center gap-1">
                        ✓ Completed
                      </span>
                    )}
                  </div>
                </div>

                {/* Level Goal Text */}
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Target className="w-4 h-4 text-[#2563EB] dark:text-[#3B82F6]" /> Level Goal
                  </h3>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans bg-slate-50 dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-[#1F2937]">
                    {currentLevel.goal}
                  </p>
                </div>

                {/* Task Objectives & Open Terminal Button */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-[#1F2937]">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> Level Objectives
                  </h3>
                  <ul className="space-y-2">
                    {currentLevel.objectives.map((obj, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#111827] p-3 rounded-xl border border-slate-200 dark:border-[#1F2937]">
                        <span className="w-5 h-5 rounded-full bg-blue-50 dark:bg-[#1A1F2E] text-[#2563EB] dark:text-[#60A5FA] border border-blue-200 dark:border-[#3B82F6]/40 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                          {i + 1}
                        </span>
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Flag Submission Box */}
              <div className="bg-white dark:bg-[#1A1F2E] border border-slate-200 dark:border-[#1F2937] rounded-2xl p-6 space-y-4 shadow-xs dark:shadow-md">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" /> Submit Level Passkey Flag
                </h3>

                <form onSubmit={handleFlagSubmit} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={flagInput}
                    onChange={(e) => setFlagInput(e.target.value)}
                    placeholder="Enter Level Flag (e.g. FLAG{sysadmin_...})"
                    className="flex-1 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#3B82F6] focus:ring-1 focus:ring-[#2563EB] font-mono transition-all"
                  />
                  <button
                    type="submit"
                    disabled={submissionStatus === 'submitting'}
                    className="px-6 py-3 bg-[#2563EB] hover:bg-blue-700 dark:bg-[#3B82F6] dark:hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs dark:shadow-[0_0_15px_rgba(59,130,246,0.4)] disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" /> Submit Flag
                  </button>
                </form>

                {statusMessage && (
                  <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 ${
                    submissionStatus === 'success' 
                      ? 'bg-emerald-50 dark:bg-[#10B981]/15 border border-emerald-200 dark:border-[#10B981]/40 text-emerald-700 dark:text-[#10B981]' 
                      : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  }`}>
                    {submissionStatus === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{statusMessage}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column / Side-by-Side: Real Interactive Linux PTY Terminal Console */}
            {isTerminalOpen && (
              <div className="flex flex-col h-full min-h-[500px] sticky top-20 animate-in fade-in zoom-in-95 duration-200">
                <RealTerminal
                  labId="puzzle-lab"
                  levelNum={activeLevelIndex}
                  height="560px"
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
