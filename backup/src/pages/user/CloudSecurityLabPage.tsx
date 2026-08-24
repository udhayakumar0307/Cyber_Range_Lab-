import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { AWSCredentials, CloudLevelInfo, AWSLevelCheckResponse } from '../../types/cloud';

const CLOUD_LEVELS: CloudLevelInfo[] = [
  {
    level: 0,
    title: 'The Leaked Public Asset',
    difficulty: 'Beginner',
    points: 100,
    shortDesc: 'S3 Public Reconnaissance & Policy Hardening',
    objective:
      'A rogue contractor left a storage bucket publicly accessible. Enumerate public S3 buckets anonymously, retrieve unencrypted audit logs, and reconfigure S3 Block Public Access & Bucket Policies.',
    remediationHint:
      'Use AWS CLI or S3 console to enable all 4 Block Public Access flags and remove wildcard `Principal: "*"` from the bucket policy.',
    awsServices: ['S3', 'IAM'],
  },
  {
    level: 1,
    title: 'The Shadow Developer',
    difficulty: 'Intermediate',
    points: 150,
    shortDesc: 'IAM Inline Policy Audit & Role Delegation',
    objective:
      'Investigate developer account permissions. Locate an overly permissive IAM role allowing `sts:AssumeRole` without external ID verification, assume the DevOps role, and fix the trust policy.',
    remediationHint:
      'Edit `CloudCorpDevOpsRole` AssumeRolePolicyDocument to require an `sts:ExternalId` condition.',
    awsServices: ['IAM', 'STS'],
  },
  {
    level: 2,
    title: 'The Compromised Workload',
    difficulty: 'Intermediate',
    points: 200,
    shortDesc: 'EC2 SSRF & IMDSv2 Hardening',
    objective:
      'A web application on an EC2 instance suffers from SSRF. Exploit the SSRF to query legacy IMDSv1 (`169.254.169.254`), then harden the EC2 instance by enforcing IMDSv2 (`HttpTokens: required`).',
    remediationHint:
      'Execute `aws ec2 modify-instance-metadata-options --instance-id <id> --http-tokens required --http-endpoint enabled`.',
    awsServices: ['EC2', 'VPC', 'IAM'],
  },
  {
    level: 3,
    title: 'Serverless Exfiltration',
    difficulty: 'Advanced',
    points: 250,
    shortDesc: 'Lambda, SSM & Secrets Manager Hardening',
    objective:
      'Analyze a serverless Lambda order processor leaking environment variables. Retrieve master DB passwords from AWS Secrets Manager and KMS re-encrypt the secret using a Customer-Managed Key (CMK).',
    remediationHint:
      'Rotate the secret in Secrets Manager and update its encryption key to a Customer-Managed KMS CMK.',
    awsServices: ['Lambda', 'Secrets Manager', 'KMS', 'SSM'],
  },
  {
    level: 4,
    title: 'Threat Hunter in CloudTrail',
    difficulty: 'Advanced',
    points: 300,
    shortDesc: 'Forensic Log Analysis & Key Revocation',
    objective:
      'Investigate CloudTrail event logs to trace unauthorized user creation overnight. Identify the compromised developer access key, deactivate the key, and delete the backdoor IAM user.',
    remediationHint:
      'Run `aws iam update-access-key --status Inactive` and delete the `backdoor_admin` IAM user.',
    awsServices: ['CloudTrail', 'CloudWatch', 'IAM'],
  },
  {
    level: 5,
    title: 'Capstone: Account Governance',
    difficulty: 'Expert',
    points: 500,
    shortDesc: 'CloudCorp Defense & Preventative SCP Guardrails',
    objective:
      'Perform a final platform compliance audit for CloudCorp CISO. Attach an account governance boundary enforcing region `ap-south-1` and complete the master Cloud Security certification.',
    remediationHint:
      'Deploy the master capstone boundary policy enforcing regional compliance and pass the Boto3 compliance audit.',
    awsServices: ['Organizations', 'IAM Boundaries', 'AWS Config'],
  },
];

interface TerminalLine {
  type: 'cmd' | 'out' | 'err' | 'info';
  text: string;
}

