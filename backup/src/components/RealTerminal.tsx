import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { RefreshCw, Terminal as TerminalIcon, Maximize2, Minimize2, CheckCircle2, AlertCircle } from 'lucide-react';

interface RealTerminalProps {
  labId?: string;
  levelNum?: number;
  token?: string;
  height?: string;
  className?: string;
  /** Called every time the user submits a command (presses Enter) */
  onCommand?: (cmd: string) => void;
}

export const RealTerminal: React.FC<RealTerminalProps> = ({
  labId = 'puzzle-lab',
  levelNum = 0,
  token,
  height = '450px',
  className = '',
  onCommand,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstanceRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // Tracks the cancellation token of the current socket so stale async events are silenced
  const cancelTokenRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  // Accumulates the current typed command line for objective detection
  const commandBufferRef = useRef<string>('');
  // Keep a stable ref to the onCommand callback so the onData closure is never stale
  const onCommandRef = useRef(onCommand);
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);

  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const connectWebSocket = () => {
    // Cancel any previous socket's async events
    cancelTokenRef.current.cancelled = true;

    if (socketRef.current) {
      socketRef.current.close();
    }

    // New cancellation token for this socket — captured by the closures below.
    // Renamed to avoid shadowing the `token` prop (the actual auth token string),
    // which was previously never sent to the WebSocket due to the shadowing.
    const cancelToken = { cancelled: false };
    cancelTokenRef.current = cancelToken;

    setConnectionState('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const params = new URLSearchParams({ level: String(levelNum) });
    if (token) params.set('token', token);
    const wsUrl = `${protocol}//${host}/api/v1/terminal/ws/${labId}?${params.toString()}`;

    console.log('[RealTerminal] Connecting to WebSocket:', wsUrl);
    const socket = new WebSocket(wsUrl);
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;

    socket.onopen = () => {
      if (cancelToken.cancelled) return;
      console.log('[RealTerminal] WebSocket Connected');
      setConnectionState('connected');

      if (termInstanceRef.current && fitAddonRef.current) {
        fitAddonRef.current.fit();
        termInstanceRef.current.focus();
        const rows = termInstanceRef.current.rows;
        const cols = termInstanceRef.current.cols;
        socket.send(JSON.stringify({ type: 'resize', rows, cols }));
      }
    };

    socket.onmessage = (event) => {
      if (cancelToken.cancelled) return;
      if (termInstanceRef.current) {
        if (typeof event.data === 'string') {
          termInstanceRef.current.write(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          const buffer = new Uint8Array(event.data);
          termInstanceRef.current.write(buffer);
        }
      }
    };

    socket.onerror = () => {
      if (cancelToken.cancelled) return;
      setConnectionState('error');
    };

    socket.onclose = () => {
      if (cancelToken.cancelled) return;
      setConnectionState('disconnected');
    };
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'Fira Code, Menlo, Monaco, Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      theme: {
        background: '#0B0F17',
        foreground: '#F3F4F6',
        cursor: '#38BDF8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#1F2937',
        red: '#EF4444',
        green: '#10B981',
        yellow: '#F59E0B',
        blue: '#3B82F6',
        magenta: '#EC4899',
        cyan: '#06B6D4',
        white: '#F9FAFB',
        brightBlack: '#4B5563',
        brightRed: '#F87171',
        brightGreen: '#34D399',
        brightYellow: '#FBBF24',
        brightBlue: '#60A5FA',
        brightMagenta: '#F472B6',
        brightCyan: '#22D3EE',
        brightWhite: '#FFFFFF',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    termInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    // Auto-focus terminal on mount
    term.focus();

    // Forward xterm input to WebSocket; also track command buffer for objective detection
    term.onData((data) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(data);
      }

      // Track typed characters to build the command buffer
      if (data === '\r' || data === '\n') {
        // Enter pressed — fire onCommand with the buffered command
        const cmd = commandBufferRef.current.trim();
        if (cmd && onCommandRef.current) {
          onCommandRef.current(cmd);
        }
        commandBufferRef.current = '';
      } else if (data === '\x7f' || data === '\b') {
        // Backspace
        commandBufferRef.current = commandBufferRef.current.slice(0, -1);
      } else if (data.charCodeAt(0) >= 32) {
        // Printable character
        commandBufferRef.current += data;
      }
    });

    connectWebSocket();

    const handleResize = () => {
      if (fitAddonRef.current && termInstanceRef.current) {
        fitAddonRef.current.fit();
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({
              type: 'resize',
              rows: termInstanceRef.current.rows,
              cols: termInstanceRef.current.cols,
            })
          );
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      // Cancel the current socket's async events before closing
      cancelTokenRef.current.cancelled = true;
      window.removeEventListener('resize', handleResize);
      if (socketRef.current) {
        socketRef.current.close();
      }
      term.dispose();
    };
  }, [labId, levelNum, token]);

  return (
    <div className={`w-full flex flex-col bg-[#0B0F17] rounded-xl border border-slate-800 shadow-xl overflow-hidden ${isFullscreen ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)]' : ''} ${className}`}>
      {/* Terminal Header */}
      <div className="h-10 bg-[#111827] px-4 flex items-center justify-between border-b border-slate-800 select-none">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-400 pl-2">
            <TerminalIcon className="w-3.5 h-3.5 text-blue-400" />
            <span>
              {labId === 'lab1-recon'
                ? 'SecureGuard Red Team — Kali Linux Shell'
                : `Puzzle Infrastructure Shell — Level ${levelNum} (student${levelNum})`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Badge */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold">
            {connectionState === 'connected' && (
              <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-800/40">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            )}
            {connectionState === 'connecting' && (
              <span className="flex items-center gap-1 text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-800/40">
                <RefreshCw className="w-3 h-3 animate-spin" /> Connecting PTY...
              </span>
            )}
            {(connectionState === 'disconnected' || connectionState === 'error') && (
              <span className="flex items-center gap-1 text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-800/40">
                <AlertCircle className="w-3 h-3" /> Disconnected
              </span>
            )}
          </div>

          {/* Reconnect Button */}
          <button
            onClick={connectWebSocket}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Reconnect Terminal Session"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Toggle Fullscreen */}
          <button
            onClick={() => {
              setIsFullscreen(!isFullscreen);
              setTimeout(() => {
                fitAddonRef.current?.fit();
              }, 100);
            }}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Terminal'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={terminalRef}
        onClick={() => termInstanceRef.current?.focus()}
        style={{ height: isFullscreen ? 'calc(100% - 40px)' : height }}
        className="w-full p-2 bg-[#0B0F17] overflow-hidden cursor-text"
      />
    </div>
  );
};
