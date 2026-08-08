import React, { useState } from 'react';
import { Book, Search, Download, ExternalLink, FileText, CheckCircle, Clock } from 'lucide-react';

interface NoteItem {
  id: string;
  title: string;
  category: string;
  description: string;
  readTime: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  lastUpdated: string;
  pdfUrl?: string;
  content: string[];
}

const STUDY_MATERIALS: NoteItem[] = [
  {
    id: 'command-line-guide',
    title: 'Command Line & Linux Administration Study Guide',
    category: 'System Security',
    description: 'Comprehensive study guide covering Linux command line navigation, file permissions, shell scripting, process management, and admin utilities.',
    readTime: '20 min read',
    difficulty: 'Beginner',
    lastUpdated: 'Aug 2026',
    pdfUrl: '/study-materials/command-line-study-guide.pdf',
    content: [
      'Linux Shell Essentials: Master navigation (cd, ls, pwd), file creation (touch, mkdir), and file manipulation (cp, mv, rm).',
      'Permissions & Ownership: Understand chmod (755, 644), chown, and special SUID/SGID executable flags.',
      'Process & Network Monitoring: Monitor active processes using ps, top, htop, and network sockets using netstat / ss.',
      'Text Processing: Master grep, sed, awk, cut, and piping constructs for log analysis.',
      'Shell Automation: Writing bash scripts for automated system maintenance and log rotation.'
    ]
  },
  {
    id: 'cryptography-guide',
    title: 'Cryptography & Network Security Study Guide',
    category: 'Cryptography',
    description: 'Essential guide on symmetric/asymmetric encryption, hashing algorithms (SHA-256, MD5), RSA key pairs, and TLS/SSL handshake mechanisms.',
    readTime: '25 min read',
    difficulty: 'Intermediate',
    lastUpdated: 'Aug 2026',
    pdfUrl: '/study-materials/cryptography-study-guide.pdf',
    content: [
      'Symmetric Encryption: Fundamentals of AES (Advanced Encryption Standard) and DES block ciphers using shared secret keys.',
      'Asymmetric Encryption: Public-key cryptography (RSA, ECC) for digital signatures and key exchange protocols.',
      'Cryptographic Hashing: One-way functions (SHA-256, SHA-3) for data integrity verification and password hashing (bcrypt, Argon2).',
      'Public Key Infrastructure (PKI): X.509 digital certificates, Certificate Authorities (CAs), and SSL/TLS secure communication channels.',
      'Cryptanalysis & Common Flaws: Weak key detection, replay attacks, and side-channel vulnerability mitigations.'
    ]
  },
  {
    id: 'ot-railroad-guide',
    title: 'OT & Railroad Industrial Control Systems Security Study Guide',
    category: 'Industrial Systems',
    description: 'Specialized study guide on Operational Technology (OT), SCADA networks, railway signaling protocols, Modbus/DNP3, and industrial cybersecurity.',
    readTime: '30 min read',
    difficulty: 'Advanced',
    lastUpdated: 'Aug 2026',
    pdfUrl: '/study-materials/ot-railroad-study-guide.pdf',
    content: [
      'Operational Technology (OT) & ICS: Infrastructure overview of PLCs, RTUs, HMIs, and SCADA control loops in transport networks.',
      'Railroad Signaling Protocols: Analysis of track circuit telemetry, interlocking control logic, and automatic train control (ATC) security.',
      'Industrial Protocol Security: Vulnerability assessment of Modbus TCP, DNP3, and Ethernet/IP protocols lacking native authentication.',
      'Network Segmentation: Purdue Model partitioning, industrial firewall zones, and unidirectional data diodes for safety-critical systems.',
      'ICS Incident Response: Forensic analysis of PLC ladder logic tamper attempts and anomaly detection in OT network traffic.'
    ]
  },
  {
    id: 'active-directory-sec',
    title: 'Active Directory Security & Pentesting Notes',
    category: 'Network Security',
    description: 'Core concepts on Active Directory architecture, Kerberos attacks (Golden/Silver Ticket), LLMNR/NBT-NS poisoning, and Domain Dominance defense strategies.',
    readTime: '25 min read',
    difficulty: 'Advanced',
    lastUpdated: 'Aug 2026',
    content: [
      'Active Directory (AD) serves as the primary authentication and authorization mechanism in enterprise environments.',
      'Kerberoasting Attack: Targeting service accounts with weak passwords to extract service ticket hashes and crack them offline.',
      'AS-REP Roasting: Targeting accounts without Kerberos Pre-authentication enabled to obtain AS-REP ticket replies and crack hashes.',
      'Golden Ticket Attack: Forging a Kerberos Ticket Granting Ticket (TGT) using the KRBTGT NTLM hash to gain full domain admin access.',
      'Defensive Mitigation: Restrict administrator group membership, use strong unique passwords for service accounts, enable Kerberos Armoring (FAST), and monitor for anomalous ticket requests.'
    ]
  },
  {
    id: 'web-owasp-top-10',
    title: 'OWASP Top 10 Deep-Dive & Mitigation Notes',
    category: 'Web Security',
    description: 'Detailed analysis of Broken Object Level Authorization (BOLA), SQL Injection, Cross-Site Scripting (XSS), SSRF, and secure coding mitigation techniques.',
    readTime: '15 min read',
    difficulty: 'Intermediate',
    lastUpdated: 'Jul 2026',
    content: [
      'OWASP Top 10 lists the most critical security risks to web applications.',
      'Broken Object Level Authorization (BOLA): Occurs when an application does not validate if the user has authorization to access the specific object requested (IDOR).',
      'SQL Injection (SQLi): Injecting malicious SQL commands into input fields to bypass authentication or extract backend database information.',
      'Server-Side Request Forgery (SSRF): Forcing the server to make unauthorized requests to internal resources or external services.',
      'Secure Coding Standard: Always sanitize user input, use parameterized queries, enforce strict server-side authorization checks, and implement content security policies (CSP).'
    ]
  }
];

