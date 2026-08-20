import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import * as xtermModule from '@xterm/xterm';
import * as fitModule from '@xterm/addon-fit';

// Resolve constructors safely for both CJS and ESM interop
const Terminal = (xtermModule.Terminal || (xtermModule as any).default?.Terminal);
const FitAddon = (fitModule.FitAddon || (fitModule as any).default?.FitAddon);

import {
  Clock,
  Terminal as TerminalIcon,
  CheckCircle2,
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Play,
  LogOut,
  ChevronDown,
  ChevronUp,
  Award,
  Zap
} from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

// ─── Phase Data ────────────────────────────────────────────────────────────────
interface Level {
  num: number;
  title: string;
}

interface Phase {
  name: string;
  color: string;
  textColor: string;
  levels: Level[];
}

const PHASES: Phase[] = [
  {
    name: "Phase 1: File Permissions & Ownership",
    color: "from-blue-600 to-indigo-600",
    textColor: "text-blue-400",
    levels: [
      { num: 0, title: "Level 0: The Permission Audit Begins" },
      { num: 1, title: "Level 1: Hidden Configuration" },
      { num: 2, title: "Level 2: Ownership Matters" },
      { num: 3, title: "Level 3: File Permissions & Group Access" },
      { num: 4, title: "Level 4: Access Control Lists (ACLs)" },
      { num: 5, title: "Level 5: umask & Default Permissions" },
      { num: 6, title: "Level 6: Practical Permission Audit" },
    ]
  },
  {
    name: "Phase 2: Users & Groups",
    color: "from-purple-600 to-fuchsia-600",
    textColor: "text-purple-400",
    levels: [
      { num: 7, title: "Level 7: On-board the New Team" },
      { num: 8, title: "Level 8: Password Policies & Shadow File" },
      { num: 9, title: "Level 9: Group Permissions & Shared Resources" },
      { num: 10, title: "Level 10: sudo Basics & sudoers" },
      { num: 11, title: "Level 11: sudo with Specific Commands" },
      { num: 12, title: "Level 12: Account Locking and Expiration" },
      { num: 13, title: "Level 13: Practical User Provisioning Scenario" },
    ]
  },
  {
    name: "Phase 3: Services & Systemd",
    color: "from-orange-600 to-amber-600",
    textColor: "text-orange-400",
    levels: [
      { num: 14, title: "Level 14: systemd Basics - Service Control" },
      { num: 15, title: "Level 15: Service Dependencies & Ordering" },
      { num: 16, title: "Level 16: Creating Custom systemd Services" },
      { num: 17, title: "Level 17: Logs & journalctl" },
      { num: 18, title: "Level 18: Service Security - User Context" },
      { num: 19, title: "Level 19: Troubleshooting Failing Services" },
      { num: 20, title: "Level 20: Real Scenario - App Service" },
    ]
  },
  {
    name: "Phase 4: Networking & Firewall",
    color: "from-emerald-600 to-teal-600",
    textColor: "text-emerald-400",
    levels: [
      { num: 21, title: "Level 21: Network Interfaces & IP Configuration" },
      { num: 22, title: "Level 22: DNS & Hostname Configuration" },
      { num: 23, title: "Level 23: iptables Basics - Firewall Rules" },
      { num: 24, title: "Level 24: Port Filtering & Service Exposure" },
      { num: 25, title: "Level 25: Troubleshooting Network Connectivity" },
      { num: 26, title: "Level 26: Stateful Rules & Rate Limiting" },
      { num: 27, title: "Level 27: Security Hardening Scenario" },
    ]
  },
  {
    name: "Phase 5: Storage & Filesystems",
    color: "from-red-600 to-rose-600",
    textColor: "text-red-400",
    levels: [
      { num: 28, title: "Level 28: Partitions & fdisk" },
      { num: 29, title: "Level 29: Filesystem Creation & Mounting" },
      { num: 30, title: "Level 30: Logical Volume Manager (LVM)" },
      { num: 31, title: "Level 31: Disk Usage Analysis & Cleanup" },
      { num: 32, title: "Level 32: Backup & Restore Basics" },
      { num: 33, title: "Level 33: Capstone Infrastructure Audit" },
    ]
  }
];

