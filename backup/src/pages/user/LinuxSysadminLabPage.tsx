import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
  Terminal as TerminalIcon,
  Trophy,
  XCircle,
} from 'lucide-react';

import { RealTerminal } from '../../components/RealTerminal';
import { useAuth } from '../../context';
import {
  sysadminGradingService,
  type SysadminLabDetail,
  type SysadminLabSummary,
  type SysadminSubmission,
  type SysadminWorkspaceSession,
} from '../../services/sysadminGradingService';

const SUBMISSION_POLL_INTERVAL_MS = 2000;
const SUBMISSION_POLL_ATTEMPTS = 25;

function formatCriterionId(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimestamp(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function difficultyClasses(value: string): string {
  switch (value.toLowerCase()) {
    case 'beginner':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900';
    case 'advanced':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900';
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900';
  }
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-900 dark:text-slate-100"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

const QuestionMarkdown: React.FC<{ markdown: string }> = ({ markdown }) => {
  const lines = markdown.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let inCode = false;
  let codeLanguage = '';
  let codeLines: string[] = [];

  const flushCode = (key: string) => {
    nodes.push(
      <pre
        key={key}
        className="my-3 overflow-x-auto rounded-xl border border-slate-800 bg-[#0B0F17] p-4 text-xs leading-6 text-slate-100"
      >
        <code data-language={codeLanguage || undefined}>{codeLines.join('\n')}</code>
      </pre>,
    );
    codeLines = [];
    codeLanguage = '';
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      if (inCode) flushCode(`code-${index}`);
      else codeLanguage = fence[1].trim();
      inCode = !inCode;
      return;
    }
    if (inCode) {
      codeLines.push(rawLine);
      return;
    }
    if (!line.trim()) {
      nodes.push(<div key={`space-${index}`} className="h-2" />);
      return;
    }
    if (line.startsWith('## ')) {
      nodes.push(
        <h3 key={index} className="mt-5 mb-2 text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">
          {renderInline(line.slice(3))}
        </h3>,
      );
      return;
    }
    if (line.startsWith('# ')) {
      nodes.push(
        <h2 key={index} className="mb-3 text-lg font-black text-slate-950 dark:text-white">
          {renderInline(line.slice(2))}
        </h2>,
      );
      return;
    }
    const ordered = line.match(/^(\d+)\.\s+(.*)$/);
    if (ordered) {
      nodes.push(
        <div key={index} className="my-1.5 flex gap-2.5 text-sm leading-6 text-slate-700 dark:text-slate-300">
          <span className="min-w-5 font-bold text-blue-600 dark:text-blue-400">{ordered[1]}.</span>
          <span>{renderInline(ordered[2])}</span>
        </div>,
      );
      return;
    }
    if (line.startsWith('- ')) {
      nodes.push(
        <div key={index} className="my-1.5 flex gap-2.5 text-sm leading-6 text-slate-700 dark:text-slate-300">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
          <span>{renderInline(line.slice(2))}</span>
        </div>,
      );
      return;
    }
    nodes.push(
      <p key={index} className="text-sm leading-6 text-slate-700 dark:text-slate-300">
        {renderInline(line)}
      </p>,
    );
  });

  if (inCode && codeLines.length) flushCode('code-final');
  return <div>{nodes}</div>;
};

const ResultPanel: React.FC<{
  submission: SysadminSubmission | null;
  waitingForResult: boolean;
  onRefresh: () => void;
}> = ({ submission, waitingForResult, onRefresh }) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
            <Trophy className="h-4 w-4 text-amber-500" /> Latest Result
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">Criterion-level feedback from the trusted grader.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${waitingForResult ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {waitingForResult && (
        <div className="m-4 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Submission detected. Waiting for the grading worker to finish…
        </div>
      )}

      {!submission ? (
        <div className="px-5 py-8 text-center text-sm text-slate-500">
          No submission yet. Create your script in the terminal, then run <code className="font-mono">submit &lt;script.sh&gt;</code>.
        </div>
      ) : (
        <div className="p-5">
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Score</div>
              <div className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                {submission.score ?? '—'}/{submission.max_score ?? '—'}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Outcome</div>
              <div className={`mt-1 text-sm font-black ${submission.passed ? 'text-emerald-600' : submission.passed === false ? 'text-rose-600' : 'text-slate-500'}`}>
                {submission.passed === true ? 'PASS' : submission.passed === false ? 'FAIL' : submission.status}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pass Mark</div>
              <div className="mt-1 text-sm font-black text-slate-900 dark:text-white">{submission.pass_score ?? '—'}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Submission</div>
              <div className="mt-1 text-sm font-black text-slate-900 dark:text-white">#{submission.submission_id}</div>
            </div>
          </div>

          {submission.error && (
            <div className="mb-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {submission.error}
            </div>
          )}

          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
            {submission.tests.map((test) => (
              <div
                key={test.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800"
              >
                {test.passed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      {formatCriterionId(test.id)}
                    </span>
                    <span className={`shrink-0 text-xs font-black ${test.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {test.points}/{test.max_points}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{test.feedback}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[11px] text-slate-400">Graded {formatTimestamp(submission.graded_at || submission.submitted_at)}</div>
        </div>
      )}
    </section>
  );
};

export const LinuxSysadminLabPage: React.FC = () => {
  const navigate = useNavigate();
  const { labId } = useParams<{ labId?: string }>();
  const { apiFetch, token } = useAuth();

  const [labs, setLabs] = useState<SysadminLabSummary[]>([]);
  const [detail, setDetail] = useState<SysadminLabDetail | null>(null);
  const [submissions, setSubmissions] = useState<SysadminSubmission[]>([]);
  const [workspace, setWorkspace] = useState<SysadminWorkspaceSession | null>(null);
  const [loadingLabs, setLoadingLabs] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [waitingForResult, setWaitingForResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollGeneration = useRef(0);

  const selectedLabId = labId || labs[0]?.lab_id || '';
  const latestSubmission = submissions[0] || null;

  const refreshWorkspace = useCallback(async () => {
    try {
      const session = await sysadminGradingService.getWorkspace(apiFetch);
      setWorkspace(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to inspect workspace.');
    }
  }, [apiFetch]);

  const refreshSubmissions = useCallback(async () => {
    if (!selectedLabId) return [] as SysadminSubmission[];
    try {
      const rows = await sysadminGradingService.listSubmissions(apiFetch, selectedLabId, 10);
      setSubmissions(rows);
      return rows;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load submission history.');
      return [] as SysadminSubmission[];
    }
  }, [apiFetch, selectedLabId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingLabs(true);
      setError(null);
      try {
        const rows = await sysadminGradingService.listLabs(apiFetch);
        if (cancelled) return;
        setLabs(rows);
        if (!labId && rows.length) {
          navigate(`/labs/linux-sysadmin/${encodeURIComponent(rows[0].lab_id)}`, { replace: true });
        } else if (labId && rows.length && !rows.some((row) => row.lab_id === labId)) {
          navigate(`/labs/linux-sysadmin/${encodeURIComponent(rows[0].lab_id)}`, { replace: true });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load Linux Sysadmin questions.');
      } finally {
        if (!cancelled) setLoadingLabs(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [apiFetch, labId, navigate]);

  useEffect(() => {
    if (!selectedLabId) return;
    let cancelled = false;
    const load = async () => {
      setLoadingDetail(true);
      setError(null);
      try {
        const [question, rows, session] = await Promise.all([
          sysadminGradingService.getLab(apiFetch, selectedLabId),
          sysadminGradingService.listSubmissions(apiFetch, selectedLabId, 10),
          sysadminGradingService.getWorkspace(apiFetch),
        ]);
        if (cancelled) return;
        setDetail(question);
        setSubmissions(rows);
        setWorkspace(session);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load the selected question.');
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };
    pollGeneration.current += 1;
    setWaitingForResult(false);
    void load();
    return () => { cancelled = true; };
  }, [apiFetch, selectedLabId]);

  useEffect(() => () => { pollGeneration.current += 1; }, []);

  const startWorkspace = async () => {
    if (!selectedLabId || workspaceBusy) return;
    setWorkspaceBusy(true);
    setError(null);
    try {
      const session = await sysadminGradingService.startWorkspace(apiFetch, selectedLabId);
      setWorkspace(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start workspace.');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const stopWorkspace = async () => {
    if (workspaceBusy) return;
    setWorkspaceBusy(true);
    setError(null);
    try {
      await sysadminGradingService.stopWorkspace(apiFetch);
      setWorkspace(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to stop workspace.');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const pollForSubmission = useCallback(() => {
    if (!selectedLabId) return;
    const generation = ++pollGeneration.current;
    const previousId = submissions[0]?.submission_id ?? 0;
    setWaitingForResult(true);

    const poll = async (attempt: number) => {
      if (generation !== pollGeneration.current) return;
      const rows = await refreshSubmissions();
      if (generation !== pollGeneration.current) return;

      const newest = rows[0];
      const newAttempt = Boolean(newest && newest.submission_id > previousId);
      const finished = newAttempt && ['COMPLETED', 'ERROR'].includes(newest.status.toUpperCase());
      if (finished || attempt >= SUBMISSION_POLL_ATTEMPTS - 1) {
        setWaitingForResult(false);
        return;
      }
      window.setTimeout(() => { void poll(attempt + 1); }, SUBMISSION_POLL_INTERVAL_MS);
    };

    window.setTimeout(() => { void poll(0); }, 500);
  }, [refreshSubmissions, selectedLabId, submissions]);

  const handleTerminalCommand = useCallback((command: string) => {
    if (/^(?:sudo\s+)?submit(?:\s|$)/i.test(command.trim())) pollForSubmission();
  }, [pollForSubmission]);

  const activeForSelected = Boolean(
    workspace &&
    workspace.lab_id === selectedLabId &&
    workspace.terminal_ready &&
    workspace.status.toUpperCase() === 'RUNNING',
  );

  if (loadingLabs && !labs.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Loading Linux Sysadmin lab…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/my-labs')}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:hover:bg-slate-900 dark:hover:text-white"
              aria-label="Back to My Labs"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600" />
                <h1 className="truncate text-base font-black sm:text-lg">Linux System Administration</h1>
              </div>
              <p className="truncate text-[11px] text-slate-500">Red Hat-aligned terminal challenges with state-based autograding</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
            <TerminalIcon className="h-4 w-4 text-emerald-500" /> Terminal-only workflow
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-5 p-4 sm:p-6 xl:grid-cols-[290px_minmax(0,1fr)] xl:items-start">
        <aside className="space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:pr-1 [scrollbar-gutter:stable]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black">Challenges</h2>
                <p className="text-[11px] text-slate-500">{labs.length} question{labs.length === 1 ? '' : 's'} available</p>
              </div>
              <BookOpen className="h-4 w-4 text-blue-600" />
            </div>
            <div className="space-y-1.5">
              {labs.map((lab, index) => {
                const selected = lab.lab_id === selectedLabId;
                return (
                  <button
                    type="button"
                    key={lab.lab_id}
                    onClick={() => navigate(`/labs/linux-sysadmin/${encodeURIComponent(lab.lab_id)}`)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      selected
                        ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
                        : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-950/50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-extrabold text-slate-900 dark:text-white">{lab.title}</div>
                        <div className="mt-1 truncate font-mono text-[10px] text-slate-400">{lab.lab_id}</div>
                      </div>
                      <ChevronRight className={`mt-1 h-3.5 w-3.5 shrink-0 ${selected ? 'text-blue-600' : 'text-slate-300'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Workspace</div>
            {workspace ? (
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Question</span><span className="font-mono font-bold">{workspace.lab_id}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Status</span><span className="font-bold text-emerald-600">{workspace.status}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Expires</span><span className="text-right font-medium">{formatTimestamp(workspace.expires_at)}</span></div>
              </div>
            ) : (
              <p className="mt-2 text-xs leading-5 text-slate-500">No active student workspace. Start one when you are ready to work.</p>
            )}
          </section>
        </aside>

        <main className="min-w-0 space-y-5">
          {error && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>
              <button type="button" className="font-bold" onClick={() => setError(null)}>×</button>
            </div>
          )}

          {loadingDetail || !detail ? (
            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-blue-600">{detail.lab_id}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${difficultyClasses(detail.difficulty)}`}>{detail.difficulty}</span>
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:border-slate-700">{detail.total_points} points</span>
                    </div>
                    <h2 className="text-xl font-black text-slate-950 dark:text-white sm:text-2xl">{detail.title}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                      <span>Module: <strong className="text-slate-700 dark:text-slate-300">{detail.module}</strong></span>
                      <span>Submission: <code className="font-mono text-slate-700 dark:text-slate-300">{detail.submission_filename}</code></span>
                      <span>Pass: <strong className="text-slate-700 dark:text-slate-300">{detail.pass_score}/{detail.total_points}</strong></span>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {activeForSelected ? (
                      <button
                        type="button"
                        disabled={workspaceBusy}
                        onClick={stopWorkspace}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
                      >
                        {workspaceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                        End Workspace
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={workspaceBusy}
                        onClick={startWorkspace}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                      >
                        {workspaceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        {workspaceBusy ? 'Starting…' : workspace ? 'Switch Workspace' : 'Start Workspace'}
                      </button>
                    )}
                  </div>
                </div>

                {workspace && workspace.lab_id !== selectedLabId && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    Your active workspace is scoped to <strong>{workspace.lab_id}</strong>. Starting this question will safely stop that task and provision a new scoped workspace.
                  </div>
                )}

                {detail.learning_objectives.length > 0 && (
                  <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {detail.learning_objectives.map((objective) => (
                      <div key={objective} className="flex gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600 dark:bg-slate-950/50 dark:text-slate-300">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                        {objective}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.55fr)] xl:items-start">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:max-h-[58vh] xl:overflow-y-auto xl:pr-4 2xl:max-h-[600px] [scrollbar-gutter:stable]">
                  <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    <h2 className="text-sm font-black">Challenge Instructions</h2>
                  </div>
                  <QuestionMarkdown markdown={detail.question_markdown} />

                  <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
                    <div className="flex items-center gap-2 text-xs font-black text-blue-800 dark:text-blue-300">
                      <TerminalIcon className="h-4 w-4" /> Terminal submission
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-blue-700 dark:text-blue-300/90">
                      When ready, run <code className="font-mono font-bold">submit {detail.submission_filename}</code>. The browser never uploads your script directly.
                    </p>
                  </div>
                </section>

                <section className="min-w-0">
                  {activeForSelected ? (
                    <RealTerminal
                      key={workspace?.workspace_id}
                      token={token || undefined}
                      labId={selectedLabId}
                      wsPath={`/api/v1/sysadmin-grading/workspaces/terminal?lab_id=${encodeURIComponent(selectedLabId)}`}
                      terminalTitle={`RHSA — ${detail.title}`}
                      height="clamp(420px, 58vh, 600px)"
                      onCommand={handleTerminalCommand}
                    />
                  ) : (
                    <div className="flex min-h-[440px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                        <TerminalIcon className="h-7 w-7 text-slate-500" />
                      </div>
                      <h3 className="text-base font-black">Terminal workspace is not running</h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                        Start a disposable Linux workspace scoped to {detail.lab_id}. Your Bash work happens there; grading runs separately on trusted infrastructure.
                      </p>
                      <button
                        type="button"
                        disabled={workspaceBusy}
                        onClick={startWorkspace}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
                      >
                        {workspaceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        {workspaceBusy ? 'Provisioning workspace…' : 'Start Workspace'}
                      </button>
                      <div className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Clock3 className="h-3.5 w-3.5" /> Workspace automatically expires with its scoped submission credential.
                      </div>
                    </div>
                  )}
                </section>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)] xl:items-start">
                <ResultPanel
                  submission={latestSubmission}
                  waitingForResult={waitingForResult}
                  onRefresh={() => { void refreshSubmissions(); void refreshWorkspace(); }}
                />

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Rubric</div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    {detail.rubric.map((criterion) => (
                      <div key={criterion.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-xs dark:border-slate-800">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{formatCriterionId(criterion.id)}</span>
                        <span className="font-black text-blue-600">{criterion.points} pts</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};