export const StudyMaterial: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);

  const categories = ['All', ...Array.from(new Set(STUDY_MATERIALS.map(item => item.category)))];

  const filteredMaterials = STUDY_MATERIALS.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Book className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Study Materials & Domain Notes
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Access curated reference notes, cybersecurity playbooks, and OT/ICS domain documentation.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-8 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search notes, playbooks, keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                selectedCategory === category
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Material Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredMaterials.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              {/* Card Badge Header */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                  {item.category}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  item.difficulty === 'Advanced'
                    ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400'
                    : item.difficulty === 'Intermediate'
                    ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {item.difficulty}
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="text-base font-bold text-slate-950 dark:text-white mb-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                {item.title}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed mb-4">
                {item.description}
              </p>
            </div>

            {/* Bottom Info & Action buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
              <div className="flex items-center gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {item.readTime}
                </span>
                <span>• Updated {item.lastUpdated}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveNote(item)}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  View Notes
                </button>
                {item.pdfUrl ? (
                  <a
                    href={item.pdfUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all inline-flex items-center"
                    title={`Download ${item.title} PDF`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <button
                    onClick={() => alert(`Downloading ${item.title} PDF playbook...`)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                    title="Download PDF version"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredMaterials.length === 0 && (
          <div className="col-span-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
            <Book className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No study materials found</h3>
            <p className="text-xs text-slate-400 mt-1">Try refining your keyword search or filtering other domains.</p>
          </div>
        )}
      </div>

      {/* Reader Modal / Drawer */}
      {activeNote && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start gap-4">
              <div>
                <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                  {activeNote.category}
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{activeNote.title}</h2>
              </div>
              <button
                onClick={() => setActiveNote(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs text-slate-500 dark:text-slate-400 italic">
                {activeNote.description}
              </div>
              
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Key Study Bulletins & Commands</h4>
                {activeNote.content.map((point, index) => (
                  <div key={index} className="flex gap-3 items-start text-sm text-slate-700 dark:text-slate-300">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
              <span className="text-xs text-slate-400">Estimated read time: {activeNote.readTime}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveNote(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-all"
                >
                  Close Reader
                </button>
                {activeNote.pdfUrl ? (
                  <a
                    href={activeNote.pdfUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </a>
                ) : (
                  <button
                    onClick={() => alert(`Downloading ${activeNote.title} PDF playbook...`)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