const get_points_for_level = (level: number): number => {
  if (0 <= level && level <= 6) return 50;
  if (7 <= level && level <= 13) return 75;
  if (14 <= level && level <= 20) return 100;
  if (21 <= level && level <= 27) return 100;
  if (28 <= level && level <= 33) return 125;
  return 0;
};

export const TechCorpLabSession: React.FC = () => {
  const navigate = useNavigate();
  const { token, apiFetch } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing environment...");
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const addLog = (msg: string) => {
    console.log(`[Diagnostic] ${msg}`);
    setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };
  const [currentLevel, setCurrentLevel] = useState(0);
  const [completedLevels, setCompletedLevels] = useState<string[]>([]);
  const [sshPort, setSshPort] = useState<number | null>(null);
  
  const [showBanner, setShowBanner] = useState(false);
  const [solvedLevel, setSolvedLevel] = useState<number | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({ 0: true });

  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<any>(null);
  const fitAddonInstance = useRef<any>(null);
  const wsInstance = useRef<WebSocket | null>(null);
  const reconnectingRef = useRef(false);
  
  // Timer (Clockwise duration timer counting up)
  const [timeElapsed, setTimeElapsed] = useState(0);

  const [completionModal, setCompletionModal] = useState<{
    show: boolean;
    isLastModule: boolean;
    moduleNum: number;
    moduleTitle: string;
    points: number;
    totalScore: number;
  } | null>(null);

  const handleShareAchievement = async (data: { labTitle: string; totalScore: number; username: string }) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `CyberRange Certificate - ${data.labTitle}`,
          text: `I completed ${data.labTitle} on CyberRange! Score: +${data.totalScore} pts.`,
          url: window.location.href,
        });
        return;
      } catch (err) {
        console.log('Share cancelled:', err);
      }
    }
    alert(`Certificate generated for ${data.labTitle}. Verify at CyberRange official portal.`);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Fetch Current Session & Provision ──────────────────────────────────────────
  useEffect(() => {
    const initializeLab = async () => {
      try {
        addLog("initializeLab: started");
        addLog(`initializeLab: token = ${token ? token.substring(0, 10) + "..." : "null"}`);
        setLoadingMessage("Checking for active lab session...");
        
        addLog("initializeLab: calling GET /api/v1/labs/techcorp/session");
        const res = await apiFetch('/api/v1/labs/techcorp/session');
        addLog(`initializeLab: GET /session response status = ${res.status}`);
        
        const data = await res.json();
        addLog(`initializeLab: GET /session response data = ${JSON.stringify(data)}`);
        
        if (data.session_exists && data.is_active) {
          addLog(`initializeLab: active session found. level = ${data.current_level}, port = ${data.ssh_port}`);
          setCurrentLevel(data.current_level);
          setCompletedLevels(data.completed_levels || []);
          setSshPort(data.ssh_port);
          
          // Expand corresponding phase
          const phaseIdx = PHASES.findIndex(p => p.levels.some(l => l.num === data.current_level));
          if (phaseIdx !== -1) {
            setExpandedPhases(prev => ({ ...prev, [phaseIdx]: true }));
          }
          
          if (data.duration_seconds !== undefined) {
            setTimeElapsed(data.duration_seconds);
          }
          
          addLog("initializeLab: session is ready, rendering layout...");
          setLoading(false);
        } else {
          // Provision new session or restart inactive container
          const isRestart = !!data.session_exists;
          addLog(`initializeLab: session inactive/empty. isRestart = ${isRestart}. calling provision...`);
          setLoadingMessage(isRestart ? "Restarting sandbox container..." : "Provisioning isolated student container...");
          
          const provRes = await apiFetch('/api/v1/labs/techcorp/provision', {
            method: 'POST'
          });
          addLog(`initializeLab: POST /provision status = ${provRes.status}`);
          if (!provRes.ok) {
            throw new Error(`Failed to provision container (status ${provRes.status})`);
          }
          const provData = await provRes.json();
          addLog(`initializeLab: provisioned container = ${JSON.stringify(provData)}`);
          
          setCurrentLevel(provData.current_level);
          setSshPort(provData.ssh_port);
          setCompletedLevels(data.completed_levels || []);
          
          // Expand corresponding phase
          const phaseIdx = PHASES.findIndex(p => p.levels.some(l => l.num === provData.current_level));
          if (phaseIdx !== -1) {
            setExpandedPhases(prev => ({ ...prev, [phaseIdx]: true }));
          }
          
          if (provData.duration_seconds !== undefined) {
            setTimeElapsed(provData.duration_seconds);
          }
          
          addLog("initializeLab: container is ready, rendering layout...");
          setLoading(false);
        }
      } catch (err: any) {
        addLog(`initializeLab error: ${err.message || String(err)}`);
        console.error(err);
        setLoadingMessage("Failed to setup lab. Please return to available labs.");
      }
    };

    initializeLab();

    return () => {
      if (wsInstance.current) wsInstance.current.close();
      if (termInstance.current) termInstance.current.dispose();
      // Auto-teardown Sysadmin container task when leaving page/navigating to dashboard
      apiFetch('/api/v1/labs/techcorp/teardown', { method: 'POST' }).catch(() => {});
    };
  }, []);

  // ─── Trigger Terminal Connection once loading is false and terminal div is mounted ───
  useEffect(() => {
    if (!loading && sshPort && terminalRef.current && !termInstance.current) {
      addLog(`terminalMountTrigger: terminal div is mounted, initializing connection for port ${sshPort}`);
      connectTerminal(sshPort);
    }
  }, [loading, sshPort]);

  // ─── Connect xterm.js to WebSocket Proxy ──────────────────────────────────────
  const connectTerminal = (port: number) => {
    if (!terminalRef.current) {
      addLog("connectTerminal: terminalRef.current is still null!");
      return;
    }
    
    let term = termInstance.current;
    let fitAddon = fitAddonInstance.current;
    
    if (!term) {
      // Initialize xterm for the first time
      term = new Terminal({
        cursorBlink: true,
        theme: {
          background: '#0f172a', // slate-900
          foreground: '#f8fafc', // slate-50
          cursor: '#38bdf8', // sky-400
          selectionBackground: '#334155', // slate-700
          black: '#000000',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#cbd5e1'
        },
        fontFamily: 'JetBrains Mono, Fira Code, Courier New, monospace',
        fontSize: 14,
        scrollback: 1000
      });
      
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      
      termInstance.current = term;
      fitAddonInstance.current = fitAddon;
      
      term.open(terminalRef.current);
      fitAddon.fit();
      term.focus();
      
      term.onData((data: string) => {
        if (wsInstance.current && wsInstance.current.readyState === WebSocket.OPEN) {
          wsInstance.current.send(data);
        }
      });
      
      const handleResize = () => {
        if (fitAddonInstance.current) {
          fitAddonInstance.current.fit();
        }
        if (wsInstance.current && wsInstance.current.readyState === WebSocket.OPEN && termInstance.current) {
          wsInstance.current.send(JSON.stringify({
            type: 'resize',
            cols: termInstance.current.cols,
            rows: termInstance.current.rows
          }));
        }
      };
      window.addEventListener('resize', handleResize);
    } else {
      // Terminal is already initialized, soft clear and focus
      term.clear();
      fitAddon.fit();
      term.focus();
    }
    
    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/labs/techcorp/terminal?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsInstance.current = ws;

    addLog("connectTerminal: connecting WebSocket...");
    ws.onopen = () => {
      addLog("ws: connection opened successfully");
      if (termInstance.current) {
        termInstance.current.focus();
        ws.send(JSON.stringify({
          type: 'resize',
          cols: termInstance.current.cols,
          rows: termInstance.current.rows
        }));
      }
    };

    ws.onmessage = async (event) => {
      let data = event.data;
      if (data instanceof Blob) {
        data = new Uint8Array(await data.arrayBuffer());
      }
      if (typeof data === 'string' && data.startsWith('{')) {
        try {
          const payload = JSON.parse(data);
          if (payload.type === 'level_complete') {
            addLog(`ws: received level complete event for level ${payload.level}`);
            setSolvedLevel(payload.level);
            setShowBanner(true);
            return;
          }
        } catch (e) {}
      }
      if (termInstance.current) {
        termInstance.current.write(data);
      }
    };

    ws.onclose = () => {
      addLog("ws: connection closed");
      if (!reconnectingRef.current && termInstance.current) {
        termInstance.current.write("\r\n\r\n\x1b[31m[Session disconnected. Press relaunch or end lab]\x1b[0m\r\n");
      }
    };

    ws.onerror = (err) => {
      addLog("ws: connection error!");
      console.error("WebSocket error:", err);
    };
  };

  // ─── Advance to Next Level ───────────────────────────────────────────────────
  const handleAdvance = async () => {
    if (solvedLevel === null) return;
    setAdvancing(true);
    try {
      const res = await apiFetch('/api/v1/labs/techcorp/advance', {
        method: 'POST'
      });
      if (!res.ok) throw new Error("Failed to advance level");
      const data = await res.json();
      
      if (data.status === 'completed' || data.status === 'success') {
        setCurrentLevel(data.next_level);
        
        // Add to completed list
        const solvedId = `techcorp_level${solvedLevel}`;
        if (!completedLevels.includes(solvedId)) {
          setCompletedLevels(prev => [...prev, solvedId]);
        }
        
        // Expand corresponding phase
        const phaseIdx = PHASES.findIndex(p => p.levels.some(l => l.num === data.next_level));
        if (phaseIdx !== -1) {
          setExpandedPhases(prev => ({ ...prev, [phaseIdx]: true }));
        }
        
        setShowBanner(false);
        setSolvedLevel(null);

        const isFinal = data.all_completed || data.is_completed || (completedLevels.length + 1 >= 34);
        if (isFinal) {
          setCompletionModal({
            show: true,
            isLastModule: true,
            moduleNum: solvedLevel !== null ? solvedLevel : currentLevel,
            moduleTitle: levelInfo?.level?.title || `Level ${solvedLevel}`,
            points: 100,
            totalScore: (completedLevels.length + 1) * 100,
          });
        }
        
        // Soft terminal reset and alert connection upgrade
        if (termInstance.current) {
          termInstance.current.reset();
          termInstance.current.write(`\r\n\x1b[32m[Advancing to Level ${data.next_level}... Connecting as level${data.next_level}]\x1b[0m\r\n`);
        }
        
        // Close and reconnect WebSocket
        reconnectingRef.current = true;
        if (wsInstance.current) wsInstance.current.close();
        
        setTimeout(() => {
          reconnectingRef.current = false;
          if (sshPort) connectTerminal(sshPort);
        }, 800);
      }
    } catch (err) {
      console.error(err);
      alert("Advancement validation failed. Make sure you solved the level correctly!");
    } finally {
      setAdvancing(false);
    }
  };

  // ─── End Lab Session ──────────────────────────────────────────────────────────
  const handleEndLab = async () => {
    if (!window.confirm("Are you sure you want to end this lab? Your progress will be saved but the container will be stopped.")) return;
    try {
      await apiFetch('/api/v1/labs/techcorp/provision', {
        method: 'DELETE'
      });
      navigate('/labs');
    } catch (err) {
      console.error(err);
      navigate('/labs');
    }
  };

  // Helper: toggle phase expand collapse
  const togglePhase = (idx: number) => {
    setExpandedPhases(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Helper: get current level metadata
  const getCurrentLevelInfo = () => {
    for (const phase of PHASES) {
      const level = phase.levels.find(l => l.num === currentLevel);
      if (level) {
        return { phase, level };
      }
    }
    return null;
  };
  const levelInfo = getCurrentLevelInfo();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100">
        <div className="p-8 max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-center space-y-6">
          <div className="flex justify-center">
            <RefreshCw className="w-16 h-16 text-sky-500 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100">Preparing Lab Sandbox</h2>
          <p className="text-slate-400 font-medium">{loadingMessage}</p>
          <div className="w-full bg-slate-850 h-2.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-sky-500 to-indigo-600 h-full rounded-full animate-pulse w-3/4"></div>
          </div>
          
          {/* Real-time diagnostics panel */}
          <div className="text-left text-xs bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1 max-h-48 overflow-y-auto font-mono text-slate-450">
            <div className="font-bold text-sky-400 border-b border-slate-850 pb-1 mb-1 flex items-center justify-between">
              <span>Diagnostic Console Log:</span>
              <span className="text-[10px] text-slate-500 font-normal">Auto-scrolling</span>
            </div>
            {debugLogs.length === 0 ? (
              <div className="text-slate-650 italic">No events generated yet...</div>
            ) : (
              debugLogs.map((log, idx) => (
                <div key={idx} className="whitespace-pre-wrap leading-relaxed border-b border-slate-900 pb-0.5 last:border-0">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* ─── Main Content (Terminal Pane) ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Terminal Header */}
        <header className="h-16 border-b border-slate-900 bg-slate-900/60 backdrop-blur flex items-center justify-between px-6 z-10">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate('/labs')} 
              className="flex items-center space-x-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-semibold text-sm">Dashboard</span>
            </button>
            <div className="h-4 w-[1px] bg-slate-800"></div>
            <div className="flex items-center space-x-2">
              <TerminalIcon className="w-5 h-5 text-sky-400" />
              <span className="font-bold text-slate-200 text-sm">Puzzle Infrastructure Remediation Sandbox</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 border border-slate-900 rounded-lg">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="font-mono text-sm font-semibold text-slate-300">{formatTime(timeElapsed)}</span>
            </div>
          </div>
        </header>

        {/* Terminal Sandbox Wrapper */}
        <div className="flex-1 p-6 bg-slate-950 flex flex-col justify-center items-center overflow-hidden">
          <div className="w-full h-full max-w-5xl bg-[#0f172a] border border-slate-900 rounded-xl shadow-2xl overflow-hidden flex flex-col relative">
            
            {/* Terminal Top Window Bar */}
            <div className="h-10 bg-slate-900/90 border-b border-slate-950 px-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
              </div>
              <div className="text-xs font-semibold text-slate-500 font-mono">
                student-container: {sshPort}
              </div>
              <div className="w-16"></div>
            </div>

            {/* Terminal Render Container */}
            <div className="flex-1 p-3 overflow-hidden">
              <div ref={terminalRef} className="w-full h-full overflow-hidden" />
            </div>

            {/* Level Complete Banner Overlay */}
            {showBanner && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-20 transition-all duration-300">
                <div className="bg-slate-900/90 border border-emerald-500/30 max-w-md w-full p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center space-y-6 relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl"></div>
                  <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl"></div>
                  
                  <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center">
                    <Award className="w-10 h-10 text-emerald-400 animate-pulse" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-emerald-400">Level {solvedLevel} Completed!</h3>
                    <p className="text-slate-300 text-sm">
                      Outstanding performance! You successfully resolved the configuration objective and captured the credential key.
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">XP Awarded:</span>
                    <span className="text-lg font-bold text-amber-400">+{solvedLevel !== null ? get_points_for_level(solvedLevel) : 50} pts</span>
                  </div>
                  
                  <button
                    onClick={handleAdvance}
                    disabled={advancing}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-base rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {advancing ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Validating & Reconnecting...</span>
                      </>
                    ) : (
                      <>
                        <span>Advance to Level {(solvedLevel ?? 0) + 1}</span>
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Right Sidebar (Lab Metadata / Level Stepper) ────────────────────── */}
      <aside className="w-80 border-l border-slate-900 bg-slate-900/20 backdrop-blur h-full flex flex-col overflow-hidden">
        
        {/* Active Level Header info */}
        <div className="p-6 border-b border-slate-900 bg-slate-900/40">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            <ShieldCheck className="w-4 h-4 text-sky-500" />
            <span>Active Challenge</span>
          </div>
          {levelInfo && (
            <div className="space-y-3">
              <h2 className="text-lg font-extrabold text-slate-100 leading-tight">
                {levelInfo.level.title}
              </h2>
              <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 ${levelInfo.phase.textColor}`}>
                {levelInfo.phase.name.split(':')[0]}
              </span>
            </div>
          )}

          {/* Instructions Guide Card */}
          <div className="mt-5 p-3.5 bg-slate-950/60 border border-slate-900 rounded-xl space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <TerminalIcon className="w-3.5 h-3.5 text-amber-500" />
              <span>Instructions</span>
            </div>
            <div className="space-y-2.5 text-xs text-slate-400 leading-relaxed font-medium">
              <p>
                1. Navigate to the level directory:
                <code className="block mt-1 p-2 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-amber-400 select-all cursor-pointer">
                  cd /opt/labs/level{currentLevel}
                </code>
              </p>
              <p>
                2. Read the objective to understand your task:
                <code className="block mt-1 p-2 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-green-400 select-all cursor-pointer">
                  cat Objective.txt
                </code>
              </p>
              <p>
                3. Once you solve the task, run validation to advance:
                <code className="block mt-1 p-2 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-sky-400 select-all cursor-pointer">
                  check_level {currentLevel}
                </code>
              </p>
            </div>

          </div>

          {/* Progress Tracker */}
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
              <span>Overall Progress</span>
              <span>{completedLevels.length} / 34 levels</span>
            </div>
            <div className="w-full bg-slate-850 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-sky-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${(completedLevels.length / 34) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* 34-Level List Accordion */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-900/60 p-4 space-y-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 mb-2">
            Lab Phases
          </div>
          {PHASES.map((phase, pIdx) => {
            const isExpanded = !!expandedPhases[pIdx];
            const completedInPhase = phase.levels.filter(l => completedLevels.includes(`techcorp_level${l.num}`)).length;
            const totalInPhase = phase.levels.length;
            const phaseStatusColor = completedInPhase === totalInPhase ? 'text-emerald-500' : 'text-slate-400';
            
            return (
              <div key={pIdx} className="pt-3 first:pt-0">
                <button
                  onClick={() => togglePhase(pIdx)}
                  className="w-full flex items-center justify-between py-2 text-left hover:bg-slate-900/30 rounded-lg px-2 transition-all cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-200 block">
                      {phase.name}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 block">
                      {completedInPhase} of {totalInPhase} solved
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-2 ml-2 pl-3 border-l border-slate-800 space-y-2.5 pb-2">
                    {phase.levels.map((lvl) => {
                      const isCompleted = completedLevels.includes(`techcorp_level${lvl.num}`);
                      const isCurrent = currentLevel === lvl.num;
                      
                      return (
                        <div 
                          key={lvl.num}
                          className={`flex items-start space-x-3 text-xs ${
                            isCurrent 
                              ? 'text-sky-400 font-bold' 
                              : isCompleted 
                                ? 'text-slate-400' 
                                : 'text-slate-600'
                          }`}
                        >
                          <div className="mt-0.5">
                            {isCompleted ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : isCurrent ? (
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-sky-400 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping"></div>
                              </div>
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-700"></div>
                            )}
                          </div>
                          <span className="leading-tight">{lvl.title}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Module / Lab Completion Popup Modal */}
      {completionModal && completionModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-5">
            <div className="w-16 h-16 bg-sky-500/20 border border-sky-500/40 rounded-full flex items-center justify-center mx-auto text-sky-400">
              <TerminalIcon className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-extrabold tracking-widest uppercase text-sky-400 bg-sky-500/10 px-3 py-1 rounded-full border border-sky-500/30">
                {completionModal.isLastModule ? '🎉 LAB COMPLETED!' : `LEVEL ${completionModal.moduleNum} COMPLETED!`}
              </span>
              <h2 className="text-xl font-bold text-white leading-tight">
                {completionModal.moduleTitle}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {completionModal.isLastModule
                  ? 'Congratulations! You solved all levels in Puzzle Infrastructure Sandbox!'
                  : `You successfully completed Level ${completionModal.moduleNum}. Next level has been unlocked.`}
              </p>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs">
              <div className="text-left space-y-1">
                <div className="text-slate-400 font-semibold">Points Earned: <span className="text-sky-400 font-bold">+{completionModal.points} pts</span></div>
                <div className="text-slate-400 font-semibold">Total Score: <span className="text-emerald-400 font-bold">{completionModal.totalScore} pts</span></div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-slate-400 font-semibold">Completed: <span className="text-white font-bold">{completedLevels.length}/34</span></div>
                <div className="text-slate-400 font-semibold">Time Spent: <span className="text-amber-400 font-bold">{formatTime(timeElapsed)}</span></div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2.5 pt-2">
              {!completionModal.isLastModule ? (
                <>
                  <button
                    onClick={() => {
                      setCompletionModal(null);
                      if (solvedLevel !== null) {
                        handleAdvance();
                      }
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                  >
                    Continue to Next Module
                  </button>
                  <button
                    onClick={() => setCompletionModal(null)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all"
                  >
                    Review Module
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleShareAchievement({ labTitle: 'Puzzle Infrastructure Sandbox', totalScore: completionModal.totalScore, username: 'Student' })}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4" /> Share Achievement & Download Card
                  </button>
                  <button
                    onClick={() => {
                      setCompletionModal(null);
                      navigate('/dashboard');
                    }}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all"
                  >
                    Return to Dashboard
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

export default TechCorpLabSession;
