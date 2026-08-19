import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
   ShieldCheck,
   Key,
   Lock,
   Database,
   Activity,
   Server,
   Search,
   FileText,
   Users,
   Building2,
   CreditCard,
   AlertTriangle,
   ChevronLeft,
   ChevronRight,
   LogOut,
   RefreshCw,
   CheckCircle2,
   Plus,
   GraduationCap,
   Eye,
   BookOpen,
   Trash2,
   Radar as RadarIcon,
   Clock
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';

// Severity → color mapping shared by the SOC ring and the timeline bars,
// matching the badge colors already used in the alerts table.
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#e11d48', // rose-600
  HIGH: '#f97316',      // orange-500
  MEDIUM: '#eab308',    // yellow-500
  LOW: '#94a3b8',        // slate-400
};

export const SystemPortal: React.FC = () => {
  const navigate = useNavigate();

  // Portal Security State
  const [step, setStep] = useState<'key' | 'login' | 'dashboard'>('key');
  const [securityKey, setSecurityKey] = useState('');
  const [keyError, setKeyError] = useState('');
  const [keyLoading, setKeyLoading] = useState(false);

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // System Dashboard & Viewer State
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as any) || 'dashboard';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'colleges' | 'orgs' | 'students' | 'audit_logs' | 'db_viewer'>(initialTab);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dashLoading, setDashLoading] = useState(false);

  // College State
  const [colleges, setColleges] = useState<any[]>([]);
  const [collegesLoading, setCollegesLoading] = useState(false);
  const [isCollegeModalOpen, setIsCollegeModalOpen] = useState(false);
  const [newCollegeName, setNewCollegeName] = useState('');
  const [newCollegeCode, setNewCollegeCode] = useState('');
  const [newCollegeCity, setNewCollegeCity] = useState('');
  const [newCollegeState, setNewCollegeState] = useState('');
  const [newCollegeEmail, setNewCollegeEmail] = useState('');
  const [newCollegeWebsite, setNewCollegeWebsite] = useState('');

  // Organization Extra Modals State
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [orgPurchases, setOrgPurchases] = useState<any[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);

  // Manual Lab Allocation State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [formLabId, setFormLabId] = useState('');
  const [formLabTitle, setFormLabTitle] = useState('');
  const [formHours, setFormHours] = useState<number>(9999);
  const [formLabLevel, setFormLabLevel] = useState<'beginner' | 'intermediate' | 'advanced' | 'custom'>('beginner');
  const [formPricePerHour, setFormPricePerHour] = useState<number>(100);
  const [formAssignTarget, setFormAssignTarget] = useState<'org' | 'student' | 'both'>('org');
  const [formStudentId, setFormStudentId] = useState<string>('');
  const [formOrgId, setFormOrgId] = useState<string>('');
  const [allLabs, setAllLabs] = useState<any[]>([]);
  const [allocatedLabs, setAllocatedLabs] = useState<any[]>([]);
  const [allocatedLabsLoading, setAllocatedLabsLoading] = useState(false);

  // Student list & Analytics State
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentPage, setStudentPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [selectedStudentAnalytics, setSelectedStudentAnalytics] = useState<any>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

  // DB Viewer State
  const [selectedTable, setSelectedTable] = useState('users');
  const [dbData, setDbData] = useState<any>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbSearch, setDbSearch] = useState('');
  const [dbPage, setDbPage] = useState(1);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [totalAuditLogs, setTotalAuditLogs] = useState(0);

  // New Labs pricing and catalog views
  const [labSubTab, setLabSubTab] = useState<'pending' | 'active'>('pending');
  const [labPrices, setLabPrices] = useState<Record<string, number>>({});
  const [labsTabMode, setLabsTabMode] = useState<'catalog' | 'arrivals' | 'assigned'>('catalog');
  
  // Custom Revoke / Remove Lab modal states
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [selectedLabForRemoval, setSelectedLabForRemoval] = useState<any>(null);
  const [removeTargetType, setRemoveTargetType] = useState<'student' | 'admin' | 'both' | 'catalog'>('student');

  // Edit Lab Price modal states
  const [isEditPriceModalOpen, setIsEditPriceModalOpen] = useState(false);
  const [editingAllocatedLab, setEditingAllocatedLab] = useState<any>(null);
  const [newFixedRate, setNewFixedRate] = useState<number>(0);

  // Check existing session token on mount
  useEffect(() => {
    const isKeyVerified = sessionStorage.getItem('system_key_verified') === 'true';
    const token = localStorage.getItem('token');
    const storedUserStr = localStorage.getItem('user');

    if (isKeyVerified) {
      setStep('login');
      if (token && storedUserStr) {
        try {
          const u = JSON.parse(storedUserStr);
          if (['SYSTEM_ADMIN', 'SUPER_ADMIN'].includes((u.role || '').toUpperCase())) {
            setStep('dashboard');
          }
        } catch (e) {}
      }
    }
  }, []);

  // Fetch Dashboard Data
  const fetchDashboard = async () => {
    setDashLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/system/dashboard', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      } else if (res.status === 403) {
        setLoginError('Access Denied. You must log in with a SYSTEM_ADMIN role account.');
        setStep('login');
      }
    } catch (err) {
      console.error('Failed to load system dashboard:', err);
    } finally {
      setDashLoading(false);
    }
  };

  // Fetch Colleges Data
  const fetchColleges = async () => {
    setCollegesLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/system/colleges', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setColleges(await res.json());
      }
    } catch (err) {
      console.error('Failed to load colleges:', err);
    } finally {
      setCollegesLoading(false);
    }
  };

  // Fetch Students Data
  const fetchStudents = async (page: number = 1, search: string = '') => {
    setStudentsLoading(true);
    const token = localStorage.getItem('token');
    try {
      const url = `/api/v1/system/users?page=${page}&limit=10${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data.users || []);
        setTotalStudents(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setStudentsLoading(false);
    }
  };

  // Fetch Audit Logs Data
  const fetchAuditLogs = async (page: number = 1, search: string = '') => {
    setAuditLoading(true);
    const token = localStorage.getItem('token');
    try {
      const url = `/api/v1/system/audit-logs?page=${page}&limit=10${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.audit_logs || []);
        setTotalAuditLogs(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  // Fetch Database Viewer Data
  const fetchTableData = async (table: string, page: number = 1, search: string = '') => {
    setDbLoading(true);
    const token = localStorage.getItem('token');
    try {
      const url = `/api/v1/system/database-viewer?table_name=${table}&page=${page}&limit=15${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setDbData(data);
      }
    } catch (err) {
      console.error('Failed to load DB table viewer:', err);
    } finally {
      setDbLoading(false);
    }
  };

  const fetchLabs = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/system/labs?limit=100', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        const labsArr = data.labs || [];
        setAllLabs(labsArr);
        
        // Populate labPrices map
        const initialPrices: Record<string, number> = {};
        labsArr.forEach((l: any) => {
          initialPrices[l.id] = l.price_per_hour || 100.0;
        });
        setLabPrices(initialPrices);
      }
    } catch (err) {
      console.error('Failed to load system labs:', err);
    }
  };

  const fetchAllocatedLabs = async () => {
    setAllocatedLabsLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/system/database-viewer?table_name=purchased_labs&limit=100', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setAllocatedLabs(data.rows || []);
      }
    } catch (err) {
      console.error('Failed to load allocated labs:', err);
    } finally {
      setAllocatedLabsLoading(false);
    }
  };

  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);

  const fetchSecurityAlerts = async () => {
    setSecurityLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/system/security-alerts', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setSecurityAlerts(await res.json());
      }
    } catch (err) {
      console.error('Failed to load security alerts:', err);
    } finally {
      setSecurityLoading(false);
    }
  };

  // SOC ring: breakdown of alerts by severity, with blocked (RESOLVED) vs
  // active (UNRESOLVED) counts per slice — derived client-side from the
  // already-fetched securityAlerts, no extra API calls needed.
  const severityBreakdown = useMemo(() => {
    const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const counts: Record<string, number> = {};
    securityAlerts.forEach((a) => {
      const sev = (a.severity || 'LOW').toUpperCase();
      counts[sev] = (counts[sev] || 0) + 1;
    });
    const breakdown = order
      .filter((sev) => counts[sev])
      .map((sev) => ({ name: sev, value: counts[sev], color: SEVERITY_COLORS[sev] || '#94a3b8' }));
    // Fallback slice so the ring never renders blank when the platform is quiet.
    return breakdown.length > 0
      ? breakdown
      : [{ name: 'ALL CLEAR', value: 1, color: '#d1fae5' }];
  }, [securityAlerts]);

  const blockedStats = useMemo(() => {
    const total = securityAlerts.length;
    const blocked = securityAlerts.filter((a) => a.status === 'RESOLVED').length;
    return { total, blocked, active: total - blocked };
  }, [securityAlerts]);

  // Timeline: alerts bucketed by hour (last 24 buckets), stacked by severity —
  // gives a SOC-style "activity over time" view of DDoS / brute force / RBAC events.
  const alertTimeline = useMemo(() => {
    const buckets: Record<string, any> = {};
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      const key = `${String(d.getHours()).padStart(2, '0')}:00`;
      buckets[key] = { hour: key, CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    }
    securityAlerts.forEach((a) => {
      if (!a.timestamp) return;
      const d = new Date(a.timestamp.replace(' ', 'T'));
      if (isNaN(d.getTime())) return;
      const key = `${String(d.getHours()).padStart(2, '0')}:00`;
      if (buckets[key]) {
        const sev = (a.severity || 'LOW').toUpperCase();
        buckets[key][sev] = (buckets[key][sev] || 0) + 1;
      }
    });
    return Object.values(buckets);
  }, [securityAlerts]);

  const handleResolveAlert = async (alertId: number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/system/security-alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchSecurityAlerts();
      }
    } catch (err) {
      console.error('Failed to resolve security alert:', err);
    }
  };

  const handleApproveLab = async (labId: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/system/labs/${labId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Lab approved successfully!");
        fetchLabs();
      }
    } catch (err) {
      console.error('Failed to approve lab:', err);
    }
  };

  const handleSaveLabPrice = async (labId: string, price: number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/system/labs/${labId}/update-price`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ price_per_hour: price })
      });
      if (res.ok) {
        alert("Hourly price updated successfully!");
        fetchLabs();
      } else {
        alert("Failed to update pricing.");
      }
    } catch (err) {
      console.error('Failed to update lab pricing:', err);
    }
  };

  const handleDeleteLab = async (labId: string) => {
    if (!window.confirm("Are you absolutely sure you want to permanently delete this lab?")) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/system/labs/${labId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Lab deleted successfully!");
        fetchLabs();
      } else {
        alert("Failed to delete lab.");
      }
    } catch (err) {
      console.error('Failed to delete lab:', err);
    }
  };

  const handleRemoveLabAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLabForRemoval) return;

    const token = localStorage.getItem('token');
    try {
      if (removeTargetType === 'student' || removeTargetType === 'both') {
        await fetch(`/api/v1/system/organizations/0/revoke-lab`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ lab_id: selectedLabForRemoval.id })
        });
      }

      if (removeTargetType === 'admin' || removeTargetType === 'both') {
        const orgsToRevoke = allocatedLabs
          .filter((l: any) => l.lab_id === selectedLabForRemoval.id && l.organization_id)
          .map((l: any) => l.organization_id);
        for (const orgId of orgsToRevoke) {
          await fetch(`/api/v1/system/organizations/${orgId}/revoke-lab`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ lab_id: selectedLabForRemoval.id })
          });
        }
      }

      if (removeTargetType === 'catalog') {
        await fetch(`/api/v1/system/labs/${selectedLabForRemoval.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      setIsRemoveModalOpen(false);
      alert("Lab removal action completed successfully!");
      fetchLabs();
      fetchAllocatedLabs();
    } catch (err) {
      console.error('Failed to remove lab:', err);
    }
  };

  const handleSaveFixedRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAllocatedLab) return;

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/system/purchased-labs/${editingAllocatedLab.id}/fixed-rate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ fixed_rate: newFixedRate })
      });
      if (res.ok) {
        setIsEditPriceModalOpen(false);
        fetchAllocatedLabs();
        alert("Fixed rate updated successfully!");
      } else {
        alert("Failed to update fixed rate.");
      }
    } catch (err) {
      console.error('Failed to update fixed rate:', err);
    }
  };

  useEffect(() => {
    if (step === 'dashboard') {
      if (activeTab === 'dashboard') {
        fetchDashboard();
      } else if (activeTab === 'colleges') {
        fetchColleges();
      } else if (activeTab === 'orgs') {
        fetchDashboard(); // Orgs list is loaded from dashboard counters.organizations
      } else if (activeTab === 'students') {
        fetchStudents(studentPage, studentSearch);
      } else if (activeTab === 'audit_logs') {
        fetchAuditLogs(auditPage, auditSearch);
      } else if (activeTab === 'db_viewer') {
        fetchTableData(selectedTable, dbPage, dbSearch);
      } else if (activeTab === 'labs' as any) {
        fetchAllocatedLabs();
        fetchLabs();
        fetchStudents(1, '');
        fetchDashboard();
      } else if (activeTab === 'security_telemetry' as any) {
        fetchSecurityAlerts();
      }
    }
  }, [step, activeTab, selectedTable, dbPage, studentPage, auditPage]);

  // Handler 1: Security Key Submit
  const handleVerifyKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError('');
    setKeyLoading(true);

    try {
      const res = await fetch('/api/v1/system/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ security_key: securityKey })
      });

      const data = await res.json();
      if (res.ok && data.verified) {
        sessionStorage.setItem('system_key_verified', 'true');
        setStep('login');
      } else {
        setKeyError(data.detail || 'Invalid Security Key');
      }
    } catch (err) {
      setKeyError('Verification service unavailable. Please check backend connection.');
    } finally {
      setKeyLoading(false);
    }
  };

  // Handler 2: System Admin Login Submit
  const handleSystemLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (res.ok && data.token) {
        const user = data.user || {};
        const userRole = (user.role || '').toUpperCase();

        if (!['SYSTEM_ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
          setLoginError('HTTP 403 Forbidden: Account lacks SYSTEM_ADMIN role permissions.');
          return;
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(user));
        setStep('dashboard');
      } else {
        setLoginError(data.detail || 'Invalid credentials.');
      }
    } catch (err) {
      setLoginError('Authentication failed. Please verify server status.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('system_key_verified');
    setStep('key');
  };

  // Create College
  const handleCreateCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollegeName) return;

    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/system/colleges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newCollegeName,
          code: newCollegeCode,
          city: newCollegeCity,
          state: newCollegeState,
          email: newCollegeEmail,
          website: newCollegeWebsite
        })
      });
      if (res.ok) {
        setIsCollegeModalOpen(false);
        setNewCollegeName('');
        setNewCollegeCode('');
        setNewCollegeCity('');
        setNewCollegeState('');
        setNewCollegeEmail('');
        setNewCollegeWebsite('');
        fetchColleges();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to create college.');
      }
    } catch (err) {
      console.error('Failed to create college:', err);
    }
  };

  // Toggle Verification of Org Admin
  const handleToggleVerifyOrg = async (orgId: number, isCurrentlyVerified: boolean) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/system/organizations/${orgId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ is_verified: !isCurrentlyVerified })
      });
      if (res.ok) {
        fetchDashboard();
      }
    } catch (err) {
      console.error('Failed to toggle verification:', err);
    }
  };

  // Delete Organization
  const handleDeleteOrg = async (orgId: number) => {
    if (!window.confirm('Are you sure you want to permanently delete this organization?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/system/organizations/${orgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchDashboard();
      }
    } catch (err) {
      console.error('Failed to delete organization:', err);
    }
  };

  // View Org Purchase History
  const openOrgPurchases = async (org: any) => {
    setSelectedOrg(org);
    setIsPurchaseModalOpen(true);
    setPurchasesLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/system/organizations/${org.id}/purchases`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setOrgPurchases(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch org purchase history:', err);
    } finally {
      setPurchasesLoading(false);
    }
  };

  // Manual Lab Assign
  const handleAssignLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabId || !formLabTitle) return;

    const rate = formPricePerHour;
    const totalPrice = formPricePerHour;
    const token = localStorage.getItem('token');

    try {
      let endpoint = `/api/v1/system/organizations/0/assign-lab`;
      let targetUserId: number | null = -1; // Default to all students

      if (formAssignTarget === 'org') {
        endpoint = `/api/v1/system/organizations/-1/assign-lab`;
        targetUserId = null;
      } else if (formAssignTarget === 'both') {
        endpoint = `/api/v1/system/organizations/-2/assign-lab`;
        targetUserId = -1;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          lab_id: formLabId,
          lab_title: formLabTitle,
          hours: 999999.0,
          user_id: targetUserId,
          price_per_hour: rate,
          total_price: totalPrice
        })
      });


      if (res.ok) {
        setIsAssignModalOpen(false);
        setFormLabId('');
        setFormLabTitle('');
        alert(`Lab allocations completed successfully!`);
        fetchDashboard();
        fetchAllocatedLabs();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to complete allocation.');
      }
    } catch (err) {
      console.error('Failed to assign lab manually:', err);
    }
  };

  // Delete User permanently
  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this user from the database? This action cannot be undone.")) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/system/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("User permanently deleted.");
        fetchStudents(studentPage, studentSearch);
        fetchDashboard();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to delete user.');
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  // Manual Lab Revoke
  const handleRevokeLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabId || !selectedOrg) return;

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/system/organizations/${selectedOrg.id}/revoke-lab`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ lab_id: formLabId })
      });
      if (res.ok) {
        setIsRevokeModalOpen(false);
        setFormLabId('');
        alert('Lab revoked successfully!');
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to revoke lab.');
      }
    } catch (err) {
      console.error('Failed to revoke lab manually:', err);
    }
  };

  // View Student Analytics
  const openStudentAnalytics = async (studentId: number) => {
    setIsStudentModalOpen(true);
    setSelectedStudentAnalytics(null);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/system/students/${studentId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedStudentAnalytics(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch student analytics:', err);
    }
  };

  // STEP 1: Security Key Verification UI (Light Theme)
  if (step === 'key') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 text-[#0052CC] flex items-center justify-center mx-auto shadow-sm">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">System Security Gate</h1>
              <p className="text-xs text-slate-500 mt-1">Enter authorized System Admin Security Key to proceed.</p>
            </div>
          </div>

          {keyError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3.5 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{keyError}</span>
            </div>
          )}

          <form onSubmit={handleVerifyKey} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                System Security Key
              </label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={securityKey}
                  onChange={(e) => setSecurityKey(e.target.value)}
                  placeholder="••••••••••••••••"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={keyLoading}
              className="w-full py-3.5 bg-[#0052CC] hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {keyLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Verify Security Key
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // STEP 2: System Admin Login UI (Light Theme)
  if (step === 'login') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center mx-auto shadow-sm">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-block mb-2">
                ✓ Security Key Verified
              </span>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">System Admin Authentication</h1>
              <p className="text-xs text-slate-500 mt-1">Authenticate with your SYSTEM_ADMIN credentials.</p>
            </div>
          </div>

          {loginError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3.5 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleSystemLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                System Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sysadmin@cyberrange.in"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setStep('key')}
                className="text-slate-500 hover:text-slate-700 underline"
              >
                Re-enter Security Key
              </button>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loginLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Log In as System Admin
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // STEP 3: System Admin Portal Dashboard & Unified Governance UI (Light Theme)
  const counters = dashboardData?.counters || {};
  const recentLogs = dashboardData?.recent_activity || [];
  const organizations = dashboardData?.organizations || [];
  const liveUserActivity = dashboardData?.live_user_activity || [];
  const platformSpeed = dashboardData?.platform_speed || { avg_response_ms: 0, requests_tracked: 0, slow_endpoint_count: 0 };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      {/* Top System Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-slate-900">System Admin Portal</h1>
              <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                SYSTEM_ADMIN
              </span>
            </div>
            <p className="text-[11px] text-slate-500">PostgreSQL (AWS RDS) Governance & Database Viewer</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeTab === 'dashboard') fetchDashboard();
              else if (activeTab === 'colleges') fetchColleges();
              else if (activeTab === 'students') fetchStudents(studentPage, studentSearch);
              else if (activeTab === 'audit_logs') fetchAuditLogs(auditPage, auditSearch);
              else if (activeTab === 'db_viewer') fetchTableData(selectedTable, dbPage, dbSearch);
              else if (activeTab === 'labs' as any) { fetchAllocatedLabs(); fetchLabs(); }
              else if (activeTab === 'security_telemetry' as any) fetchSecurityAlerts();
            }}
            className="p-2 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-slate-200 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> End Session
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-slate-200 px-6 flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Activity },
          { id: 'colleges', label: 'Colleges', icon: GraduationCap },
          { id: 'orgs', label: 'Organizations', icon: Building2 },
          { id: 'labs', label: 'Labs', icon: BookOpen },
          { id: 'security_telemetry', label: 'Security Alerts', icon: ShieldCheck },
          { id: 'students', label: 'Students Roster', icon: Users },
          { id: 'db_viewer', label: 'Audit Telemetry', icon: FileText }
        ].map(tab => {
          const IconComp = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setDbPage(1);
                setStudentPage(1);
                setAuditPage(1);
              }}
              className={`px-4 py-3.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600 bg-purple-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <IconComp className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Content Body */}
      <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
        
        {/* TAB 1: System Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Metric Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { title: 'Total Orgs', val: counters.total_organizations, color: 'text-slate-900', bg: 'bg-white' },
                { title: 'Total Admins', val: counters.total_admins, color: 'text-purple-600', bg: 'bg-white' },
                { title: 'Total Students', val: counters.total_users, color: 'text-blue-600', bg: 'bg-white' },
                { title: 'Groups Count', val: counters.total_groups, color: 'text-amber-600', bg: 'bg-white' },
                { title: 'Active Containers', val: counters.total_running_containers, color: 'text-emerald-600', bg: 'bg-white' },
                { title: 'Total Revenue', val: `₹${(counters.total_revenue || 0).toLocaleString()}`, color: 'text-slate-900', bg: 'bg-white' }
              ].map((c, i) => (
                <div key={i} className={`${c.bg} p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1`}>
                  <span className="text-[11px] font-bold text-slate-500">{c.title}</span>
                  <p className={`text-2xl font-black ${c.color}`}>{c.val ?? 0}</p>
                </div>
              ))}
            </div>

            {/* Live User Activity + Platform Usage Speed */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" /> Live User Activity
                  </h3>
                  <span className="text-xs text-slate-500">Distinct active users / hour — last 24h</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={liveUserActivity} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="liveUserFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #E2E8F0' }}
                      labelFormatter={(label) => `Hour: ${label}`}
                      formatter={(value) => [value as number, 'Active users']}
                    />
                    <Area type="monotone" dataKey="active_users" stroke="#2563EB" strokeWidth={2} fill="url(#liveUserFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                    <Server className="w-5 h-5 text-emerald-600" /> Platform Usage Speed
                  </h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block mb-1">Avg. API Response Time</span>
                    <p className={`text-3xl font-black ${platformSpeed.avg_response_ms > 200 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {platformSpeed.avg_response_ms}
                      <span className="text-sm font-bold text-slate-400 ml-1">ms</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block">Requests Tracked</span>
                      <p className="text-lg font-extrabold text-slate-800">{platformSpeed.requests_tracked.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block">Slow Endpoints</span>
                      <p className={`text-lg font-extrabold ${platformSpeed.slow_endpoint_count > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                        {platformSpeed.slow_endpoint_count}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 pt-1">Live since last backend restart — resets on deploy.</p>
                </div>
              </div>
            </div>

            {/* Quick Audit Logs Preview */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-600" /> Recent Events Audit Trail
                </h3>
                <span className="text-xs text-slate-500">Live PostgreSQL Events</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Entity</th>
                      <th className="p-3">Performed By</th>
                      <th className="p-3">IP Address</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {recentLogs.slice(0, 10).map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50/60">
                        <td className="p-3 text-slate-500 font-mono">{log.timestamp}</td>
                        <td className="p-3 font-semibold text-slate-900">{log.action}</td>
                        <td className="p-3 text-purple-600 font-medium">{log.entity}</td>
                        <td className="p-3 text-blue-600">{log.performed_by}</td>
                        <td className="p-3 text-slate-500 font-mono">{log.ip_address}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Colleges Management */}
        {activeTab === 'colleges' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-purple-600" /> Platform Registered Colleges
                </h3>
                <p className="text-xs text-slate-500">Configure and manually add eligible college affiliations</p>
              </div>
              <button
                onClick={() => setIsCollegeModalOpen(true)}
                className="px-4 py-2 bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" /> Add College
              </button>
            </div>

            {collegesLoading ? (
              <div className="text-center py-12 text-slate-500">Loading colleges database...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {colleges.map(c => (
                  <div key={c.id} className="p-5 border border-slate-200 rounded-2xl bg-white space-y-3 shadow-xs hover:border-purple-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">{c.name}</h4>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CODE: {c.code || 'N/A'}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                      <p><strong>Location:</strong> {c.city || 'N/A'}, {c.state || 'N/A'}</p>
                      <p><strong>Email:</strong> {c.email || 'N/A'}</p>
                      <p><strong>Website:</strong> <a href={c.website || '#'} target="_blank" className="text-[#0052CC] hover:underline font-medium">{c.website || 'N/A'}</a></p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Organizations & Governance */}
        {activeTab === 'orgs' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" /> Organizations & Affiliations Governance
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Verify administrator profiles, manage manual hourly allocations, and monitor license limits</p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Organization Name</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Created Date</th>
                    <th className="p-4 text-center">Enrollment Stats</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {organizations.map((org: any) => (
                    <tr key={org.id} className="hover:bg-slate-50/60">
                      <td className="p-4 font-bold text-slate-900">{org.name}</td>
                      <td className="p-4 text-slate-600">{org.institution_type}</td>
                      <td className="p-4 text-slate-500 font-mono">{org.created_at}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <span className="bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-full border border-purple-200">
                            {org.total_users || 0} Members
                          </span>
                          <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                            ₹{(org.total_spent || 0).toLocaleString()} Spent
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleToggleVerifyOrg(org.id, org.is_verified)}
                            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer ${
                              org.is_verified 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {org.is_verified ? 'Verified ✓' : 'Verify'}
                          </button>
                          <button
                            onClick={() => openOrgPurchases(org)}
                            className="px-3 py-1.5 bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-[11px] rounded-lg cursor-pointer transition-colors shadow-xs"
                          >
                            Purchases
                          </button>
                          <button
                            onClick={() => handleDeleteOrg(org.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Delete Organization"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: Security Telemetry Alerts */}
        {activeTab === 'security_telemetry' as any && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-rose-600" /> Platform Security Alerts & Threat Intelligence
              </h3>
              <p className="text-xs text-slate-500">Live monitoring of security logs (DDoS attacks, brute force, role violations)</p>
            </div>

            {!securityLoading && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* SOC Ring — severity breakdown + blocked/active status */}
                <div className="lg:col-span-1 border border-slate-200 rounded-2xl p-5 shadow-xs bg-white">
                  <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 mb-1">
                    <RadarIcon className="w-4 h-4 text-rose-600" /> SOC Threat Ring
                  </h4>
                  <p className="text-[11px] text-slate-500 mb-3">Malicious activity by severity</p>
                  <div className="relative h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={severityBreakdown}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={78}
                          paddingAngle={3}
                          strokeWidth={0}
                        >
                          {severityBreakdown.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 11, fontWeight: 600 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-black text-slate-800">{blockedStats.total}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Events</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {blockedStats.blocked} Blocked
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600">
                      <AlertTriangle className="w-3.5 h-3.5" /> {blockedStats.active} Active
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {blockedStats.total === 0 ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        No threats detected
                      </span>
                    ) : (
                      severityBreakdown.map((s) => (
                        <span
                          key={s.name}
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${s.color}1A`, color: s.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name} · {s.value}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Timeline — attack/vuln activity over the last 24h, stacked by severity */}
                <div className="lg:col-span-2 border border-slate-200 rounded-2xl p-5 shadow-xs bg-white">
                  <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 mb-1">
                    <Clock className="w-4 h-4 text-rose-600" /> 24h Threat Timeline
                  </h4>
                  <p className="text-[11px] text-slate-500 mb-3">Detected attack &amp; vulnerability activity, blocked status by hour</p>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={alertTimeline} barGap={0} barCategoryGap={2}>
                        <CartesianGrid vertical={false} stroke="#F1F5F9" />
                        <XAxis
                          dataKey="hour"
                          tick={{ fill: '#94A3B8', fontSize: 9, fontWeight: 700 }}
                          axisLine={{ stroke: '#E2E8F0' }}
                          tickLine={false}
                          interval={2}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: '#94A3B8', fontSize: 9, fontWeight: 700 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 11, fontWeight: 600 }}
                        />
                        <Bar dataKey="CRITICAL" stackId="sev" fill={SEVERITY_COLORS.CRITICAL} radius={[0, 0, 0, 0]} />
                        <Bar dataKey="HIGH" stackId="sev" fill={SEVERITY_COLORS.HIGH} />
                        <Bar dataKey="MEDIUM" stackId="sev" fill={SEVERITY_COLORS.MEDIUM} />
                        <Bar dataKey="LOW" stackId="sev" fill={SEVERITY_COLORS.LOW} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {securityLoading ? (
              <div className="text-center py-12 text-slate-500">Querying security telemetry...</div>
            ) : securityAlerts.length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-medium">No unresolved security anomalies detected on the platform.</div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Alert Type</th>
                      <th className="p-4 text-center">Severity</th>
                      <th className="p-4">Origin Details</th>
                      <th className="p-4">Description</th>
                      <th className="p-4 text-center">Status / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {securityAlerts.map((alert: any) => (
                      <tr key={alert.id} className="hover:bg-slate-50/60">
                        <td className="p-4 text-slate-500 font-mono">{alert.timestamp}</td>
                        <td className="p-4 font-bold text-slate-900">{alert.alert_type}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            alert.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                            alert.severity === 'HIGH' ? 'bg-orange-100 text-orange-850' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {alert.severity}
                          </span>
                        </td>
                        <td className="p-4">
                          {alert.source_ip && <p><strong>IP:</strong> {alert.source_ip}</p>}
                          {alert.user_email && <p><strong>Email:</strong> {alert.user_email}</p>}
                        </td>
                        <td className="p-4 text-slate-600 max-w-sm">{alert.description}</td>
                        <td className="p-4 text-center">
                          {alert.status === 'UNRESOLVED' ? (
                            <button
                              onClick={() => handleResolveAlert(alert.id)}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] rounded-lg cursor-pointer"
                            >
                              Resolve
                            </button>
                          ) : (
                            <span className="text-emerald-600 font-bold text-xs">RESOLVED ✓</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: Combined Labs View */}
        {activeTab === 'labs' as any && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-600" /> Platform Labs Management
                </h3>
                <p className="text-xs text-slate-500">Manage virtual lab catalogs, approve auto-synced filesystem configurations, and allocate student hours</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setLabsTabMode('catalog')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      labsTabMode === 'catalog' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-550 hover:text-slate-800'
                    }`}
                  >
                    Labs ({allLabs.filter((l: any) => {
                      const isPending = l.status === 'PENDING_REVIEW' || l.status === 'PENDING';
                      const isMilestone = l.category?.toLowerCase() === 'milestone' || l.id?.includes('points') || l.name?.toLowerCase().includes('milestone');
                      const isDuplicatePuzzle = l.id === 'puzzle-lab';
                      return !isPending && !isMilestone && !isDuplicatePuzzle;
                    }).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabsTabMode('arrivals')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      labsTabMode === 'arrivals' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-550 hover:text-slate-800'
                    }`}
                  >
                    New Arrivals ({allLabs.filter((l: any) => l.status === 'PENDING_REVIEW' || l.status === 'PENDING').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabsTabMode('assigned')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      labsTabMode === 'assigned' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-550 hover:text-slate-800'
                    }`}
                  >
                    Assigned Labs ({allocatedLabs.length})
                  </button>
                </div>
              </div>
            </div>

            {labsTabMode === 'arrivals' && (
              allLabs.filter((l: any) => l.status === 'PENDING_REVIEW' || l.status === 'PENDING').length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-medium">No pending lab configurations in the registry queue.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allLabs.filter((l: any) => l.status === 'PENDING_REVIEW' || l.status === 'PENDING').map((l: any) => (
                    <div key={l.id} className="p-5 border border-slate-200 rounded-2xl bg-white space-y-3 shadow-xs hover:border-purple-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-sm">{l.name}</h4>
                          <span className="text-[10px] font-mono text-purple-650">ID: {l.id}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          {l.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1 border-t border-slate-100 pt-2">
                        <p><strong>Category:</strong> {l.category}</p>
                        <p><strong>Difficulty:</strong> {l.difficulty}</p>
                        <p><strong>Max Points:</strong> {l.max_points} pts</p>
                      </div>
                      <div className="pt-2 flex gap-2">
                        <button
                          onClick={() => handleApproveLab(l.id)}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                        >
                          Approve & Publish
                        </button>
                        <button
                          onClick={() => handleDeleteLab(l.id)}
                          className="p-2 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-xl transition-colors cursor-pointer"
                          title="Reject / Delete configuration"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {labsTabMode === 'catalog' && (() => {
              const activeCatalogLabs = allLabs.filter((l: any) => {
                const isPending = l.status === 'PENDING_REVIEW' || l.status === 'PENDING';
                const isMilestone = l.category?.toLowerCase() === 'milestone' || l.id?.includes('points') || l.name?.toLowerCase().includes('milestone');
                const isDuplicatePuzzle = l.id === 'puzzle-lab';
                return !isPending && !isMilestone && !isDuplicatePuzzle;
              });

              return activeCatalogLabs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-medium">No active labs in the catalog.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeCatalogLabs.map((l: any) => (
                    <div key={l.id} className="p-5 border border-slate-200 rounded-2xl bg-white space-y-3 shadow-xs hover:border-purple-300 transition-colors flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-extrabold text-slate-900 text-sm">{l.name}</h4>
                            <span className="text-[10px] font-mono text-purple-650">ID: {l.id}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {l.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 space-y-1 border-t border-slate-100 pt-2">
                          <p><strong>Category:</strong> {l.category}</p>
                          <p><strong>Difficulty:</strong> {l.difficulty}</p>
                          <p><strong>Max Points:</strong> {l.id === 'techcorp-sysadmin-labs' || l.category?.toLowerCase() === 'puzzle' ? 3400 : (l.max_points || 1000)} pts</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setFormLabId(l.id);
                              setFormLabTitle(l.name);
                              setFormPricePerHour(l.price_inr || 14999.0);
                              setFormLabLevel('custom');
                              setFormAssignTarget('student');
                              setIsAssignModalOpen(true);
                            }}
                            className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Allocate Lab

                          </button>
                          <button
                            onClick={() => {
                              setSelectedLabForRemoval(l);
                              setRemoveTargetType('student');
                              setIsRemoveModalOpen(true);
                            }}
                            className="px-3 py-2 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-xl transition-colors cursor-pointer"
                            title="Remove or revoke allocations"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {labsTabMode === 'assigned' && (
              allocatedLabs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-medium">No assigned labs currently active.</div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-4">Lab Name</th>
                        <th className="p-4">Assigned To</th>
                        <th className="p-4 text-center">Fixed Rate</th>
                        <th className="p-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {allocatedLabs.map((al: any) => (
                        <tr key={al.id} className="hover:bg-slate-50/60">
                          <td className="p-4 font-bold text-slate-900">{al.lab_title || al.lab_id}</td>
                          <td className="p-4 font-semibold text-slate-600">
                            {(() => {
                              const scope = al.assigned_to || (al.organization_id ? 'admin' : al.user_id ? 'student' : 'both');
                              if (scope === 'student') {
                                return (
                                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                                    Student
                                  </span>
                                );
                              } else if (scope === 'admin' || scope === 'org') {
                                return (
                                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                                    Admin
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                                    Both
                                  </span>
                                );
                              }
                            })()}
                          </td>
                          <td className="p-4 text-center font-mono font-black text-slate-950">
                            ₹{(al.fixed_rate ?? al.price_per_hour ?? 0).toLocaleString()}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingAllocatedLab(al);
                                  setNewFixedRate(al.fixed_rate ?? al.price_per_hour ?? 0);
                                  setIsEditPriceModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[11px] rounded-lg border border-purple-250 cursor-pointer transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedLabForRemoval({ id: al.lab_id, name: al.lab_title });
                                  setRemoveTargetType(al.assigned_to || (al.organization_id ? 'admin' : 'student'));
                                  setIsRemoveModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] rounded-lg border border-rose-250 cursor-pointer transition-colors"
                              >
                                Revoke
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              )
            )}

          </div>
        )}


        {/* TAB 4: Students Roster & Analytics */}
        {activeTab === 'students' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" /> Platform Students Roster
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Monitor user roles, status, and click View Analytics for real-time progress detail</p>
              </div>
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchStudents(1, studentSearch)}
                  placeholder="Search students..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {studentsLoading ? (
              <div className="text-center py-12 text-slate-500">Querying platform students...</div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-4">Name / Email</th>
                      <th className="p-4">Organization</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Joined Date</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-center">Analytics</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {students.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/60">
                        <td className="p-4">
                          <p className="font-bold text-slate-900">{s.name || 'N/A'}</p>
                          <span className="text-[10px] text-slate-500 font-mono">{s.email}</span>
                        </td>
                        <td className="p-4 text-slate-600 font-semibold">{s.organization || 'Independent'}</td>
                        <td className="p-4"><span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase">{s.role}</span></td>
                        <td className="p-4 text-slate-500 font-mono">{s.created_at}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {s.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openStudentAnalytics(s.id)}
                              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[11px] rounded-lg border border-purple-200 cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> View Analytics
                            </button>
                            <button
                              onClick={() => handleDeleteUser(s.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Delete Student Permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Student Pagination */}
            <div className="flex items-center justify-between pt-2">
              <button
                disabled={studentPage <= 1}
                onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-40 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="text-xs text-slate-500 font-medium">
                Page {studentPage} | {totalStudents} students total
              </span>
              <button
                disabled={studentPage * 10 >= totalStudents}
                onClick={() => setStudentPage(p => p + 1)}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-40 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {/* TAB 5: Audit Telemetry & DB Viewer */}
        {activeTab === 'db_viewer' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" /> Audit Telemetry
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct inspection of ORM model tables, logs, and database schemas. Read-only mode.
                </p>
              </div>

              {/* Table Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Select Table:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => {
                    setSelectedTable(e.target.value);
                    setDbPage(1);
                  }}
                  className="bg-slate-50 border border-slate-200 text-purple-700 text-xs font-bold font-mono px-3 py-2 rounded-xl focus:outline-none focus:border-purple-500"
                >
                  <option value="users">users</option>
                  <option value="organizations">organizations</option>
                  <option value="groups">groups</option>
                  <option value="labs">labs</option>
                  <option value="lab_modules">lab_modules</option>
                  <option value="audit_logs">audit_logs</option>
                  <option value="payments">payments</option>
                  <option value="orders">orders</option>
                  <option value="purchased_labs">purchased_labs</option>
                  <option value="study_sessions">study_sessions</option>
                </select>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={dbSearch}
                  onChange={(e) => setDbSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchTableData(selectedTable, 1, dbSearch)}
                  placeholder={`Search ${selectedTable} table records...`}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="text-xs text-slate-500 font-mono">
                Total Rows: <span className="font-bold text-purple-600">{dbData?.total || 0}</span> | Page {dbPage} of {dbData?.pages || 1}
              </div>
            </div>

            {/* ORM Records Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200 font-mono">
                  <tr>
                    {(dbData?.columns || []).map((col: string) => (
                      <th key={col} className="p-3 border-r border-slate-200 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                  {dbLoading ? (
                    <tr>
                      <td colSpan={dbData?.columns?.length || 1} className="py-12 text-center text-slate-500">
                        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Querying PostgreSQL table via SQLAlchemy ORM...
                      </td>
                    </tr>
                  ) : !dbData?.rows || dbData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={dbData?.columns?.length || 1} className="py-12 text-center text-slate-500 font-sans">
                        No database records found in table <span className="font-mono text-purple-650">{selectedTable}</span>.
                      </td>
                    </tr>
                  ) : (
                    dbData.rows.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        {dbData.columns.map((col: string) => (
                          <td key={col} className="p-3 border-r border-slate-100 max-w-xs truncate">
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                disabled={dbPage <= 1}
                onClick={() => setDbPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-40 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <span className="text-xs text-slate-500">
                Page {dbPage} / {dbData?.pages || 1}
              </span>

              <button
                disabled={dbPage >= (dbData?.pages || 1)}
                onClick={() => setDbPage((p) => p + 1)}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-40 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: Add College Modal */}
      {isCollegeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <form onSubmit={handleCreateCollege} className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-extrabold text-slate-900">Add New College Affiliation</h2>
              <button type="button" onClick={() => setIsCollegeModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">X</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">College Name *</label>
                <input
                  type="text"
                  required
                  value={newCollegeName}
                  onChange={(e) => setNewCollegeName(e.target.value)}
                  placeholder="e.g. Indian Institute of Technology Madras"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">College Code</label>
                  <input
                    type="text"
                    value={newCollegeCode}
                    onChange={(e) => setNewCollegeCode(e.target.value)}
                    placeholder="IITM"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">City</label>
                  <input
                    type="text"
                    value={newCollegeCity}
                    onChange={(e) => setNewCollegeCity(e.target.value)}
                    placeholder="Chennai"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">State</label>
                  <input
                    type="text"
                    value={newCollegeState}
                    onChange={(e) => setNewCollegeState(e.target.value)}
                    placeholder="Tamil Nadu"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={newCollegeEmail}
                    onChange={(e) => setNewCollegeEmail(e.target.value)}
                    placeholder="contact@iitm.ac.in"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Website URL</label>
                <input
                  type="text"
                  value={newCollegeWebsite}
                  onChange={(e) => setNewCollegeWebsite(e.target.value)}
                  placeholder="https://www.iitm.ac.in"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setIsCollegeModalOpen(false)} className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-[#0052CC] hover:bg-blue-600 text-white font-bold rounded-xl cursor-pointer">Save College</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Organization Purchase History Modal */}
      {isPurchaseModalOpen && selectedOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-extrabold text-slate-900">{selectedOrg.name} — Order History</h2>
              <button type="button" onClick={() => setIsPurchaseModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">X</button>
            </div>
            <div className="p-6 max-h-[300px] overflow-y-auto space-y-3 text-xs">
              {purchasesLoading ? (
                <div className="text-center py-6 text-slate-500">Querying orders...</div>
              ) : orgPurchases.length === 0 ? (
                <div className="text-center py-6 text-slate-500 font-medium">No order history found for this organization.</div>
              ) : (
                orgPurchases.map(p => (
                  <div key={p.id} className="p-3 border border-slate-200 rounded-xl flex items-center justify-between bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-900">{p.order_number}</p>
                      <span className="text-[10px] text-slate-500 font-mono">{p.created_at}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900">₹{p.grand_total.toLocaleString()}</p>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{p.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button type="button" onClick={() => setIsPurchaseModalOpen(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Manual Lab Allocation */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <form onSubmit={handleAssignLab} className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-extrabold text-slate-900">Manually Allocate Lab</h2>
              <button type="button" onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">X</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Assignee Target Scope</label>
                <select
                  value={formAssignTarget}
                  onChange={(e) => setFormAssignTarget(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold"
                >
                  <option value="org">All Organizations</option>
                  <option value="student">All Students</option>
                  <option value="both">Both (All Organizations & Students)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Lab Title</label>
                <input
                  type="text"
                  disabled
                  value={formLabTitle}
                  placeholder="Selected Lab Title"
                  className="w-full p-2.5 bg-slate-105 border border-slate-200 rounded-xl focus:outline-none text-slate-700 font-bold"
                />
              </div>


              <div>
                <label className="font-bold text-slate-700 block mb-1">Fixed Rate / Price (₹)</label>
                <input
                  type="number"
                  value={formPricePerHour}
                  onChange={(e) => setFormPricePerHour(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl cursor-pointer">Allocate Lab & Save</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: Manual Lab Revocation */}
      {isRevokeModalOpen && selectedOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <form onSubmit={handleRevokeLab} className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-extrabold text-slate-900">Manually Revoke Lab Assignment</h2>
              <button type="button" onClick={() => setIsRevokeModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">X</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Lab Identifier ID to Revoke *</label>
                <input
                  type="text"
                  required
                  value={formLabId}
                  onChange={(e) => setFormLabId(e.target.value)}
                  placeholder="e.g. ot-water-treatment"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setIsRevokeModalOpen(false)} className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer">Revoke Lab</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 5: Student Analytics Detailed Modal */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-extrabold text-slate-900">Student Analytics & Lab Progress</h2>
              <button type="button" onClick={() => setIsStudentModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">X</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              {!selectedStudentAnalytics ? (
                <div className="text-center py-12 text-slate-500">Querying real-time progress database...</div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50 space-y-2">
                    <p className="text-sm font-extrabold text-slate-950">{selectedStudentAnalytics.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{selectedStudentAnalytics.email}</p>
                    <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-bold">Finished Labs</span>
                        <p className="text-lg font-black text-purple-600">{selectedStudentAnalytics.completed_labs_count}</p>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-bold">Avg Score</span>
                        <p className="text-lg font-black text-[#0052CC]">{selectedStudentAnalytics.average_score}%</p>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-bold">Active Hours</span>
                        <p className="text-lg font-black text-amber-600">{selectedStudentAnalytics.total_active_hours} hrs</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-slate-900 mb-2">Detailed Progress</h4>
                    <div className="max-h-[150px] overflow-y-auto space-y-2">
                      {selectedStudentAnalytics.labs.length === 0 ? (
                        <p className="text-center py-4 text-slate-500">No lab attempts made yet.</p>
                      ) : (
                        selectedStudentAnalytics.labs.map((l: any, i: number) => (
                          <div key={i} className="p-2.5 border border-slate-200 rounded-xl flex items-center justify-between bg-white">
                            <div>
                              <p className="font-bold text-slate-900">{l.lab_id}</p>
                              <span className="text-[10px] text-slate-500">{l.completed_at || 'In Progress'}</span>
                            </div>
                            <div className="text-right">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                l.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                              }`}>{l.status}</span>
                              <p className="text-xs font-black text-slate-900 mt-1">{l.score} pts</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button type="button" onClick={() => setIsStudentModalOpen(false)} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 5: Revoke / Remove Lab Modal */}
      {isRemoveModalOpen && selectedLabForRemoval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <form onSubmit={handleRemoveLabAction} className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-extrabold text-slate-900">Remove / Revoke Lab Allocation</h2>
              <button type="button" onClick={() => setIsRemoveModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">X</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                You are performing a removal/revoke action for: <strong className="text-slate-900">{selectedLabForRemoval.name}</strong> (ID: {selectedLabForRemoval.id}). Please select your target:
              </p>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Revocation Target Scope</label>
                <select
                  value={removeTargetType}
                  onChange={(e) => setRemoveTargetType(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold"
                >
                  <option value="student">Revoke allocations for Students only</option>
                  <option value="admin">Revoke allocations for Organizations only</option>
                  <option value="both">Revoke allocations for Both (Students & Orgs)</option>
                  <option value="catalog">Delete Lab from Catalog completely</option>
                </select>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setIsRemoveModalOpen(false)} className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl cursor-pointer">Execute Action</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 6: Edit Assigned Lab Fixed Rate Modal */}
      {isEditPriceModalOpen && editingAllocatedLab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <form onSubmit={handleSaveFixedRate} className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-extrabold text-slate-900">Edit Lab Fixed Rate</h2>
              <button type="button" onClick={() => setIsEditPriceModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">X</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Update the fixed rate for <strong className="text-slate-900">{editingAllocatedLab.lab_title || editingAllocatedLab.lab_id}</strong>.
              </p>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Fixed Rate (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={newFixedRate}
                  onChange={(e) => setNewFixedRate(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold"
                  placeholder="e.g. 500"
                  required
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setIsEditPriceModalOpen(false)} className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl cursor-pointer">Save Rate</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
