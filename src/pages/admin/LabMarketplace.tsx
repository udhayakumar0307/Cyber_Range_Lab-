import React, { useState } from 'react';
import type { SecurityLab } from '../../types/admin';
import { LabDetailModal } from '../../components/admin/LabDetailModal';
import { 
  Store, 
  Search, 
  Clock, 
  Star, 
  ShoppingCart, 
  ShieldCheck, 
  Layers, 
  SlidersHorizontal
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const LabMarketplace: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'marketplace' | 'inventory'>('marketplace');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'popularity' | 'price-asc' | 'price-desc' | 'difficulty'>('popularity');

  const [selectedModalLab, setSelectedModalLab] = useState<SecurityLab | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mock catalog labs
  const mockLabs: SecurityLab[] = [
    {
      id: 'lab-aws-01',
      title: 'AWS Security Architecture & Exploitation',
      shortDescription: 'Audit IAM policies, exploit S3 bucket misconfigurations, and analyze CloudTrail forensic logs.',
      fullDescription: 'Comprehensive hands-on security challenge covering AWS cloud infrastructure vulnerability analysis. Practice real-world exploit mitigation, identity access policy auditing, and automated detection rule setup.',
      difficulty: 'Advanced',
      category: 'Cloud Infrastructure Security',
      priceInr: 24999,
      durationHours: 4,
      rating: 4.9,
      reviewCount: 142,
      prerequisites: ['Basic AWS CLI familiarity', 'JSON IAM schema understanding'],
      skillsCovered: ['IAM Policy Auditing', 'S3 Misconfiguration Detection', 'CloudTrail Log Forensics'],
      isPurchased: true,
      purchasedDate: '2026-05-12',
      assignedGroupCount: 3,
      modules: [
        { id: 'm1', title: 'Exploiting Public Bucket Permissions', durationMinutes: 45, points: 250 },
        { id: 'm2', title: 'Escalating Privileges via Misconfigured Roles', durationMinutes: 60, points: 350 },
        { id: 'm3', title: 'CloudTrail Event Investigation', durationMinutes: 45, points: 300 },
      ],
    },
    {
      id: 'lab-web-01',
      title: 'OWASP Top 10 Exploitation & Defense',
      shortDescription: 'Identify and mitigate SQL Injections, XSS, SSRF, and Broken Access Controls in web apps.',
      fullDescription: 'Interactive lab simulating real modern web vulnerabilities. Attack sandboxed e-commerce applications and implement remediation code patches in real time.',
      difficulty: 'Intermediate',
      category: 'Web Application Security',
      priceInr: 16499,
      durationHours: 3,
      rating: 4.8,
      reviewCount: 310,
      prerequisites: ['HTTP protocol basics', 'HTML/JS fundamentals'],
      skillsCovered: ['SQLi Mitigation', 'Reflected XSS Remediation', 'SSRF Payload Bypass'],
      isPurchased: true,
      purchasedDate: '2026-06-01',
      assignedGroupCount: 5,
      modules: [
        { id: 'm1', title: 'Blind SQL Injection Extraction', durationMinutes: 45, points: 200 },
        { id: 'm2', title: 'Bypassing WAF with Encoded Payloads', durationMinutes: 45, points: 250 },
        { id: 'm3', title: 'Server-Side Request Forgery Exfiltration', durationMinutes: 50, points: 300 },
      ],
    },
    {
      id: 'lab-net-01',
      title: 'Network Traffic Forensics & PCAP Analysis',
      shortDescription: 'Analyze Wireshark packet captures to isolate C2 server malware communication.',
      fullDescription: 'Investigate enterprise PCAP network dumps under SOC scenario conditions. Filter DNS tunneling attacks, decrypt TLS streams, and reconstruct payload drops.',
      difficulty: 'Intermediate',
      category: 'Network Forensics & SOC',
      priceInr: 12499,
      durationHours: 2.5,
      rating: 4.7,
      reviewCount: 98,
      prerequisites: ['TCP/IP stack knowledge', 'Wireshark filter syntax'],
      skillsCovered: ['Packet Inspection', 'DNS Tunneling Analysis', 'TLD Beacon Identification'],
      isPurchased: false,
      modules: [
        { id: 'm1', title: 'Isolating Anomaly Beaconing Interval', durationMinutes: 40, points: 150 },
        { id: 'm2', title: 'Reconstructing Exfiltrated Data Stream', durationMinutes: 50, points: 250 },
      ],
    },
    {
      id: 'lab-mal-01',
      title: 'Reverse Engineering & Malware Decompilation',
      shortDescription: 'Disassemble malicious PE binaries in Ghidra and extract C2 configuration strings.',
      fullDescription: 'Deep technical malware analysis lab. Analyze obfuscated ransomware samples, reverse engineer assembly execution paths, and craft YARA threat hunting signatures.',
      difficulty: 'Expert',
      category: 'Reverse Engineering & Malware',
      priceInr: 41499,
      durationHours: 6,
      rating: 4.95,
      reviewCount: 64,
      prerequisites: ['x86/x64 assembly understanding', 'Debugger experience'],
      skillsCovered: ['Ghidra Decompilation', 'YARA Rule Authoring', 'Anti-Analysis Bypass'],
      isPurchased: false,
      modules: [
        { id: 'm1', title: 'Unpacking XOR Payload Obfuscation', durationMinutes: 90, points: 500 },
        { id: 'm2', title: 'Decompiling Keylogger Dispatch Hooks', durationMinutes: 90, points: 600 },
        { id: 'm3', title: 'Writing Enterprise YARA Rules', durationMinutes: 60, points: 400 },
      ],
    },
    {
      id: 'lab-k8s-01',
      title: 'Kubernetes Cluster Container Hacking',
      shortDescription: 'Break out of container runtime namespaces and gain root on K8s master node.',
      fullDescription: 'Attack misconfigured Kubernetes control planes, exploit vulnerable service accounts, and demonstrate container breakout techniques in live isolated cluster nodes.',
      difficulty: 'Advanced',
      category: 'Cloud Infrastructure Security',
      priceInr: 28999,
      durationHours: 4.5,
      rating: 4.88,
      reviewCount: 115,
      prerequisites: ['Docker container basics', 'kubectl usage'],
      skillsCovered: ['Container Escape', 'RBAC Misconfig Exploitation', 'Kubelet API Hijacking'],
      isPurchased: false,
      modules: [
        { id: 'm1', title: 'Service Account Token Theft', durationMinutes: 45, points: 300 },
        { id: 'm2', title: 'Exploiting Host Path Mount Privileges', durationMinutes: 60, points: 400 },
      ],
    },
  ];

  // Filter & Sort Logic
  const categories = ['All', 'Cloud Infrastructure Security', 'Web Application Security', 'Network Forensics & SOC', 'Reverse Engineering & Malware'];
  const difficulties = ['All', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

  const filteredLabs = mockLabs.filter((lab) => {
    const matchesTab = activeTab === 'marketplace' ? true : lab.isPurchased;
    const matchesSearch =
      lab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = selectedDifficulty === 'All' || lab.difficulty === selectedDifficulty;
    const matchesCategory = selectedCategory === 'All' || lab.category === selectedCategory;
    return matchesTab && matchesSearch && matchesDifficulty && matchesCategory;
  });

  const sortedLabs = [...filteredLabs].sort((a, b) => {
    if (sortBy === 'price-asc') return a.priceInr - b.priceInr;
    if (sortBy === 'price-desc') return b.priceInr - a.priceInr;
    if (sortBy === 'difficulty') return a.difficulty.localeCompare(b.difficulty);
    return b.rating - a.rating; // Popularity default
  });

  const handleOpenDetailModal = (lab: SecurityLab) => {
    setSelectedModalLab(lab);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Store className="w-7 h-7 text-[#0052CC]" />
            Lab Marketplace & Inventory Catalog
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse available security training labs, procure enterprise licenses, and assign labs to groups.
          </p>
        </div>

        {/* Catalog vs Inventory Tab Switcher */}
        <div className="flex items-center bg-slate-200/80 p-1 rounded-xl self-start sm:self-auto font-semibold text-xs">
          <button
            onClick={() => setActiveTab('marketplace')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'marketplace'
                ? 'bg-white text-[#0052CC] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-4 h-4" />
            Marketplace Catalog ({mockLabs.length})
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'inventory'
                ? 'bg-white text-[#0052CC] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#28A745]" />
            Purchased Inventory ({mockLabs.filter((l) => l.isPurchased).length})
          </button>
        </div>
      </div>

      {/* 3.1 Search & Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Bar Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search labs by title, skill, or keyword..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20 focus:border-[#0052CC]"
            />
          </div>

          {/* Difficulty Dropdown Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
            >
              <option value="All">All Difficulty Levels</option>
              {difficulties.filter((d) => d !== 'All').map((diff) => (
                <option key={diff} value={diff}>
                  {diff} Level
                </option>
              ))}
            </select>
          </div>

          {/* Category Dropdown Filter */}
          <div className="md:col-span-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
            >
              <option value="All">All Security Domains</option>
              {categories.filter((c) => c !== 'All').map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort Controls Sub-Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-semibold">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Showing <span className="text-slate-800 font-bold">{sortedLabs.length}</span> security labs
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Sort Catalog By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="py-1 px-2.5 bg-slate-100 border border-slate-200 rounded-md text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="popularity">Highest Rating & Popularity</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="difficulty">Difficulty Level</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3.3 Lab Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedLabs.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300">
            <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">No Security Labs Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Try adjusting your search criteria or clearing selected difficulty and category filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDifficulty('All');
                setSelectedCategory('All');
              }}
              className="mt-4 px-4 py-2 bg-blue-50 text-[#0052CC] font-bold text-xs rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          sortedLabs.map((lab) => {
            const difficultyBadgeColors = {
              Beginner: 'bg-emerald-50 text-[#28A745] border-emerald-200',
              Intermediate: 'bg-blue-50 text-[#0052CC] border-blue-200',
              Advanced: 'bg-amber-50 text-amber-700 border-amber-200',
              Expert: 'bg-purple-50 text-[#6F42C1] border-purple-200',
            };

            return (
              <div
                key={lab.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Header Top */}
                <div className="p-5 border-b border-slate-100 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full truncate max-w-[180px]">
                      {lab.category}
                    </span>
                    <span
                      className={`text-[11px] font-bold border px-2.5 py-0.5 rounded-full ${
                        difficultyBadgeColors[lab.difficulty]
                      }`}
                    >
                      {lab.difficulty}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 group-hover:text-[#0052CC] transition-colors line-clamp-1">
                    {lab.title}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {lab.shortDescription}
                  </p>
                </div>

                {/* Card Body Details */}
                <div className="p-5 bg-slate-50/50 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {lab.durationHours} Hours
                    </span>
                    <span className="flex items-center gap-1 text-amber-500 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {lab.rating} ({lab.reviewCount})
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      {lab.modules.length} Modules
                    </span>
                  </div>

                  {/* Skills tags preview */}
                  <div className="flex flex-wrap gap-1">
                    {lab.skillsCovered.slice(0, 2).map((skill, idx) => (
                      <span
                        key={idx}
                        className="bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                    {lab.skillsCovered.length > 2 && (
                      <span className="text-[10px] text-slate-400 font-semibold px-1">
                        +{lab.skillsCovered.length - 2} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Base Price
                    </span>
                    <span className="text-lg font-black text-slate-900">₹{lab.priceInr.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenDetailModal(lab)}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors"
                    >
                      Details
                    </button>

                    {lab.isPurchased ? (
                      <button
                        onClick={() => navigate('/admin/allocations')}
                        className="px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#28A745] font-bold text-xs border border-emerald-200 transition-colors inline-flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Allocate
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate(`/admin/labs/${lab.id}/purchase`)}
                        className="px-3 py-2 rounded-lg bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-1"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Buy Lab
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Lab Detail Modal Component */}
      <LabDetailModal
        lab={selectedModalLab}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};
