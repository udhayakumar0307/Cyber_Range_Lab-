import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  SlidersHorizontal,
  CheckCircle2
} from 'lucide-react';

interface SecurityState {
  keyVerified: boolean;
  authenticated: boolean;
  user: any | null;
  role: string | null;
}

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'db_viewer' | 'audit_logs' | 'health'>('dashboard');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dashLoading, setDashLoading] = useState(false);

  // DB Viewer State
  const [selectedTable, setSelectedTable] = useState('users');
  const [dbData, setDbData] = useState<any>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbSearch, setDbSearch] = useState('');
  const [dbPage, setDbPage] = useState(1);

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
          if ((u.role || '').toUpperCase() === 'SYSTEM_ADMIN') {
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

  useEffect(() => {
    if (step === 'dashboard') {
      if (activeTab === 'dashboard') {
        fetchDashboard();
      } else if (activeTab === 'db_viewer') {
        fetchTableData(selectedTable, dbPage, dbSearch);
      }
    }
  }, [step, activeTab, selectedTable, dbPage]);

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

        if (userRole !== 'SYSTEM_ADMIN') {
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

  // STEP 1: Security Key Verification UI
  if (step === 'key') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-[#0052CC] dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">System Security Gate</h1>
              <p className="text-xs text-slate-400 mt-1">Enter authorized System Admin Security Key to proceed.</p>
            </div>
          </div>

          {keyError && (
            <div className="bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold p-3.5 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{keyError}</span>
            </div>
          )}

          <form onSubmit={handleVerifyKey} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                System Security Key
              </label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={securityKey}
                  onChange={(e) => setSecurityKey(e.target.value)}
                  placeholder="••••••••••••••••"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={keyLoading}
              className="w-full py-3.5 bg-[#0052CC] hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

  // STEP 2: System Admin Login UI
  if (step === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800/60 inline-block mb-2">
                ✓ Security Key Verified
              </span>
              <h1 className="text-2xl font-black tracking-tight text-white">System Admin Authentication</h1>
              <p className="text-xs text-slate-400 mt-1">Authenticate with your SYSTEM_ADMIN credentials.</p>
            </div>
          </div>

          {loginError && (
            <div className="bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold p-3.5 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleSystemLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                System Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sysadmin@cyberrange.in"
                required
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setStep('key')}
                className="text-slate-400 hover:text-slate-200 underline"
              >
                Re-enter Security Key
              </button>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

  // STEP 3: System Admin Portal Dashboard & Database Viewer UI
  const counters = dashboardData?.counters || {};
  const recentLogs = dashboardData?.recent_activity || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top System Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-white">System Admin Portal</h1>
              <span className="text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full">
                SYSTEM_ADMIN
              </span>
            </div>
            <p className="text-[11px] text-slate-400">PostgreSQL (AWS RDS) Governance & Database Viewer</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeTab === 'dashboard') fetchDashboard();
              else if (activeTab === 'db_viewer') fetchTableData(selectedTable, dbPage, dbSearch);
            }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 font-bold text-xs rounded-xl border border-rose-800/80 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> End Session
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-slate-900/60 border-b border-slate-800 px-6 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'dashboard'
              ? 'border-purple-500 text-purple-400 bg-purple-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" /> System Dashboard
        </button>

        <button
          onClick={() => setActiveTab('db_viewer')}
          className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'db_viewer'
              ? 'border-purple-500 text-purple-400 bg-purple-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" /> Read-Only DB Viewer
        </button>
      </nav>

      {/* Content Body */}
      <main className="flex-1 p-6 space-y-6">
        {/* TAB 1: System Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Metric Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-400">Total Orgs</span>
                <p className="text-2xl font-black text-white">{counters.total_organizations || 0}</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-400">Total Admins</span>
                <p className="text-2xl font-black text-purple-400">{counters.total_admins || 0}</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-400">Total Users</span>
                <p className="text-2xl font-black text-blue-400">{counters.total_users || 0}</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-400">Cohorts/Groups</span>
                <p className="text-2xl font-black text-amber-400">{counters.total_groups || 0}</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-400">Active Sessions</span>
                <p className="text-2xl font-black text-emerald-400">{counters.total_sessions || 0}</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-400">Total Revenue</span>
                <p className="text-2xl font-black text-white">₹{(counters.total_revenue || 0).toLocaleString()}</p>
              </div>
            </div>

            {/* System Audit Activity Log Feed */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" /> System Audit Trail
                </h3>
                <span className="text-xs text-slate-400">Live PostgreSQL Audit Entries</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Entity</th>
                      <th className="p-3">Performed By</th>
                      <th className="p-3">IP Address</th>
                      <th className="p-3">Endpoint</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                    {recentLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                          No audit log records available.
                        </td>
                      </tr>
                    ) : (
                      recentLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-slate-800/40">
                          <td className="p-3 text-slate-400">{log.timestamp}</td>
                          <td className="p-3 font-bold text-white">{log.action}</td>
                          <td className="p-3 text-purple-300">{log.entity}</td>
                          <td className="p-3 text-blue-300">{log.performed_by}</td>
                          <td className="p-3 text-slate-400">{log.ip_address}</td>
                          <td className="p-3 text-slate-400">{log.endpoint}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                log.status === 'SUCCESS'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-rose-950 text-rose-400 border border-rose-800'
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Read-Only Database Viewer */}
        {activeTab === 'db_viewer' && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-400" /> Read-Only PostgreSQL Database Viewer
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct inspection of ORM model tables. Read-only mode — raw SQL execution disabled.
                </p>
              </div>

              {/* Table Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Select Table:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => {
                    setSelectedTable(e.target.value);
                    setDbPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 text-purple-300 text-xs font-bold font-mono px-3 py-2 rounded-xl focus:outline-none focus:border-purple-500"
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
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={dbSearch}
                  onChange={(e) => setDbSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchTableData(selectedTable, 1, dbSearch)}
                  placeholder={`Search ${selectedTable} table records...`}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="text-xs text-slate-400 font-mono">
                Total Rows: <span className="font-bold text-purple-400">{dbData?.total || 0}</span> | Page {dbPage} of {dbData?.pages || 1}
              </div>
            </div>

            {/* ORM Records Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800 font-mono">
                  <tr>
                    {(dbData?.columns || []).map((col: string) => (
                      <th key={col} className="p-3 border-r border-slate-800 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
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
                        No database records found in table <span className="font-mono text-purple-400">{selectedTable}</span>.
                      </td>
                    </tr>
                  ) : (
                    dbData.rows.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        {dbData.columns.map((col: string) => (
                          <td key={col} className="p-3 border-r border-slate-800/60 max-w-xs truncate">
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
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <span className="text-xs text-slate-400">
                Page {dbPage} / {dbData?.pages || 1}
              </span>

              <button
                disabled={dbPage >= (dbData?.pages || 1)}
                onClick={() => setDbPage((p) => p + 1)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
