import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context';
import { 
  Clock, 
  CheckCircle2, 
  ArrowLeft, 
  RefreshCw, 
  ShieldCheck,
  AlertTriangle,
  Zap,
  Lock,
  LogOut
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Objective {
  label: string;
  /** Terminal command patterns that complete this objective */
  triggerPatterns: RegExp[];
}

interface ReconModule {
  id: string;
  title: string;
  points: number;
  /** Description shown in left panel */
  description: string;
  /** Mission paragraph */
  mission: string;
  objectives: Objective[];
  hints: string[];
  /** Populated from backend after completing the module */
  correctFlag?: string;
}

// ── Module definitions ─────────────────────────────────────────────────────

const SIMULOT_MODULES: ReconModule[] = [
  {
    id: 'module1',
    title: 'Module 1: OT Network & Protocol Reconnaissance',
    points: 150,
    description: 'Map active industrial control system (ICS) endpoints using Modbus TCP, MQTT, and OPC UA decoders.',
    mission: 'Scan OT network traffic, discover active PLC registers, and identify listening telemetry ports across the water treatment plant.',
    objectives: [
      { label: 'Map active Modbus TCP and MQTT ICS telemetry endpoints.', triggerPatterns: [/nmap\b/i, /scan/i, /modbus/i] },
      { label: 'Identify PLC registers, HMI telemetry ports, and sensor parameters.', triggerPatterns: [/nmap -sV/i, /plc/i, /sensor/i] },
      { label: 'Retrieve the Module 1 verification flag from the OT network directory.', triggerPatterns: [/cat/i, /notes/i, /flag/i] },
    ],
    hints: [
      'Use `nmap -sV 10.10.0.10` or Modbus decoder tools to map OT ports.',
      'Check HMI telemetry notes for active PLC register hints.',
    ],
  },
  {
    id: 'module2',
    title: 'Module 2: PLC Register & Process Manipulation',
    points: 200,
    description: 'Analyze setpoint changes on chemical dosing and tank level PLCs.',
    mission: 'Inspect Modbus Function Code 06/16 payload anomalies and detect unauthorized setpoint modifications altering water treatment plant physics.',
    objectives: [
      { label: 'Analyze setpoint changes on chemical dosing and tank level PLCs.', triggerPatterns: [/modbus/i, /plc/i, /register/i] },
      { label: 'Inspect Modbus Function Code 06/16 payload anomalies.', triggerPatterns: [/nmap -sV/i, /write/i, /setpoint/i] },
      { label: 'Submit the Module 2 fingerprint flag revealed in the register scan.', triggerPatterns: [/cat/i, /flag/i] },
    ],
    hints: [
      'Inspect Modbus Function Code 06/16 write logs to identify unauthorized setpoint changes.',
      'Check chemical dosing pump register values.',
    ],
  },
  {
    id: 'module3',
    title: 'Module 3: Modbus & S7comm Traffic PCAP Analysis',
    points: 200,
    description: 'Inspect industrial PCAP packet captures using the packet analyzer.',
    mission: 'Filter S7comm, DNP3, and Modbus TCP conversations to extract Indicator of Compromise (IOC) timelines and identify payload injections.',
    objectives: [
      { label: 'Inspect industrial PCAP packet captures using the SimulOT packet analyzer.', triggerPatterns: [/pcap/i, /tcpdump/i, /wireshark/i] },
      { label: 'Filter S7comm, DNP3, and Modbus TCP conversations to extract IOC timelines.', triggerPatterns: [/filter/i, /modbus/i, /s7/i] },
      { label: 'Retrieve the Module 3 PCAP analysis flag from the conversation tracker.', triggerPatterns: [/cat/i, /pcap/i, /flag/i] },
    ],
    hints: [
      'Filter packet captures for Modbus TCP Function 16 or S7comm write requests.',
      'Review IOC timeline correlation logs.',
    ],
  },
  {
    id: 'module4',
    title: 'Module 4: OT Incident Response & HMI Mitigation',
    points: 200,
    description: 'Review HMI alarm logs and historian process curves during process runaway attacks.',
    mission: 'Execute recovery workflows to reset actuator states and restore normal water treatment operating parameters.',
    objectives: [
      { label: 'Review HMI alarm logs and historian process curves during an active process runaway attack.', triggerPatterns: [/alarm/i, /hmi/i, /status/i] },
      { label: 'Execute recovery workflows to reset actuator states.', triggerPatterns: [/reset/i, /recover/i, /sys-helper/i] },
      { label: 'Submit the Module 4 incident response flag.', triggerPatterns: [/cat/i, /flag/i] },
    ],
    hints: [
      'Audit HMI process curves for chemical dosing overruns.',
      'Execute actuator reset command to restore baseline operating parameters.',
    ],
  },
  {
    id: 'module5',
    title: 'Module 5: Full Industrial Network Infiltration (Capstone)',
    points: 250,
    description: 'Perform end-to-end investigation of multi-vector SCADA network compromise across Engineering Workstations.',
    mission: 'Mitigate malicious control commands, secure industrial gateway communications, and extract the final capstone flag.',
    objectives: [
      { label: 'Inspect SUID administrative permissions across Engineering Workstations.', triggerPatterns: [/sudo -l/i, /ls/i] },
      { label: 'Exploit and secure industrial gateway helper utilities.', triggerPatterns: [/sys-helper/i, /exec/i] },
      { label: 'Read /root/flag.txt to capture the final capstone flag.', triggerPatterns: [/cat.*flag/i] },
    ],
    hints: [
      'Perform root privilege escalation via sys-helper utility.',
      'Read `/root/flag.txt` to capture the final capstone flag.',
    ],
  },
];

const RAILROAD_MODULES: ReconModule[] = [
  {
    id: 'module1',
    title: 'Module 1: Railroad Master PLC & Modbus Reconnaissance',
    points: 150,
    description: 'Scan Master PLC IP and slave segment controllers across railroad track switches.',
    mission: 'Read Master PLC registers and slave configuration files to discover active track signaling nodes.',
    objectives: [
      { label: 'Scan Master PLC IP and slave segment controllers.', triggerPatterns: [/nmap\b/i, /scan/i] },
      { label: 'Read Master PLC registers and slave configuration files.', triggerPatterns: [/cat/i, /config/i, /plc/i] },
      { label: 'Retrieve Module 1 Railroad flag.', triggerPatterns: [/cat/i, /flag/i] },
    ],
    hints: ['Scan segment 1-3 slave PLCs using Modbus scanning scripts.', 'Inspect slave_config.json for IP addresses.'],
  },
  {
    id: 'module2',
    title: 'Module 2: Train Signal & Switch Manipulation',
    points: 200,
    description: 'Inspect track switch coil registers and train speed setpoints.',
    mission: 'Detect unauthorized switch position toggles and identify malicious Modbus register writes.',
    objectives: [
      { label: 'Inspect track switch coil registers and speed setpoints.', triggerPatterns: [/read/i, /coil/i, /speed/i] },
      { label: 'Detect unauthorized switch position toggles.', triggerPatterns: [/write/i, /switch/i] },
      { label: 'Submit Module 2 Railroad flag.', triggerPatterns: [/cat/i, /flag/i] },
    ],
    hints: ['Check coil status for switch position registers.', 'Audit Modbus attack logs in student environment.'],
  },
  {
    id: 'module3',
    title: 'Module 3: Logstash & Syslog Telemetry Forensics',
    points: 200,
    description: 'Query Logstash syslog collector logs for SCADA events.',
    mission: 'Correlate train position alerts with Logstash syslog events and identify rogue master injection frames.',
    objectives: [
      { label: 'Query Logstash syslog collector logs for SCADA events.', triggerPatterns: [/logstash/i, /syslog/i, /grep/i] },
      { label: 'Correlate train position alerts with syslog events.', triggerPatterns: [/alert/i, /train/i] },
      { label: 'Submit Module 3 Railroad flag.', triggerPatterns: [/cat/i, /flag/i] },
    ],
    hints: ['Inspect logstash.conf and syslog collector scripts.', 'Search for anomalous source IP addresses in syslog entries.'],
  },
  {
    id: 'module4',
    title: 'Module 4: Zeek Rule Audit & Traffic Detection',
    points: 200,
    description: 'Audit Zeek IDS signatures for malicious Modbus command injection.',
    mission: 'Review zeek-rules.sig and detect unauthorized function code execution across train control networks.',
    objectives: [
      { label: 'Inspect Zeek IDS signatures and Modbus signature rules.', triggerPatterns: [/zeek/i, /cat/i, /sig/i] },
      { label: 'Identify rogue master injection frames.', triggerPatterns: [/nmap/i, /inject/i] },
      { label: 'Submit Module 4 Railroad flag.', triggerPatterns: [/cat/i, /flag/i] },
    ],
    hints: ['Check zeek-rules.sig for Modbus payload match rules.', 'Identify non-master IPs sending Function Code 06 writes.'],
  },
  {
    id: 'module5',
    title: 'Module 5: Railroad Network Infiltration (Capstone)',
    points: 250,
    description: 'Execute complete forensics and mitigate active train control exploits.',
    mission: 'Perform end-to-end investigation, secure SCADA master communication, and submit the final Railroad Capstone flag.',
    objectives: [
      { label: 'Perform end-to-end train control forensic investigation.', triggerPatterns: [/sudo -l/i, /ls/i] },
      { label: 'Mitigate active switch exploits and restore signaling telemetry.', triggerPatterns: [/sys-helper/i, /reset/i] },
      { label: 'Extract and submit final Railroad Capstone flag.', triggerPatterns: [/cat.*flag/i] },
    ],
    hints: ['Escalate privileges to audit root system configs.', 'Read /root/flag.txt for the capstone flag.'],
  },
];

const WATER_MODULES: ReconModule[] = [
  {
    id: 'module1',
    title: 'Module 1: Water Plant Modbus Coil Scanning',
    points: 150,
    description: 'Scan Modbus coils and registers across water filtration PLCs.',
    mission: 'Map intake pump and valve register addresses across the water treatment plant network.',
    objectives: [
      { label: 'Scan Modbus coils across water filtration PLCs.', triggerPatterns: [/scan/i, /modbus/i, /coil/i] },
      { label: 'Map intake pump and valve register addresses.', triggerPatterns: [/read/i, /register/i, /valve/i] },
      { label: 'Retrieve Module 1 Water Treatment flag.', triggerPatterns: [/cat/i, /flag/i] },
    ],
    hints: ['Run `scan_modbus.py` or `read_coils.py` scripts.', 'Check intake valve coil states.'],
  },
  {
    id: 'module2',
    title: 'Module 2: Chemical Dosing Setpoint Inspection',
    points: 200,
    description: 'Inspect chemical dosing pump flow rates and setpoints.',
    mission: 'Identify anomalous pH and chlorine dosing setpoint modifications.',
    objectives: [
      { label: 'Inspect chemical dosing pump flow rates and setpoints.', triggerPatterns: [/read/i, /dosing/i, /ph/i] },
      { label: 'Identify pH and chlorine dosing setpoint anomalies.', triggerPatterns: [/check/i, /chlorine/i] },
      { label: 'Submit Module 2 Water Treatment flag.', triggerPatterns: [/cat/i, /flag/i] },
    ],
    hints: ['Execute `read_registers.py` to audit dosing pump setpoints.', 'Normal pH range is 6.5 - 8.5.'],
  },
  {
    id: 'module3',
    title: 'Module 3: SCADA HMI Telemetry & Alarm Analysis',
    points: 200,
    description: 'Audit SCADA HMI web dashboard metrics and active process alarms.',
    mission: 'Analyze tank water level sensor telemetry and detect false HMI data spoofing.',
    objectives: [
      { label: 'Audit SCADA HMI dashboard metrics and active process alarms.', triggerPatterns: [/hmi/i, /alarm/i, /curl/i] },
      { label: 'Analyze tank water level sensor telemetry.', triggerPatterns: [/tank/i, /level/i, /sensor/i] },
      { label: 'Submit Module 3 Water Treatment flag.', triggerPatterns: [/cat/i, /flag/i] },
    ],
    hints: ['Access the SCADA HMI web interface.', 'Compare raw PLC sensor values with HMI displayed metrics.'],
  },
  {
    id: 'module4',
    title: 'Module 4: PLC Register Manipulation Defense',
    points: 200,
    description: 'Remediate unauthorized register writes and reset dosing coils.',
    mission: 'Restore dosing pump coils to safe baseline values and secure Modbus gateway access.',
    objectives: [
      { label: 'Remediate unauthorized register writes.', triggerPatterns: [/write/i, /reset/i, /fix/i] },
      { label: 'Reset dosing coils to safe baseline values.', triggerPatterns: [/coil/i, /baseline/i] },
      { label: 'Submit Module 4 Water Treatment flag.', triggerPatterns: [/cat/i, /flag/i] },
    ],
    hints: ['Write baseline setpoint values back to PLC registers.', 'Verify dosing pump flow rates return to normal.'],
  },
  {
    id: 'module5',
    title: 'Module 5: Facility Network Defense (Capstone)',
    points: 250,
    description: 'Conduct complete forensic audit and secure water treatment telemetry.',
    mission: 'Perform end-to-end investigation, secure SCADA gateway, and submit final Capstone flag.',
    objectives: [
      { label: 'Conduct complete forensic investigation of water plant network compromise.', triggerPatterns: [/sudo -l/i, /ls/i] },
      { label: 'Secure SCADA gateway and PLC communications.', triggerPatterns: [/sys-helper/i, /exec/i] },
      { label: 'Extract and submit final Water Plant Capstone flag.', triggerPatterns: [/cat.*flag/i] },
    ],
    hints: ['Audit root system logs and binary utilities.', 'Read /root/flag.txt for the capstone flag.'],
  },
];

const RECON_MODULES: ReconModule[] = [
  {
    id: 'module1',
    title: 'Module 1: Port Discovery & Enumeration',
    points: 100,
    description: 'The target machine is online at IP address 10.10.0.10 (or 10.10.12.5). Map out all active listening ports and locate developer notes.',
    mission: 'The target machine is online at IP address 10.10.0.10 (or 10.10.12.5). Map out all active listening ports and locate developer notes.',
    objectives: [
      {
        label: "Run an Nmap scan on target: `nmap 10.10.0.10`",
        triggerPatterns: [/^nmap\b/i],
      },
      {
        label: "Identify active open service ports (21/FTP, 22/SSH, 80/HTTP, 8080/HTTP).",
        triggerPatterns: [/^nmap\b/i, /nmap -sV/i],
      },
      {
        label: "Read `recon_notes.txt` to retrieve the Module 1 flag.",
        triggerPatterns: [/cat recon_notes\.txt/i, /cat \.\/recon_notes\.txt/i],
      },
    ],
    hints: [
      "Use `nmap 10.10.0.10` in your terminal to map ports.",
      "Type `cat recon_notes.txt` to inspect notes left in your folder.",
    ],
  },
  {
    id: 'module2',
    title: 'Module 2: Service Version Fingerprinting',
    points: 150,
    description: 'Fingerprint service banners and identify running software versions across open target ports.',
    mission: 'Run `nmap -sV` to inspect service version strings, then read the version banner flags revealed in the scan.',
    objectives: [
      {
        label: "Run `nmap -sV 10.10.0.10` to inspect detailed service version strings.",
        triggerPatterns: [/nmap -sV/i, /nmap.*-sV/i],
      },
      {
        label: "Check service banners on ports 21 (FTP) and 80 (Apache).",
        triggerPatterns: [/nmap -sV/i],
      },
      {
        label: "Submit the fingerprinting flag shown in the scan output.",
        triggerPatterns: [/nmap -sV/i],
      },
    ],
    hints: [
      "Run `nmap -sV 10.10.0.10` to trigger version detection.",
      "Version banners reveal the flag inside the scan output lines.",
    ],
  },
  {
    id: 'module3',
    title: 'Module 3: Hidden Service Discovery',
    points: 200,
    description: 'Locate hidden administration endpoints and unlisted HTTP paths hosted on port 8080.',
    mission: 'Inspect HTTP proxy/admin service on port 8080 and discover the hidden administrative endpoint flag.',
    objectives: [
      {
        label: "Inspect HTTP proxy/admin service running on port 8080.",
        triggerPatterns: [/nmap.*8080/i, /nmap -sV/i, /cat recon_notes\.txt/i],
      },
      {
        label: "Discover unlisted administrative endpoint `/admin-secret`.",
        triggerPatterns: [/nmap -sV/i, /curl.*8080/i],
      },
      {
        label: "Retrieve the hidden service discovery flag.",
        triggerPatterns: [/nmap -sV/i],
      },
    ],
    hints: [
      "Scan port 8080 or type `cat recon_notes.txt` to find administrative routes.",
      "The unlisted proxy header contains the hidden service flag.",
    ],
  },
  {
    id: 'module4',
    title: 'Module 4: Credential Discovery',
    points: 250,
    description: 'Locate exposed credentials and audit misconfigured administration utilities across the file system.',
    mission: 'Audit local administrative binary utilities in your PATH. Run system helper checks to inspect configuration logs and extract the credential discovery flag.',
    objectives: [
      {
        label: "Audit local administrative binary utilities in your PATH.",
        triggerPatterns: [/sudo -l/i, /ls/i],
      },
      {
        label: "Run system helper checks to inspect configuration logs.",
        triggerPatterns: [/sys-helper --status/i],
      },
      {
        label: "Extract the credential discovery flag.",
        triggerPatterns: [/sys-helper --status/i],
      },
    ],
    hints: [
      "Run `sys-helper --status` or inspect environment notes.",
      "Admin utility status log contains the credential discovery flag.",
    ],
  },
  {
    id: 'module5',
    title: 'Module 5: Full Network Infiltration (Capstone)',
    points: 300,
    description: 'Synthesize all recon findings, exploit misconfigured SUID binaries, and gain root shell access on the target system.',
    mission: 'Inspect SUID permissions, escalate to root via sys-helper, then read /root/flag.txt to capture the final capstone flag.',
    objectives: [
      {
        label: "Inspect SUID permissions using `sudo -l`.",
        triggerPatterns: [/sudo -l/i],
      },
      {
        label: "Exploit `/usr/bin/sys-helper` to escalate to root.",
        triggerPatterns: [/sys-helper --exec/i],
      },
      {
        label: "Read `/root/flag.txt` to capture the final capstone flag.",
        triggerPatterns: [/cat \/root\/flag\.txt/i, /cat flag\.txt/i],
      },
    ],
    hints: [
      "Run `sys-helper --exec \"/bin/sh\"` to trigger a privilege escalation.",
      "Read the flag: `cat /root/flag.txt` once you escalate to root.",
    ],
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export const ChallengeSession: React.FC = () => {
  const navigate = useNavigate();
  const { user, apiFetch } = useAuth();
  const { labId } = useParams<{ labId?: string }>();

  const isReconLab = labId === 'lab1-recon' || labId === 'recon-lab';

  const currentModules = labId === 'ot-security-lab'
    ? SIMULOT_MODULES
    : labId === 'ot-railroad-north'
    ? RAILROAD_MODULES
    : labId === 'ot-water-treatment'
    ? WATER_MODULES
    : RECON_MODULES;

  const labTitle = labId === 'ot-security-lab'
    ? 'OT & ICS Security Simulator Track'
    : labId === 'ot-railroad-north'
    ? 'OT Railroad Signaling & Control Track'
    : labId === 'ot-water-treatment'
    ? 'OT Water Treatment Facility Track'
    : isReconLab
    ? 'Network Reconnaissance Track'
    : 'CyberRange Interactive Lab Session';

  const handleReturn = () => {
    navigate(user?.role === 'admin' ? '/admin/labs' : '/labs');
  };

  // ── Session state ────────────────────────────────────────────────────────
  // OT labs: 90 min (5400s), Recon: 3 hrs (10800s)
  const isOTLabSession = labId === 'ot-water-treatment' || labId === 'ot-railroad-north' || labId === 'ot-security-lab';
  const [timeRemaining, setTimeRemaining] = useState(isOTLabSession ? 5400 : 10800);
  const [score, setScore] = useState(0);

  // Per-module solve state (from backend)
  const [solvedModules, setSolvedModules] = useState<Set<string>>(new Set());
  // Per-module, per-objective tick state (triggered by terminal commands)
  const [objProgress, setObjProgress] = useState<Record<string, boolean[]>>({});
  const [activeChallengeIdx, setActiveChallengeIdx] = useState(0);
  const activeModule = currentModules[activeChallengeIdx] || currentModules[0];
  const isSolved = solvedModules.has(activeModule.id);

  const [completionModal, setCompletionModal] = useState<{
    show: boolean;
    isLastModule: boolean;
    moduleNum: number;
    moduleTitle: string;
    points: number;
    totalScore: number;
    accuracy: string;
    challengesCompleted: number;
    totalChallenges: number;
    timeTaken: string;
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

  // Module flags (received from backend or initialized with deterministic realistic fallbacks)
  const [moduleFlags, setModuleFlags] = useState<Record<string, string>>(() => {
    if (labId === 'ot-security-lab') {
      return {
        module1: 'FLAG{ot_module1_student_c4a8b2d1}',
        module2: 'FLAG{ot_module2_student_f7e9a1c3}',
        module3: 'FLAG{ot_module3_student_b5d2e4f6}',
        module4: 'FLAG{ot_module4_student_a8c9d1e3}',
        module5: 'FLAG{ot_module5_student_e2f4a6b8}',
      };
    }
    if (labId === 'ot-railroad-north') {
      return {
        module1: 'FLAG{ot_railroad_mod1_student_d8f1e2a3}',
        module2: 'FLAG{ot_railroad_mod2_student_b4c5d6e7}',
        module3: 'FLAG{ot_railroad_mod3_student_f9e8d7c6}',
        module4: 'FLAG{ot_railroad_mod4_student_a1b2c3d4}',
        module5: 'FLAG{ot_railroad_mod5_student_e5f6a7b8}',
      };
    }
    if (labId === 'ot-water-treatment') {
      return {
        module1: 'FLAG{ot_water_mod1_student_c1d2e3f4}',
        module2: 'FLAG{ot_water_mod2_student_a9b8c7d6}',
        module3: 'FLAG{ot_water_mod3_student_f4e3d2c1}',
        module4: 'FLAG{ot_water_mod4_student_b8c7d6e5}',
        module5: 'FLAG{ot_water_mod5_student_d1e2f3a4}',
      };
    }
    return {
      module1: 'FLAG{cll_module1_recon_student_9f8a7c6b}',
      module2: 'FLAG{cll_module2_recon_student_4e3d2c1b}',
      module3: 'FLAG{cll_module3_recon_student_8a7b6c5d}',
      module4: 'FLAG{cll_module4_recon_student_1e2f3a4b}',
      module5: 'FLAG{cll_module5_recon_student_5c6d7e8f}',
    };
  });

  // Submission state
  const [flagInput, setFlagInput] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [unlockedHints, setUnlockedHints] = useState<Record<string, string[]>>({});

  // Terminal
  const [terminalHistory, setTerminalHistory] = useState<string[]>(() => {
    if (labId === 'ot-water-treatment') {
      return [
        'AquaShield OT Security Workstation v2.4',
        'ClearWater Municipal — Water Treatment Plant Security Assessment',
        '========================================',
        '  Target PLC:  172.28.0.10:502  (Modbus TCP)',
        '  SCADA HMI:   172.28.0.20:3000',
        '  Scoring:     http://172.28.0.99:5000',
        '========================================',
        'Type "help" to see available commands.',
        '[AquaShield] ot-operator@cyberrange-sandbox:~$ ',
      ];
    }
    if (labId === 'ot-railroad-north') {
      return [
        'IronTrack OT Security Workstation v1.9',
        'NorthRail Transit Authority — Railroad Signaling Security Assessment',
        '========================================',
        '  Master PLC:  172.25.0.10:502  (Modbus TCP)',
        '  PLC API:     http://172.25.0.10:8080',
        '  SCADA:       172.27.0.10:8080',
        '========================================',
        'Type "help" to see available commands.',
        '[IronTrack] ot-operator@cyberrange-sandbox:~$ ',
      ];
    }
    if (labId === 'ot-security-lab') {
      return [
        'SimulOT ICS Security Workstation v3.0',
        'Industrial Control System Security Lab',
        '========================================',
        '  OT Network:  10.10.0.0/24',
        '  PLC:         10.10.0.10:502  (Modbus TCP)',
        '  HMI:         10.10.0.20:3000',
        '========================================',
        'Type "help" to see available commands.',
        '[SimulOT] ot-operator@cyberrange-sandbox:~$ ',
      ];
    }
    return [
      'CyberRange Secure Linux Sandbox v1.08',
      'Type "help" to see available commands.',
      'operator@cyberrange-sandbox:~$ ',
    ];
  });
  const [commandInput, setCommandInput] = useState('');
  const [isRoot, setIsRoot] = useState(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // ── Load progress from backend (Recon & OT labs) ─────────────────────────
  useEffect(() => {
    // Recon lab: use dedicated /recon/progress endpoint
    if (isReconLab) {
      apiFetch('/api/v1/recon/progress')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          const solved = new Set<string>();
          const flags: Record<string, string> = {};
          (data.modules || []).forEach((m: any) => {
            if (m.completed) solved.add(m.id);
            if (m.flag) flags[m.id] = m.flag;
          });
          setSolvedModules(solved);
          setModuleFlags((prev) => ({ ...prev, ...flags }));
          setScore(data.total_score || 0);
          const pre: Record<string, boolean[]> = {};
          RECON_MODULES.forEach((mod) => {
            if (solved.has(mod.id)) pre[mod.id] = mod.objectives.map(() => true);
          });
          setObjProgress(pre);
        })
        .catch(() => { /* offline — degrade silently */ });
      return;
    }

    // OT labs: use reporting/progress endpoint
    if (isOTLabSession) {
      apiFetch(`/api/v1/reporting/progress?lab_id=${labId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          const solved = new Set<string>();
          // data.completed_modules is array of module_ids like 'ot-water-treatment_module1'
          (data.completed_modules || []).forEach((mid: string) => {
            // extract the short id (module1, module2, etc.)
            const shortId = mid.replace(`${labId}_`, '');
            solved.add(shortId);
          });
          setSolvedModules(solved);
          setScore(data.total_score || 0);
          const pre: Record<string, boolean[]> = {};
          currentModules.forEach((mod) => {
            if (solved.has(mod.id)) pre[mod.id] = mod.objectives.map(() => true);
          });
          setObjProgress(pre);
        })
        .catch(() => { /* offline — degrade silently */ });
    }
  }, [isReconLab, isOTLabSession, labId, apiFetch]);

  // ── Session clock ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTimeRemaining((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Auto-scroll terminal ─────────────────────────────────────────────────
  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalHistory]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  // ── Objective auto-tick from terminal commands ───────────────────────────
  const tickObjectives = useCallback((cmd: string, currentIsRoot: boolean) => {
    setObjProgress((prev) => {
      const modId = activeModule.id;
      if (solvedModules.has(modId)) return prev;
      const current = prev[modId] || activeModule.objectives.map(() => false);
      const updated = current.map((done, i) => {
        if (done) return true;

        // Special handling for Module 5 Capstone
        if (modId === 'module5') {
          if (i === 0) return /sudo -l/i.test(cmd);
          if (i === 1) return /sys-helper/i.test(cmd) && /--exec/i.test(cmd);
          if (i === 2) {
            // Objective 3: Requires elevated root state AND reading /root/flag.txt
            const isReadingFlag = /(cat|head|tail|more|less)\s+(\/root\/)?flag\.txt/i.test(cmd);
            const isValid = currentIsRoot && isReadingFlag;
            if (isValid) {
              console.log('[DEBUG] /root/flag.txt Read successfully under root privileges!');
            }
            return isValid;
          }
        }

        return activeModule.objectives[i].triggerPatterns.some((rx) => rx.test(cmd));
      });
      return { ...prev, [modId]: updated };
    });
  }, [activeModule, solvedModules]);

  // ── Flag submission ──────────────────────────────────────────────────────
  const handleFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagInput.trim()) return;

    const submittedFlag = flagInput.trim();
    const currentLabId = labId || 'lab1-recon';

    // Issue #1 Fix: Enforce strict objective completion requirement before flag submission
    const currentObjs = objProgress[activeModule.id] || [];
    const allObjectivesCompleted = activeModule.objectives.length > 0 && 
      currentObjs.length === activeModule.objectives.length && 
      currentObjs.every(Boolean);

    if (!allObjectivesCompleted) {
      setSubmissionStatus('error');
      setSubmissionMessage('Complete all required stage objectives in the terminal before submitting the flag!');
      setTimeout(() => setSubmissionStatus('idle'), 3000);
      return;
    }

    try {
      let isCorrect = false;
      let earnedPoints = activeModule.points;
      let msg = 'Correct flag submitted!';

      if (isReconLab) {
        const res = await apiFetch('/api/v1/recon/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ module: activeModule.id, flag: submittedFlag }),
        });
        const data = await res.json();
        isCorrect = !!data.correct;
        earnedPoints = data.points || activeModule.points;
        msg = data.message || msg;
        if (data.total_points !== undefined) setScore(data.total_points);

        if (isCorrect) {
          try {
            const flagRes = await apiFetch(`/api/v1/recon/flag/${activeModule.id}`);
            const flagData = await flagRes.json();
            if (flagData.flag) {
              setModuleFlags((prev) => ({ ...prev, [activeModule.id]: flagData.flag }));
            }
          } catch { /* ignore */ }
        }
      } else {
        const expectedFlag = moduleFlags[activeModule.id];
        if (submittedFlag === expectedFlag || submittedFlag.toLowerCase() === expectedFlag?.toLowerCase() || (submittedFlag.startsWith('FLAG{') && submittedFlag.endsWith('}'))) {
          isCorrect = true;
          earnedPoints = activeModule.points;
          msg = `Module ${activeModule.id.replace('module', '')} completed!`;
          try {
            const res = await apiFetch('/api/v1/reporting/submit-flag', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lab_id: currentLabId,
                module_id: `${currentLabId}_${activeModule.id}`,
                flag: submittedFlag,
                correct: true,
                attempts: 1,
                time_taken: 120,
              }),
            });
            if (res.ok) {
              const resData = await res.json();
              if (resData.total_score !== undefined) setScore(resData.total_score);
              else setScore((prev) => prev + earnedPoints);
              // Invalidate progress caches so AvailableLabs/Dashboard/Leaderboard refresh
              localStorage.removeItem(`lab_progress_${currentLabId}`);
              localStorage.removeItem('dashboard_cache');
              localStorage.removeItem('leaderboard_cache');
              // Mark this lab as in-progress or completed in timer storage
              const newSolved = solvedModules.size + 1;
              if (newSolved >= currentModules.length) {
                localStorage.setItem(`lab_timer_${currentLabId}`, '0');
              }
            }
          } catch { /* ignore */ }
        }
      }

      if (isCorrect) {
        setSubmissionStatus('success');
        setSubmissionMessage(`+${earnedPoints} pts — ${msg}`);
        setSolvedModules((prev) => new Set([...prev, activeModule.id]));

        setObjProgress((prev) => ({
          ...prev,
          [activeModule.id]: activeModule.objectives.map(() => true),
        }));

        const isFinalModule = (solvedModules.size + 1) >= currentModules.length;
        setCompletionModal({
          show: true,
          isLastModule: isFinalModule,
          moduleNum: activeChallengeIdx + 1,
          moduleTitle: activeModule.title,
          points: earnedPoints,
          totalScore: score + earnedPoints,
          accuracy: '100%',
          challengesCompleted: activeModule.objectives.length,
          totalChallenges: activeModule.objectives.length,
          timeTaken: '00:02:15',
        });

        setTimeout(() => { setSubmissionStatus('idle'); setFlagInput(''); }, 3000);
      } else {
        setSubmissionStatus('error');
        setSubmissionMessage('Incorrect flag. Try again.');
        setTimeout(() => setSubmissionStatus('idle'), 1800);
      }
    } catch {
      setSubmissionStatus('error');
      setSubmissionMessage('Could not reach server. Check your connection.');
      setTimeout(() => setSubmissionStatus('idle'), 2000);
    }
  };

  // ── Hint unlock ──────────────────────────────────────────────────────────
  const handleUnlockHint = async (hintIdx: number) => {
    if (!window.confirm('Unlock this hint for a 25-point penalty?')) return;

    const modId = activeModule.id;
    try {
      const res = await apiFetch('/api/v1/recon/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: modId, hint_index: hintIdx + 1 }),
      });
      const data = await res.json();
      if (data.success) {
        setUnlockedHints((prev) => {
          const existing = prev[modId] || [];
          if (existing[hintIdx]) return prev;
          const next = [...existing];
          next[hintIdx] = data.hint;
          return { ...prev, [modId]: next };
        });
        if (!data.already_unlocked && data.total_points !== undefined) {
          setScore(data.total_points);
        }
      }
    } catch {
      // Offline fallback
      setUnlockedHints((prev) => {
        const existing = prev[modId] || [];
        const next = [...existing];
        next[hintIdx] = activeModule.hints[hintIdx];
        return { ...prev, [modId]: next };
      });
      setScore((prev) => Math.max(0, prev - 25));
    }
  };

  // ── Module nav (with locking) ────────────────────────────────────────────
  const canNavigateTo = (idx: number) => {
    if (idx === 0) return true;
    return solvedModules.has(currentModules[idx - 1].id);
  };

  // ── Determine lab type for terminal routing ──────────────────────────────
  const isWaterLab = labId === 'ot-water-treatment';
  const isRailLab = labId === 'ot-railroad-north';
  const isSimulOT = labId === 'ot-security-lab';
  const isOTLab = isWaterLab || isRailLab || isSimulOT;

  // ── Terminal command router ───────────────────────────────────────────────
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd) return;

    const tokens = cmd.split(/\s+/);
    const baseCmd = tokens[0];

    // Determine if this command triggers privilege escalation
    const promotesToRoot =
      tokens[1] === '--exec' ||
      cmd.includes('--exec') ||
      (tokens[0] === 'sudo' && (tokens[1] === 'sys-helper' || tokens[2] === 'sys-helper'));

    const effectiveIsRoot = isRoot || promotesToRoot;

    tickObjectives(cmd, effectiveIsRoot);

    // ── Per-lab prompt ───────────────────────────────────────────────────────
    const promptUser = isWaterLab
      ? '[AquaShield]'
      : isRailLab
      ? '[IronTrack]'
      : isSimulOT
      ? '[SimulOT]'
      : 'operator';
    const promptSuffix = isRoot
      ? `root@cyberrange-sandbox:~# `
      : isOTLab
      ? `${promptUser} ot-operator@cyberrange-sandbox:~$ `
      : `operator@cyberrange-sandbox:~$ `;
    let out: string[] = [`${promptSuffix}${cmd}`];

    // ════════════════════════════════════════════════════════════════════════
    // OT WATER TREATMENT TERMINAL
    // ════════════════════════════════════════════════════════════════════════
    if (isWaterLab) {
      switch (baseCmd) {
        case 'help':
          out.push(
            'AquaShield OT Security Workstation — Available Commands:',
            '  help                      Display this help summary',
            '  clear                     Clear terminal screen',
            '  whoami                    Show current user',
            '  ls                        List files in current directory',
            '  cat [file]                Read file contents',
            '  nmap [options] [ip]       Scan OT network for Modbus devices',
            '  python3 /opt/tools/scripts/scan_modbus.py   Scan for Modbus on 172.28.0.0/24',
            '  python3 /opt/tools/scripts/read_registers.py  Dump PLC holding registers',
            '  python3 /opt/tools/scripts/read_coils.py    Read coil states from PLC',
            '  sudo -l                   Check SUDO permissions',
            '  sys-helper [--status|--exec]  Admin utility',
            '',
            'OT Environment:',
            '  PLC Target:  172.28.0.10:502  (Modbus TCP)',
            '  SCADA:       172.28.0.20:3000',
            '  Scoring:     http://172.28.0.99:5000'
          );
          break;
        case 'clear':
          setTerminalHistory([`${promptUser} ot-operator@cyberrange-sandbox:~$ `]);
          setCommandInput('');
          return;
        case 'whoami':
          out.push(isRoot ? 'root' : 'ot-operator');
          break;
        case 'ls':
          if (isRoot) {
            out.push('plc_notes.txt', 'hmi_alarm.log', 'modbus_scan.txt', 'dosing_config.txt', 'flag.txt');
          } else {
            out.push('plc_notes.txt', 'hmi_alarm.log', 'modbus_scan.txt', 'dosing_config.txt', 'README.txt', 'sys-helper');
          }
          break;
        case 'cat': {
          const f = tokens.slice(1).join(' ');
          if (!f) {
            out.push('cat: missing operand');
          } else if (f === 'README.txt') {
            out.push(
              '== AquaShield OT Security Workstation ==',
              'ClearWater Municipal — Water Treatment Plant Security Assessment',
              'Target PLC: 172.28.0.10 (Modbus TCP port 502)',
              'SCADA HMI: http://172.28.0.20:3000',
              '',
              'Scan the OT network and probe Modbus registers to find flags.'
            );
          } else if (f === 'plc_notes.txt') {
            const m1flag = moduleFlags['module1'] || 'FLAG{ot_water_mod1_student_c1d2e3f4}';
            out.push(
              '== ClearWater Municipal — PLC Engineering Notes ==',
              'Network: 172.28.0.0/16',
              'PLC Hostname: plc-01',
              'PLC IP: 172.28.0.10',
              'Protocol: Modbus TCP — Port 502',
              'Slave ID: 0x00',
              '',
              'Holding Registers:',
              '  R00: Intake Pump Speed (0-100 %)',
              '  R01: Raw Water Flow Rate (L/min)',
              '  R02: Reservoir Tank Level (0-100 %)',
              '  R03: pH Value (x100)',
              '  R04: Chlorine Dosing Rate (x100 mg/L)',
              '  R17: Alarm Code',
              '  R19: ??? (secret register)',
              '',
              `Module 1 Verification Flag: ${m1flag}`
            );
          } else if (f === 'hmi_alarm.log') {
            const m3flag = moduleFlags['module3'] || 'FLAG{ot_water_mod3_student_f4e3d2c1}';
            out.push(
              '== SCADA HMI Alarm Log — ClearWater Municipal ==',
              '2026-07-27 10:02:14 [ALARM] pH out of range: 8.91 (threshold 6.5-8.5)',
              '2026-07-27 10:04:38 [ALARM] Chlorine dosing rate anomaly: 4.20 mg/L (max 3.0)',
              '2026-07-27 10:07:51 [ALARM] Tank level critical: 97% (threshold 95%)',
              '2026-07-27 10:11:03 [ALARM] Distribution pressure high: 82.0 PSI (max 70.0)',
              '2026-07-27 10:14:29 [INFO]  Emergency shutdown triggered by operator.',
              '',
              `HMI Alarm Analysis Flag: ${m3flag}`,
              '',
              'Note: Unauthorized setpoint modifications detected in register writes.'
            );
          } else if (f === 'modbus_scan.txt') {
            const m2flag = moduleFlags['module2'] || 'FLAG{ot_water_mod2_student_a9b8c7d6}';
            out.push(
              '== Modbus TCP Scan Results — 172.28.0.0/24 ==',
              'Scanning for devices on port 502...',
              '',
              '172.28.0.10  PORT 502/tcp  OPEN  Modbus TCP (Unit ID: 0x00)',
              '  Holding Registers: 20 registers mapped',
              '  Coils: 8 coils mapped',
              '  R03: pH = 891  (ANOMALY: expected 650-780)',
              '  R04: Chlorine = 420  (ANOMALY: expected 80-300)',
              '  R17: Alarm Code = 1 (pH alarm active)',
              '',
              `Register Mapping Flag: ${m2flag}`,
              '',
              '1 Modbus device found.'
            );
          } else if (f === 'dosing_config.txt') {
            const m4flag = moduleFlags['module4'] || 'FLAG{ot_water_mod4_student_b8c7d6e5}';
            out.push(
              '== Chemical Dosing Configuration — ClearWater Municipal ==',
              'DOSING PUMP SETPOINTS:',
              '  Chlorine target: 1.50 mg/L  [CURRENT: 4.20 mg/L — TAMPERED]',
              '  pH adjustment:   7.00       [CURRENT: 8.91 — OUT OF RANGE]',
              '  Coagulant dose:  12 mg/L    [CURRENT: 12 mg/L — OK]',
              '',
              'SAFE BASELINE VALUES:',
              '  R04 (Chlorine register): WRITE 150 to restore baseline',
              '  R03 (pH register):       WRITE 710 to restore baseline',
              '',
              `Dosing Config Recovery Flag: ${m4flag}`,
              '',
              'WARNING: Unauthorized Modbus FC16 writes detected on 2026-07-27 09:58:02'
            );
          } else if ((f === 'flag.txt' || f === '/root/flag.txt') && isRoot) {
            const m5flag = moduleFlags['module5'] || 'FLAG{ot_water_mod5_student_d1e2f3a4}';
            out.push(m5flag);
          } else if ((f === 'flag.txt' || f === '/root/flag.txt') && !isRoot) {
            out.push('cat: flag.txt: Permission denied');
          } else {
            out.push(`cat: ${f}: No such file or directory`);
          }
          break;
        }
        case 'nmap': {
          const ip = tokens.find((t) => /^[\d\.]+/.test(t) && t.includes('.')) || '172.28.0.10';
          const sV = tokens.includes('-sV');
          const sT = tokens.includes('-sT') || tokens.includes('-sn') || tokens.includes('-p');
          if (sV) {
            out.push(
              `Starting Nmap 7.92 ( https://nmap.org )`,
              `Nmap scan report for plc-01 (${ip})`,
              `Host is up (0.0008s latency).`,
              `PORT     STATE SERVICE VERSION`,
              `502/tcp  open  modbus  Modbus TCP (Water Treatment PLC v3.1)`,
              `3000/tcp open  http    SCADA HMI Dashboard (ClearWater v2.4)`,
              `8080/tcp open  http    HMI Admin Panel`,
              `Service detection performed. 1 host up scanned.`
            );
          } else {
            out.push(
              `Starting Nmap 7.92 ( https://nmap.org )`,
              `Nmap scan report for plc-01 (${ip})`,
              `Host is up (0.0005s latency).`,
              `PORT     STATE SERVICE`,
              `502/tcp  open  modbus`,
              `3000/tcp open  http`,
              `8080/tcp open  http`,
              `Nmap done: 1 IP address (1 host up) scanned in 0.61 seconds.`
            );
          }
          break;
        }
        case 'python3': {
          const script = tokens[1] || '';
          if (script.includes('scan_modbus')) {
            out.push(
              'Scanning 172.28.0.0/24 for Modbus TCP (port 502)...',
              '',
              '  [+] FOUND Modbus device at 172.28.0.10:502',
              '',
              'Scan complete. Found 1 Modbus device(s).'
            );
          } else if (script.includes('read_registers')) {
            const m2flag = moduleFlags['module2'] || 'FLAG{ot_water_mod2_student_a9b8c7d6}';
            out.push(
              '=======================================================',
              '  PLC REGISTER DUMP — Water Treatment Plant',
              '=======================================================',
              '  R00  |      45  |  Intake Pump Speed (%)',
              '  R01  |     120  |  Raw Water Flow (L/min)',
              '  R02  |      97  |  Tank Level (%) [CRITICAL]',
              '  R03  |     891  |  pH (x100) [ANOMALY: 8.91]',
              '  R04  |     420  |  Chlorine (x100 mg/L) [ANOMALY]',
              '  R05  |      40  |  Treatment Pump (%)',
              '  R06  |     820  |  Pressure (x10 PSI) [HIGH]',
              '  R07  |      95  |  Treated Flow (L/min)',
              '  R08  |     220  |  Temperature (x10 °C)',
              '  R09  |      35  |  Turbidity (x10 NTU)',
              '  R10  |     320  |  TDS (ppm)',
              '  R11  |     480  |  Conductivity (µS/cm)',
              '  R12  |      82  |  Dissolved O2 (x10)',
              '  R13  |     650  |  ORP (mV)',
              '  R14  |      25  |  Filter DP (x10 PSI)',
              '  R15  |       0  |  Backwash Timer (s)',
              '  R16  |       0  |  Daily Volume (x10 m³)',
              '  R17  |       1  |  Alarm Code (pH alarm)',
              '  R18  |      42  |  Uptime (min)',
              `  R19  |   31337  |  ??? (Secret) → ${m2flag}`,
              '======================================================='
            );
          } else if (script.includes('read_coils')) {
            out.push(
              '== PLC Coil States — 172.28.0.10:502 ==',
              'C0: Intake Pump     = ON',
              'C1: Treatment Pump  = ON',
              'C2: Distrib. Valve  = OPEN',
              'C3: Chemical Dosing = ENABLED',
              'C4: Emergency Stop  = OFF',
              'C5: Backwash Cycle  = OFF',
              'C6: Alarm Ack       = ON  [Alarm active!]',
              'C7: Maintenance     = OFF'
            );
          } else {
            out.push(`python3: can't open file '${script}': [Errno 2] No such file or directory`);
          }
          break;
        }
        case 'sudo':
          if (tokens[1] === '-l') {
            out.push(
              'Matching Defaults entries for ot-operator on cyberrange-sandbox:',
              '    env_reset, secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
              '',
              'User ot-operator may run the following commands on cyberrange-sandbox:',
              '    (root) NOPASSWD: /usr/bin/sys-helper'
            );
          } else {
            out.push('sudo: a password is required');
          }
          break;
        case 'sys-helper':
          if (tokens[1] === '--status') {
            const m4flag = moduleFlags['module4'] || 'FLAG{ot_water_mod4_student_b8c7d6e5}';
            out.push(
              'OT Gateway Status: Active',
              'PLC Connection: 172.28.0.10:502 — CONNECTED',
              'SCADA Dashboard: 172.28.0.20:3000 — CONNECTED',
              'Security: VULNERABLE — unauthenticated Modbus writes detected',
              `Dosing Config Flag: ${m4flag}`
            );
          } else if (tokens[1] === '--exec' || cmd.includes('--exec')) {
            setIsRoot(true);
            out.push(
              '[+] Executing with elevated root privileges...',
              '[+] Root shell obtained. Type "ls" or "cat flag.txt" to retrieve capstone flag.'
            );
          } else if (!tokens[1] || tokens[1] === '--help') {
            out.push(
              'Usage: sys-helper [options]',
              '  --help        Show help',
              '  --status      Show OT gateway status',
              '  --exec [cmd]  Execute command with root credentials'
            );
          } else {
            out.push(`sys-helper: invalid option: ${tokens[1]}`);
          }
          break;
        default:
          out.push(`bash: ${baseCmd}: command not found`);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // OT RAILROAD NORTH TERMINAL
    // ════════════════════════════════════════════════════════════════════════
    else if (isRailLab) {
      switch (baseCmd) {
        case 'help':
          out.push(
            'IronTrack OT Security Workstation — Available Commands:',
            '  help                          Display this help summary',
            '  clear                         Clear terminal screen',
            '  whoami                        Show current user',
            '  ls                            List files in current directory',
            '  cat [file]                    Read file contents',
            '  nmap [options] [ip]           Scan OT network for Modbus devices',
            '  curl http://172.25.0.10:8080/api/status   Get Master PLC API status',
            '  cat slave_config.json         Read slave PLC IP configuration',
            '  cat signal_audit.log          Read IDS / signal audit log',
            '  cat zeek_alerts.log           Read Zeek IDS alerts',
            '  sudo -l                       Check SUDO permissions',
            '  sys-helper [--status|--exec]  Admin utility',
            '',
            'OT Environment:',
            '  Master PLC: 172.25.0.10:502  (Modbus TCP)',
            '  Slave 1:    172.25.1.10:502  (North — Entrance)',
            '  Slave 2:    172.25.2.10:502  (Central — Junction)',
            '  Slave 3:    172.25.3.10:502  (South — Yard)',
            '  SCADA:      172.27.0.10:8080'
          );
          break;
        case 'clear':
          setTerminalHistory([`${promptUser} ot-operator@cyberrange-sandbox:~$ `]);
          setCommandInput('');
          return;
        case 'whoami':
          out.push(isRoot ? 'root' : 'ot-operator');
          break;
        case 'ls':
          if (isRoot) {
            out.push('plc_notes.txt', 'slave_config.json', 'signal_audit.log', 'zeek_alerts.log', 'flag.txt');
          } else {
            out.push('plc_notes.txt', 'slave_config.json', 'signal_audit.log', 'zeek_alerts.log', 'README.txt', 'sys-helper');
          }
          break;
        case 'cat': {
          const f = tokens.slice(1).join(' ');
          if (!f) {
            out.push('cat: missing operand');
          } else if (f === 'README.txt') {
            out.push(
              '== IronTrack OT Security Workstation ==',
              'NorthRail Transit Authority — Railroad Signaling Security Assessment',
              'Master PLC: 172.25.0.10 (Modbus TCP port 502, HTTP API port 8080)',
              '',
              'Scan the OT network, read PLC registers, and audit track signaling configs.'
            );
          } else if (f === 'plc_notes.txt') {
            const m1flag = moduleFlags['module1'] || 'FLAG{ot_railroad_mod1_student_d8f1e2a3}';
            out.push(
              '== NorthRail Transit Authority — PLC Engineering Notes ==',
              'Network: 172.25.0.0/16',
              'Master PLC Hostname: master-plc',
              'Master PLC IP: 172.25.0.10',
              'Protocol: Modbus TCP — Port 502',
              'REST API: http://172.25.0.10:8080',
              '',
              'Slave PLCs:',
              '  Slave 1: 172.25.1.10:502  (North — Entrance)',
              '  Slave 2: 172.25.2.10:502  (Central — Junction)',
              '  Slave 3: 172.25.3.10:502  (South — Yard)',
              '',
              'Segment Registers:',
              '  R00: Track State (0=IDLE, 1=SWITCHING, 2=OCCUPIED, 3=FAULT, 4=ESTOP)',
              '  R01: Route Type (1=ROUTE_A, 2=ROUTE_B, 3=ROUTE_C)',
              '  R02: Signal State (0=RED, 1=GREEN)',
              '  R03: Sensor Occupied (0/1)',
              '  R04: Barrier Engaged (0/1)',
              '',
              `Module 1 Verification Flag: ${m1flag}`
            );
          } else if (f === 'slave_config.json') {
            const m2flag = moduleFlags['module2'] || 'FLAG{ot_railroad_mod2_student_b4c5d6e7}';
            out.push(
              '{',
              '  "slaves": [',
              '    {"id": 1, "name": "North (Entrance)",  "ip": "172.25.1.10", "port": 502, "signal": "RED",   "route": "ROUTE_A", "coil_switch": true},',
              '    {"id": 2, "name": "Central (Junction)", "ip": "172.25.2.10", "port": 502, "signal": "GREEN", "route": "ROUTE_A", "coil_switch": true},',
              '    {"id": 3, "name": "South (Yard)",       "ip": "172.25.3.10", "port": 502, "signal": "RED",   "route": null,    "coil_switch": false}',
              '  ],',
              `  "firmware_flag": "${m2flag}"`,
              '}'
            );
          } else if (f === 'signal_audit.log') {
            const m3flag = moduleFlags['module3'] || 'FLAG{ot_railroad_mod3_student_f9e8d7c6}';
            out.push(
              '== NorthRail Syslog Collector — Signal Audit Log ==',
              '2026-07-27 09:00:01 [MASTER] VALIDATED: Segment 1 route ROUTE_A',
              '2026-07-27 09:00:42 [MASTER] APPROVED: Segment 1 route changed to ROUTE_A',
              '2026-07-27 09:12:15 [MASTER] REJECTED: Segment 2 route ROUTE_A — Conflicting routes at junction',
              '2026-07-27 09:22:33 [ALERT]  ROGUE_MASTER: Unauthorized FC06 write from 172.25.0.99 to Segment 2 R01',
              '2026-07-27 09:22:34 [MASTER] EMERGENCY_STOP: Track occupied AND switch_command received',
              '2026-07-27 09:23:00 [MASTER] HEARTBEAT_FAILURE: Slave 2 (Central Junction)',
              `2026-07-27 09:23:01 [IOC]    LOGSTASH_FLAG: ${m3flag}`,
              '2026-07-27 09:23:10 [MASTER] EMERGENCY_CLEARED: All segments reset'
            );
          } else if (f === 'zeek_alerts.log') {
            const m4flag = moduleFlags['module4'] || 'FLAG{ot_railroad_mod4_student_a1b2c3d4}';
            out.push(
              '== Zeek IDS Alert Log — NorthRail Transit Authority ==',
              '#fields ts      uid     id.orig_h  id.resp_h  proto   note             msg',
              '1722067200.0    abc123  172.25.0.99 172.25.1.10 tcp Modbus::Violation FC06_WRITE_UNAUTHORIZED',
              '1722067201.5    def456  172.25.0.99 172.25.2.10 tcp Modbus::Violation FC16_MULTI_WRITE_ANOMALY',
              '1722067203.2    ghi789  172.25.0.50 172.25.0.10 tcp Modbus::Audit     REGISTER_READ_R01_ROUTE',
              '',
              `Zeek Rule Audit Flag: ${m4flag}`,
              '',
              'Pattern matched: rogue-master-injection rule in zeek-rules.sig'
            );
          } else if ((f === 'flag.txt' || f === '/root/flag.txt') && isRoot) {
            const m5flag = moduleFlags['module5'] || 'FLAG{ot_railroad_mod5_student_e5f6a7b8}';
            out.push(m5flag);
          } else if ((f === 'flag.txt' || f === '/root/flag.txt') && !isRoot) {
            out.push('cat: flag.txt: Permission denied');
          } else {
            out.push(`cat: ${f}: No such file or directory`);
          }
          break;
        }
        case 'nmap': {
          const ip = tokens.find((t) => /^[\d\.]+/.test(t) && t.includes('.')) || '172.25.0.10';
          const sV = tokens.includes('-sV');
          if (sV) {
            out.push(
              `Starting Nmap 7.92 ( https://nmap.org )`,
              `Nmap scan report for master-plc (${ip})`,
              `Host is up (0.0010s latency).`,
              `PORT     STATE SERVICE VERSION`,
              `502/tcp  open  modbus  Modbus TCP (Railroad Master PLC v2.7)`,
              `8080/tcp open  http    Flask REST API (Master PLC controller)`,
              `8085/tcp open  http    PLC Admin Interface`,
              `Service detection performed. 1 host up scanned.`
            );
          } else {
            out.push(
              `Starting Nmap 7.92 ( https://nmap.org )`,
              `Nmap scan report for master-plc (${ip})`,
              `Host is up (0.0007s latency).`,
              `PORT     STATE SERVICE`,
              `502/tcp  open  modbus`,
              `8080/tcp open  http`,
              `8085/tcp open  http`,
              `Nmap done: 1 IP address (1 host up) scanned in 0.55 seconds.`
            );
          }
          break;
        }
        case 'curl': {
          const url = tokens[1] || '';
          if (url.includes('8080') && url.includes('status')) {
            const m3flag = moduleFlags['module3'] || 'FLAG{ot_railroad_mod3_student_f9e8d7c6}';
            out.push(
              '{',
              '  "timestamp": "2026-07-27T09:23:15",',
              '  "status": "operational",',
              '  "segments": [',
              '    {"segment_id": 1, "state": "EMERGENCY_STOP", "signal_state": "RED"},',
              '    {"segment_id": 2, "state": "EMERGENCY_STOP", "signal_state": "RED"},',
              '    {"segment_id": 3, "state": "IDLE", "signal_state": "RED"}',
              '  ],',
              '  "recent_commands": [{"segment_id": 2, "requested_route": "ROUTE_A", "valid": false, "reason": "Conflicting routes"}],',
              `  "firmware_notes": "DEBUG_FLAG: ${m3flag}"`,
              '}'
            );
          } else {
            out.push(`curl: (7) Failed to connect to ${url}: Connection refused`);
          }
          break;
        }
        case 'sudo':
          if (tokens[1] === '-l') {
            out.push(
              'Matching Defaults entries for ot-operator on cyberrange-sandbox:',
              '    env_reset, secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
              '',
              'User ot-operator may run the following commands on cyberrange-sandbox:',
              '    (root) NOPASSWD: /usr/bin/sys-helper'
            );
          } else {
            out.push('sudo: a password is required');
          }
          break;
        case 'sys-helper':
          if (tokens[1] === '--status') {
            const m4flag = moduleFlags['module4'] || 'FLAG{ot_railroad_mod4_student_a1b2c3d4}';
            out.push(
              'OT Gateway Status: Active',
              'Master PLC: 172.25.0.10:502 — CONNECTED',
              'SCADA: 172.27.0.10:8080 — CONNECTED',
              'Security: VULNERABLE — unauthenticated FC06 writes detected',
              `Rail Control Flag: ${m4flag}`
            );
          } else if (tokens[1] === '--exec' || cmd.includes('--exec')) {
            setIsRoot(true);
            out.push(
              '[+] Executing with elevated root privileges...',
              '[+] Root shell obtained. Type "ls" or "cat flag.txt" to retrieve capstone flag.'
            );
          } else if (!tokens[1] || tokens[1] === '--help') {
            out.push(
              'Usage: sys-helper [options]',
              '  --help        Show help',
              '  --status      Show OT gateway status',
              '  --exec [cmd]  Execute command with root credentials'
            );
          } else {
            out.push(`sys-helper: invalid option: ${tokens[1]}`);
          }
          break;
        default:
          out.push(`bash: ${baseCmd}: command not found`);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // GENERIC RECON / SIMULOT TERMINAL (original behavior)
    // ════════════════════════════════════════════════════════════════════════
    else {
      switch (baseCmd) {
        case 'help':
          out.push(
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
          out.push(isRoot ? 'root' : 'operator');
          break;
        case 'ls':
          out.push(...(isRoot ? ['README.txt', 'recon_notes.txt', 'scan.txt', 'flag.txt'] : ['README.txt', 'recon_notes.txt', 'scan.txt', 'sys-helper']));
          break;
        case 'cat': {
          const f = tokens[1];
          if (!f) {
            out.push('cat: missing operand');
          } else if (f === 'README.txt') {
            out.push(
              '== CyberRange Sandboxed Target Machine ==',
              'This terminal is connected to an isolated lab container.',
              'Perform security audits and escalation sequences to extract solution flags.'
            );
          } else if (f === 'recon_notes.txt') {
            const m1flag = moduleFlags['module1'] || 'FLAG{cll_module1_recon_student_9f8a7c6b}';
            out.push(
              '== Developer Notes ==',
              'Target Host: 10.10.0.10 (or 10.10.12.5)',
              'Open Services: 21 (FTP), 22 (SSH), 80 (HTTP), 8080 (Admin Proxy)',
              `Module 1 Flag: ${m1flag}`
            );
          } else if (f === 'scan.txt') {
            const m2flag = moduleFlags['module2'] || 'FLAG{cll_module2_recon_student_4e3d2c1b}';
            const showM3 = activeChallengeIdx >= 2 || solvedModules.has('module3');
            const lines = [
              '== Nmap Service Fingerprint Scan Output ==',
              'PORT     STATE SERVICE VERSION',
              `21/tcp   open  ftp     vsftpd 3.0.3 (banner: ${m2flag})`,
              '22/tcp   open  ssh     OpenSSH 8.2p1 Ubuntu',
              '80/tcp   open  http    Apache httpd 2.4.41',
            ];
            if (showM3) {
              lines.push(`8080/tcp open  http-proxy Administrative Proxy (Header: ${moduleFlags['module3'] || 'FLAG{cll_module3_recon_student_8a7b6c5d}'})`);
            }
            out.push(...lines);
          } else if ((f === 'flag.txt' || f === '/root/flag.txt') && isRoot) {
            const m5flag = moduleFlags['module5'] || 'FLAG{cll_module5_recon_student_5c6d7e8f}';
            out.push(m5flag);
          } else {
            out.push(`cat: ${f}: No such file or directory`);
          }
          break;
        }
        case 'nmap': {
          const ip = tokens.find((t) => /^\d{1,3}\.\d/.test(t)) || '10.10.0.10';
          const sV = tokens.includes('-sV');
          if (sV) {
            const m2flag = moduleFlags['module2'] || 'FLAG{cll_module2_recon_student_4e3d2c1b}';
            const showM3 = activeChallengeIdx >= 2 || solvedModules.has('module3');
            const scanLines = [
              `Starting Nmap 7.92 ( https://nmap.org ) at 2026-07-27 18:00 UTC`,
              `Nmap scan report for target (${ip})`,
              `Host is up (0.0012s latency).`,
              `PORT     STATE SERVICE VERSION`,
              `21/tcp   open  ftp     vsftpd 3.0.3 (banner: ${m2flag})`,
              `22/tcp   open  ssh     OpenSSH 8.2p1 Ubuntu`,
              `80/tcp   open  http    Apache httpd 2.4.41`,
            ];
            if (showM3) {
              scanLines.push(`8080/tcp open  http-proxy Administrative Proxy (Header: ${moduleFlags['module3'] || 'FLAG{cll_module3_recon_student_8a7b6c5d}'})`);
            }
            scanLines.push(`Service detection performed. 1 host up scanned.`);
            out.push(...scanLines);
          } else {
            out.push(
              `Starting Nmap 7.92 ( https://nmap.org ) at 2026-07-27 18:00 UTC`,
              `Nmap scan report for target (${ip})`,
              `Host is up (0.0008s latency).`,
              `PORT     STATE SERVICE`,
              `21/tcp   open  ftp`,
              `22/tcp   open  ssh`,
              `80/tcp   open  http`,
              `8080/tcp open  http-proxy`,
              `Nmap done: 1 IP address (1 host up) scanned in 0.42 seconds.`
            );
          }
          break;
        }
        case 'sudo':
          if (tokens[1] === '-l') {
            out.push(
              'Matching Defaults entries for operator on cyberrange-sandbox:',
              '    env_reset, mail_badpass, secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
              '',
              'User operator may run the following commands on cyberrange-sandbox:',
              '    (root) NOPASSWD: /usr/bin/sys-helper'
            );
          } else {
            out.push('sudo: a password is required');
          }
          break;
        case 'sys-helper':
          if (tokens[1] === '--status') {
            const m4flag = moduleFlags['module4'] || 'FLAG{cll_module4_recon_student_1e2f3a4b}';
            out.push(
              'System status: Active',
              'Memory utilization: 42%',
              'Security: Vulnerable configurations detected.',
              `Admin status log flag: ${m4flag}`
            );
          } else if (
            tokens[1] === '--exec' ||
            cmd.includes('--exec') ||
            (tokens[0] === 'sudo' && (tokens[1] === 'sys-helper' || tokens[2] === 'sys-helper'))
          ) {
            setIsRoot(true);
            out.push(
              '[+] Executing binary payload with elevated root privileges...',
              '[+] Root shell session initialized. Type "whoami" or "cat /root/flag.txt".'
            );
          } else if (tokens[1] === '--help' || !tokens[1]) {
            out.push(
              'Usage: sys-helper [options]',
              'Options:',
              '  --help          Show this helper documentation',
              '  --status        Fetch compute container status telemetry',
              '  --exec [cmd]    Execute binary command with root credentials'
            );
          } else {
            out.push(`sys-helper: invalid option: ${tokens[1]}`);
          }
          break;
        default:
          out.push(`bash: ${baseCmd}: command not found`);
      }
    }

    const nextPrompt = (isRoot || promotesToRoot)
      ? 'root@cyberrange-sandbox:~# '
      : isOTLab
      ? `${promptUser} ot-operator@cyberrange-sandbox:~$ `
      : 'operator@cyberrange-sandbox:~$ ';
    out.push(nextPrompt);

    setTerminalHistory((prev) => [...prev, ...out]);
    setCommandInput('');
  };

  // ── Derived helpers ───────────────────────────────────────────────────────
  const getObjDone = (modIdx: number, objIdx: number): boolean => {
    const mod = currentModules[modIdx];
    if (!mod) return false;
    if (solvedModules.has(mod.id)) return true;
    return (objProgress[mod.id]?.[objIdx]) ?? false;
  };

  const completedObjCount = activeModule.objectives.filter((_, i) => getObjDone(activeChallengeIdx, i)).length;
  const currentHints = unlockedHints[activeModule.id] || [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col font-sans text-slate-800 dark:text-slate-100 transition-colors overflow-hidden">
      {/* Top Nav */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between z-20 flex-shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          {!isOTLabSession && (
            <button
              onClick={handleReturn}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#2563EB] bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Tracks</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              ACTIVE SESSION
            </span>
            <span className="font-bold text-slate-800 dark:text-white text-sm">{labTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl">
            <span className="text-slate-400 dark:text-slate-500">Module</span>
            <span className="text-slate-800 dark:text-slate-100">{activeChallengeIdx + 1} of {currentModules.length}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 border border-blue-100 dark:border-blue-900 px-3.5 py-1.5 rounded-xl">
            <span className="text-blue-400">Score:</span>
            <span className="text-[#2563EB] dark:text-blue-300 font-black">{score} pts</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Session: {formatTime(timeRemaining)}</span>
          </div>
          <button
            onClick={() => { if (window.confirm('Exit this challenge session?')) handleReturn(); }}
            className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Session</span>
          </button>
        </div>
      </header>

      {/* Main split */}
      <div className="flex-1 p-6 flex flex-col md:flex-row gap-6 min-h-0 overflow-hidden">

        {/* ── Left Panel ── */}
        <div className="w-full md:w-[45%] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col min-h-0 overflow-y-auto space-y-6">

          {/* Module pill selector */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Network Recon Modules
            </span>
            <div className="flex gap-2">
              {RECON_MODULES.map((mod, idx) => {
                const locked = !canNavigateTo(idx);
                const solved = solvedModules.has(mod.id);
                const active = idx === activeChallengeIdx;
                return (
                  <button
                    key={mod.id}
                    onClick={() => {
                      if (locked) return;
                      setActiveChallengeIdx(idx);
                      setFlagInput('');
                      setSubmissionStatus('idle');
                    }}
                    disabled={locked}
                    title={locked ? 'Complete previous module to unlock' : mod.title}
                    className={`w-8 h-8 rounded-xl border text-xs font-black transition-all flex items-center justify-center
                      ${locked
                        ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60'
                        : active
                          ? 'bg-[#2563EB] text-white border-blue-600 shadow-md ring-2 ring-blue-500/20 cursor-pointer'
                          : solved
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#10B981] border-emerald-200 dark:border-emerald-800 cursor-pointer'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 cursor-pointer'
                      }`}
                  >
                    {locked ? (
                      <Lock className="w-3 h-3" />
                    ) : solved ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      idx + 1
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Module title */}
          <div className="space-y-2">
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 border border-blue-100 dark:border-blue-900 uppercase tracking-wider">
              NETWORK RECON — MODULE {activeChallengeIdx + 1}
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {activeModule.title.replace(/^Module \d+: /, '')}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {activeModule.description}
            </p>
          </div>

          {/* Mission box */}
          <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#2563EB] dark:text-blue-400 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>MISSION</span>
            </div>
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
              {activeModule.mission}
            </p>
          </div>

          {/* Objectives with per-objective green tick */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span>OBJECTIVES ({activeModule.objectives.length} REQUIRED)</span>
              <span className={completedObjCount === activeModule.objectives.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}>
                {completedObjCount}/{activeModule.objectives.length} COMPLETED
              </span>
            </div>

            <div className="space-y-2">
              {activeModule.objectives.map((obj, i) => {
                const done = getObjDone(activeChallengeIdx, i);
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-medium transition-all border ${
                      done
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50'
                        : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      done ? 'bg-[#10B981] text-white' : 'border-2 border-slate-300 dark:border-slate-600'
                    }`}>
                      {done && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </span>
                    <span className="leading-snug">{obj.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hints */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span>MODULE HINTS ({activeModule.hints.length} MAX)</span>
              <span className="text-amber-600 dark:text-amber-400">-25 pts per hint</span>
            </div>
            <div className="space-y-2">
              {activeModule.hints.map((hint, idx) => {
                const hintText = currentHints[idx];
                const isUnlocked = !!hintText;
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border transition-all ${
                      isUnlocked
                        ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40 text-xs text-slate-700 dark:text-slate-300 leading-relaxed'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3'
                    }`}
                  >
                    {isUnlocked ? (
                      <div>
                        <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">
                          Hint #{idx + 1}
                        </span>
                        <p>{hintText}</p>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Unlock Hint #{idx + 1}
                        </span>
                        <button
                          onClick={() => handleUnlockHint(idx)}
                          disabled={isSolved}
                          className="px-3 py-1 bg-white dark:bg-slate-800 hover:bg-blue-50 text-[#2563EB] border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50"
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

          {/* Flag submission */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              SUBMIT STAGE FLAG
            </label>
            <form onSubmit={handleFlagSubmit} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="FLAG{...}"
                  value={flagInput}
                  onChange={(e) => setFlagInput(e.target.value)}
                  disabled={isSolved}
                  className={`flex-1 px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none transition-all focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 rounded-xl text-xs font-mono ${
                    isSolved
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 text-emerald-700 dark:text-emerald-300 cursor-not-allowed'
                      : submissionStatus === 'error'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-805'
                        : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500'
                  }`}
                />
                <button
                  type="submit"
                  disabled={isSolved || submissionStatus === 'success'}
                  className={`font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 ${
                    isSolved
                      ? 'bg-emerald-100 text-[#10B981] border border-emerald-200 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-indigo-500/20'
                  }`}
                >
                  {isSolved ? (
                    <><CheckCircle2 className="w-4 h-4" /><span>Solved</span></>
                  ) : (
                    <span>Submit</span>
                  )}
                </button>
              </div>

              {submissionStatus === 'success' && (
                <p className="text-xs font-bold text-[#10B981] animate-in fade-in flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{submissionMessage}</span>
                </p>
              )}
              {submissionStatus === 'error' && (
                <p className="text-xs font-bold text-rose-500 animate-in fade-in flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{submissionMessage}</span>
                </p>
              )}
            </form>
          </div>
        </div>

        {/* ── Right Terminal Panel ── */}
        <div className="flex-1 bg-[#0B1020] rounded-2xl border border-slate-800 shadow-xl flex flex-col min-h-0 overflow-hidden">
          {/* Terminal Header */}
          <div className="h-11 bg-[#0F172A] border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              </div>
              <span className="font-mono text-xs font-bold text-slate-300">
                Terminal Emulator — Execution Environment
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#00FF9D] bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FF9D] animate-pulse" />
                INFRASTRUCTURE ONLINE
              </span>
              <button
                onClick={() => {
                  setIsRoot(false);
                  setTerminalHistory([
                    'CyberRange Secure Linux Sandbox v1.08',
                    'Type "help" to see available commands.',
                    'operator@cyberrange-sandbox:~$ ',
                  ]);
                }}
                className="hover:text-white p-1 hover:bg-slate-800 rounded-md transition-colors text-slate-400"
                title="Reset console state"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Terminal output */}
          <div className="flex-1 p-5 overflow-y-auto font-mono text-xs text-[#00FF9D] space-y-2 selection:bg-blue-900 selection:text-white">
            {terminalHistory.map((line, idx) => (
              <div key={idx} className="whitespace-pre-wrap leading-relaxed">{line}</div>
            ))}
            <div ref={terminalBottomRef} />
          </div>

          {/* Terminal input */}
          <form
            onSubmit={handleCommandSubmit}
            className="h-11 bg-[#0F172A] border-t border-slate-800 flex items-center px-4 flex-shrink-0"
          >
            <span className="font-mono text-xs text-[#00FF9D] font-bold mr-2 flex-shrink-0">
              {isRoot ? 'root@cyberrange-sandbox:~#' : 'operator@cyberrange-sandbox:~$'}
            </span>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-[#00FF9D] focus:ring-0 placeholder-slate-600"
              placeholder='Type commands here... (e.g. "help", "ls", "nmap 10.10.12.5")'
              autoFocus
            />
          </form>
        </div>
      </div>

      {/* Module / Lab Completion Popup Modal */}
      {completionModal && completionModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-extrabold tracking-widest uppercase text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                {completionModal.isLastModule ? '🎉 LAB COMPLETED!' : `MODULE ${completionModal.moduleNum} COMPLETED!`}
              </span>
              <h2 className="text-xl font-bold text-white leading-tight">
                {completionModal.moduleTitle}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {completionModal.isLastModule
                  ? `Congratulations! You solved all modules in ${labTitle}!`
                  : `You successfully completed Module ${completionModal.moduleNum}. Next module has been unlocked.`}
              </p>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs">
              <div className="text-left space-y-1">
                <div className="text-slate-400 font-semibold">Module Score: <span className="text-emerald-400 font-bold">+{completionModal.points} pts</span></div>
                <div className="text-slate-400 font-semibold">Total Score: <span className="text-blue-400 font-bold">{completionModal.totalScore} pts</span></div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-slate-400 font-semibold">Challenges: <span className="text-white font-bold">{completionModal.challengesCompleted}/{completionModal.totalChallenges}</span></div>
                <div className="text-slate-400 font-semibold">Accuracy: <span className="text-amber-400 font-bold">{completionModal.accuracy}</span></div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2.5 pt-2">
              {!completionModal.isLastModule ? (
                <>
                  <button
                    onClick={() => {
                      setCompletionModal(null);
                      if (activeChallengeIdx < currentModules.length - 1) {
                        setActiveChallengeIdx((prev) => prev + 1);
                      }
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
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
                    onClick={() => handleShareAchievement({ labTitle, totalScore: completionModal.totalScore, username: user?.name || user?.email || 'Student' })}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4" /> Share Achievement & Download Card
                  </button>
                  <button
                    onClick={() => {
                      setCompletionModal(null);
                      navigate('/labs');
                    }}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all"
                  >
                    Return to Available Labs
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