export const CloudSecurityLabPage: React.FC = () => {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();

  const [activeLevel, setActiveLevel] = useState<number>(0);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [completedLevels, setCompletedLevels] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // AWS Credentials & Console State
  const [credentials, setCredentials] = useState<AWSCredentials | null>(null);
  const [consoleUrl, setConsoleUrl] = useState<string>('');
  const [launchingSession, setLaunchingSession] = useState<boolean>(false);

  // Verification & Feedback State
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<AWSLevelCheckResponse | null>(null);

  // Terminal State
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [termCmd, setTermCmd] = useState<string>('');
  const [termBusy, setTermBusy] = useState<boolean>(false);
  const termScreenRef = useRef<HTMLDivElement>(null);

  // Congratulatory Modal
  const [completionModal, setCompletionModal] = useState<{
    show: boolean;
    level: number;
    title: string;
    points: number;
    totalScore: number;
    isLastLevel: boolean;
  } | null>(null);

  const initSession = useCallback(async (levelNum: number) => {
    setLaunchingSession(true);
    try {
      const res = await apiFetch('/api/v1/cloud/aws/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: levelNum }),
      });
      if (res.ok) {
        const data = await res.json();
        setCredentials(data.credentials || null);
        setConsoleUrl(data.console_url || '');
      }
    } catch (err) {
      console.error('Failed to launch AWS session:', err);
    } finally {
      setLaunchingSession(false);
    }
  }, [apiFetch]);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/cloud/status');
      if (res.ok) {
        const data = await res.json();
        setTotalScore(data.total_points ?? 0);
        const solved: Record<number, boolean> = {};
        if (data.solved) {
          Object.keys(data.solved).forEach((key) => {
            const num = parseInt(key.replace('mod', ''), 10) - 1;
            if (!isNaN(num)) solved[num] = true;
          });
        }
        setCompletedLevels(solved);
      }

      // Fetch active AWS credentials
      const credsRes = await apiFetch('/api/v1/cloud/aws/credentials');
      if (credsRes.ok) {
        const credsData = await credsRes.json();
        setCredentials(credsData.credentials || null);
        setConsoleUrl(credsData.console_url || '');
      }
    } catch (err) {
      console.error('Failed to load status:', err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (termScreenRef.current) {
      termScreenRef.current.scrollTop = termScreenRef.current.scrollHeight;
    }
  }, [terminalLines]);

  const handleLevelSelect = (lvl: number) => {
    setActiveLevel(lvl);
    setVerificationResult(null);
    initSession(lvl);
  };

  const handleVerifyLevel = async () => {
    setVerifying(true);
    setVerificationResult(null);
    try {
      const res = await apiFetch('/api/v1/cloud/aws/check-level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: activeLevel }),
      });
      if (res.ok) {
        const data: AWSLevelCheckResponse = await res.json();
        setVerificationResult(data);
        if (data.passed) {
          setCompletedLevels((prev) => ({ ...prev, [activeLevel]: true }));
          setTotalScore(data.total_score);

          setCompletionModal({
            show: true,
            level: activeLevel,
            title: CLOUD_LEVELS[activeLevel].title,
            points: data.points_awarded,
            totalScore: data.total_score,
            isLastLevel: activeLevel === CLOUD_LEVELS.length - 1,
          });

          if (activeLevel < CLOUD_LEVELS.length - 1) {
            setActiveLevel(activeLevel + 1);
            initSession(activeLevel + 1);
          }
        }
      }
    } catch (err) {
      console.error('Level verification failed:', err);
      setVerificationResult({
        status: 'incorrect',
        passed: false,
        feedback: 'Verification request failed. Please check network connectivity.',
        level: activeLevel,
        next_level: activeLevel,
        points_awarded: 0,
        total_score: totalScore,
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termCmd.trim() || termBusy) return;

    const cmd = termCmd.trim();
    setTermCmd('');
    setTerminalLines((prev) => [...prev, { type: 'cmd', text: `$ ${cmd}` }]);
    setTermBusy(true);

    try {
      const res = await apiFetch('/api/v1/cloud/terminal/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, module: activeLevel + 1 }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.output) {
          setTerminalLines((prev) => [...prev, { type: 'out', text: data.output }]);
        }
      } else {
        setTerminalLines((prev) => [...prev, { type: 'err', text: 'Execution error.' }]);
      }
    } catch (err) {
      setTerminalLines((prev) => [...prev, { type: 'err', text: `Error: ${err}` }]);
    } finally {
      setTermBusy(false);
    }
  };

  const currentModule = CLOUD_LEVELS[activeLevel];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mb-4 text-4xl animate-spin">⚡</div>
          <p className="text-lg font-semibold text-slate-300">Initializing CloudCorp AWS Sandbox...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/labs')}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
            >
              ← Back to Catalog
            </button>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>☁️</span> CloudCorp AWS Security Odyssey
            </h1>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-right">
              <div className="text-xs text-slate-400">Total User Score</div>
              <div className="text-lg font-bold text-emerald-400">+{totalScore} XP</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Quest Map Navigation */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Quest Level Progression
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {CLOUD_LEVELS.map((lvl) => {
              const isSolved = completedLevels[lvl.level];
              const isActive = activeLevel === lvl.level;

              return (
                <button
                  key={lvl.level}
                  onClick={() => handleLevelSelect(lvl.level)}
                  className={`relative flex flex-col items-start p-3 rounded-lg border text-left transition ${
                    isActive
                      ? 'border-blue-500 bg-blue-950/40 shadow-lg shadow-blue-900/20'
                      : isSolved
                      ? 'border-emerald-500/50 bg-emerald-950/20 hover:border-emerald-400'
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex w-full items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-400">LEVEL {lvl.level}</span>
                    {isSolved ? (
                      <span className="text-emerald-400 text-sm">✓</span>
                    ) : (
                      <span className="text-xs text-amber-400 font-semibold">+{lvl.points} XP</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-white line-clamp-1">{lvl.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{lvl.difficulty}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* AWS Credentials & Console Banner */}
        <section className="rounded-xl border border-blue-900/40 bg-gradient-to-r from-blue-950/30 to-slate-900 p-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">
                <span>🔐</span> Active Temporary AWS STS Session
              </div>
              <p className="text-sm text-slate-300">
                Connected to AWS Sandbox Region <code className="text-amber-300 font-mono">ap-south-1</code> (Mumbai).
              </p>
              {credentials && (
                <div className="mt-3 flex flex-wrap gap-4 font-mono text-xs text-slate-300">
                  <div>
                    <span className="text-slate-500">Access Key: </span>
                    <span className="text-emerald-400 font-semibold">{credentials.AccessKeyId}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">TTL: </span>
                    <span className="text-amber-400 font-semibold">2 Hours Ephemeral</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {consoleUrl && (
                <a
                  href={consoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-900/30 transition"
                >
                  <span>🚀</span> Open AWS Management Console
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Level Briefing & Boto3 Verification */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                    LEVEL {currentModule.level} BRIEFING
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">{currentModule.title}</h3>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 border border-slate-700">
                  {currentModule.difficulty}
                </span>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Scenario Objective
                </h4>
                <p className="text-sm leading-relaxed text-slate-300">{currentModule.objective}</p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Target AWS Services
                </h4>
                <div className="flex flex-wrap gap-2">
                  {currentModule.awsServices.map((svc) => (
                    <span
                      key={svc}
                      className="rounded bg-blue-950/60 border border-blue-800/50 px-2 py-0.5 text-xs font-medium text-blue-300"
                    >
                      {svc}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-amber-900/30 bg-amber-950/20 p-3 text-xs text-amber-300">
                <span className="font-bold">💡 Remediation Hint: </span>
                {currentModule.remediationHint}
              </div>

              {/* Real-time Boto3 Verification Action */}
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <button
                  onClick={handleVerifyLevel}
                  disabled={verifying || launchingSession}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition shadow-md shadow-emerald-900/30 flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <>
                      <span className="animate-spin">⚡</span> Inspecting Real AWS API State...
                    </>
                  ) : (
                    <>
                      <span>🔍</span> Verify Level {currentModule.level} Fix
                    </>
                  )}
                </button>

                {verificationResult && (
                  <div
                    className={`rounded-lg border p-3 text-xs font-mono leading-relaxed ${
                      verificationResult.passed
                        ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
                        : 'border-rose-800 bg-rose-950/40 text-rose-300'
                    }`}
                  >
                    <div className="font-bold mb-1">
                      {verificationResult.passed ? '✓ VERIFICATION PASSED' : '✗ VERIFICATION FAILED'}
                    </div>
                    {verificationResult.feedback}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: In-Browser AWS CLI Web Terminal */}
          <div className="lg:col-span-7 flex flex-col rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between bg-slate-900 border-b border-slate-800 px-4 py-2.5">
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 rounded-full bg-rose-500"></div>
                <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                <span className="ml-2 text-xs font-mono font-medium text-slate-400">
                  cloudcorp-aws-terminal ~ (bash)
                </span>
              </div>
              <span className="text-xs text-slate-500 font-mono">aws-cli v2.15.0</span>
            </div>

            <div
              ref={termScreenRef}
              className="flex-1 bg-slate-950 p-4 font-mono text-xs leading-relaxed overflow-y-auto min-h-[380px] max-h-[500px]"
            >
              <div className="text-slate-500 mb-3">
                Welcome to CloudCorp AWS Terminal. Temporary STS credentials loaded for region ap-south-1.
                <br />
                Type `aws s3 ls`, `aws sts get-caller-identity`, or `check_aws_level {activeLevel}`.
              </div>

              {terminalLines.map((line, idx) => (
                <div key={idx} className="whitespace-pre-wrap">
                  {line.type === 'cmd' && <span className="text-emerald-400 font-semibold">{line.text}</span>}
                  {line.type === 'out' && <span className="text-slate-300">{line.text}</span>}
                  {line.type === 'err' && <span className="text-rose-400">{line.text}</span>}
                </div>
              ))}
            </div>

            <form onSubmit={handleTerminalSubmit} className="border-t border-slate-800 bg-slate-900 p-2 flex gap-2">
              <input
                type="text"
                value={termCmd}
                onChange={(e) => setTermCmd(e.target.value)}
                placeholder="Type AWS CLI command..."
                className="flex-1 rounded bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={termBusy}
                className="rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition"
              >
                Run
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Completion Modal */}
      {completionModal && completionModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-slate-900 p-6 text-center shadow-2xl">
            <div className="text-5xl mb-3">🏆</div>
            <h3 className="text-2xl font-bold text-white">Level Solved!</h3>
            <p className="text-sm text-slate-300 mt-2">
              You successfully verified <span className="text-emerald-400 font-semibold">{completionModal.title}</span>.
            </p>
            <div className="my-4 rounded-xl border border-emerald-900/50 bg-emerald-950/30 p-3 text-emerald-300 font-bold">
              +{completionModal.points} XP Awarded
            </div>
            <button
              onClick={() => setCompletionModal(null)}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 transition"
            >
              Continue to Next Level
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
