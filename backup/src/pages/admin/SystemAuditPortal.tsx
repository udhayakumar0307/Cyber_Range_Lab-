import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Building2, 
  Users, 
  UserCheck, 
  CreditCard, 
  AlertTriangle, 
  Server, 
  Download, 
  Search, 
  Filter, 
  Lock, 
  RefreshCw, 
  Layers, 
  TrendingUp,
  XCircle,
  Clock,
  Database
} from 'lucide-react';

interface AuditStats {
  counters: {
    total_organizations: number;
    total_admins: number;
    total_users: number;
    total_groups: number;
    total_purchases: number;
    total_revenue: number;
    total_running_containers: number;
    total_sessions: number;
    total_active_users: number;
  };
  recent_activity: any[];
  platform_admins: any[];
  organizations: any[];
  latest_admins: any[];
  latest_users: any[];
  payments: any[];
  error_logs: any[];
  failed_logins: any[];
  purchases: any[];
  container_events: any[];
}

export const SystemAuditPortal: React.FC = () => {
  const [data, setData] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState<'activity' | 'admins' | 'orgs' | 'payments' | 'errors'>('activity');

  const fetchAuditData = async () => {
    setLoading(true);
    setForbidden(false);
    const token = localStorage.getItem('token');
    
    let url = '/api/v1/system/audit/dashboard?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (selectedOrg !== 'all') url += `org_id=${selectedOrg}&`;
    if (dateFrom) url += `date_from=${dateFrom}&`;
    if (dateTo) url += `date_to=${dateTo}&`;

    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch system audit telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [selectedOrg, dateFrom, dateTo]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAuditData();
  };

  const handleExportCSV = () => {
    if (!data || !data.recent_activity) return;
    const headers = ['ID', 'Timestamp', 'Action', 'Entity', 'Performed By', 'Role', 'IP Address', 'Browser', 'Status'];
    const rows = data.recent_activity.map((l: any) => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.action}"`,
      `"${l.entity || ''}"`,
      `"${l.performed_by || ''}"`,
      `"${l.performed_by_role || ''}"`,
      `"${l.ip_address || ''}"`,
      `"${l.browser || ''}"`,
      `"${l.status}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `system_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  if (forbidden) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center mb-4 border border-rose-500/30">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">403 Forbidden - System Admin Required</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-md">
          The System Audit Portal is restricted exclusively to CyberRange platform owners (`SYSTEM_ADMIN` role). Organization Administrators do not have access to this portal.
        </p>
      </div>
    );
  }

  const counters = data?.counters || {
    total_organizations: 0,
    total_admins: 0,
    total_users: 0,
    total_groups: 0,
    total_purchases: 0,
    total_revenue: 0,
    total_running_containers: 0,
    total_sessions: 0,
    total_active_users: 0
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner Header */}
      <div className="bg-slate-900 dark:bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white">System Audit & Governance Portal</h1>
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full">
                  SYSTEM_ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Centralized platform-wide security audit, organizational isolation governance, real-time counters, and error monitoring.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            onClick={fetchAuditData}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>

          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Real-time Telemetry Counters Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Organizations</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">{counters.total_organizations}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Platform Admins</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">{counters.total_admins}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Total Users</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">{counters.total_users}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Running Containers</span>
            <Server className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">{counters.total_running_containers}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Total Purchases</span>
            <CreditCard className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">{counters.total_purchases}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Platform Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">₹{counters.total_revenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit action, user, IP, or endpoint..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button type="submit" className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700">
            Search
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 dark:text-slate-400 font-medium">Organization:</span>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">All Organizations</option>
              {data?.organizations?.map((o: any) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('activity')}
          className={`pb-2.5 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'activity'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          Recent Audit Logs ({data?.recent_activity?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('admins')}
          className={`pb-2.5 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'admins'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          Platform Admins ({data?.platform_admins?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('orgs')}
          className={`pb-2.5 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'orgs'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          Organizations ({data?.organizations?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-2.5 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'payments'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          Payments & Orders ({data?.payments?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('errors')}
          className={`pb-2.5 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'errors'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          Error Logs ({data?.error_logs?.length || 0})
        </button>
      </div>

      {/* Tab Content Panels */}
      {activeTab === 'activity' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">System Audit Trail</h3>
            <span className="text-[11px] text-slate-400 font-medium">Real-time database stream</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading audit records...</div>
          ) : !data?.recent_activity || data.recent_activity.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
              <Database className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-bold">No data available</p>
              <p className="text-xs text-slate-400">No system audit records found for the selected filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">Performed By</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Browser / OS</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                  {data.recent_activity.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{log.timestamp}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{log.action}</td>
                      <td className="py-3 px-4">{log.entity} #{log.entity_id}</td>
                      <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-semibold">{log.performed_by}</td>
                      <td className="py-3 px-4"><span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">{log.performed_by_role}</span></td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{log.ip_address}</td>
                      <td className="py-3 px-4 text-slate-500">{log.browser} ({log.operating_system})</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          log.status === 'SUCCESS' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'admins' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase mb-4">Platform Administrators</h3>
          {!data?.platform_admins || data.platform_admins.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No data available</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.platform_admins.map((adm) => (
                <div key={adm.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{adm.name}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 border border-indigo-200">{adm.role}</span>
                  </div>
                  <p className="text-xs text-slate-500">{adm.email}</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">Org: <span className="font-bold">{adm.organization_name}</span></p>
                  <p className="text-[11px] text-slate-400">Last login: {adm.last_login}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'orgs' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase mb-4">Registered Organizations</h3>
          {!data?.organizations || data.organizations.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Org Name</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">City / State</th>
                    <th className="py-2.5 px-4">Total Users</th>
                    <th className="py-2.5 px-4">Total Groups</th>
                    <th className="py-2.5 px-4">Total Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{org.name}</td>
                      <td className="py-3 px-4">{org.institution_type}</td>
                      <td className="py-3 px-4">{org.city}, {org.state}</td>
                      <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-slate-100">{org.total_users}</td>
                      <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-slate-100">{org.total_groups}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-600">₹{org.total_spent.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase mb-4">Platform Payment Transactions</h3>
          {!data?.payments || data.payments.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px] font-bold border-b">
                  <tr>
                    <th className="py-2.5 px-4">Txn ID</th>
                    <th className="py-2.5 px-4">Order ID</th>
                    <th className="py-2.5 px-4">Gateway</th>
                    <th className="py-2.5 px-4">Amount</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">{p.transaction_id}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">#{p.order_id}</td>
                      <td className="py-3 px-4 capitalize">{p.gateway}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">₹{p.amount}</td>
                      <td className="py-3 px-4"><span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold text-[10px]">{p.payment_status}</span></td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{p.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'errors' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <h3 className="text-xs font-black text-rose-600 uppercase mb-4 flex items-center gap-1.5">
            <XCircle className="w-4 h-4" /> Platform Error & Exception Logs
          </h3>
          {!data?.error_logs || data.error_logs.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No data available</p>
          ) : (
            <div className="space-y-3">
              {data.error_logs.map((err) => (
                <div key={err.id} className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-rose-800 dark:text-rose-400">
                    <span>{err.action} ({err.endpoint || 'Internal'})</span>
                    <span className="font-mono text-[10px]">{err.timestamp}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">{err.detail || 'Exception recorded'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
