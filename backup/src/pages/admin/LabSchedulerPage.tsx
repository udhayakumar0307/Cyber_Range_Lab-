import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import type { ScheduleItem, ScheduleStatus } from '../../types/scheduler';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Play, 
  Square, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  Users, 
  Server, 
  Mail, 
  Trash2,
  List,
  Grid
} from 'lucide-react';

export const LabSchedulerPage: React.FC = () => {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ScheduleStatus>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [availableLabs, setAvailableLabs] = useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);

  useEffect(() => {
    const fetchSchedulesAndOptions = async () => {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      try {
        const [schRes, labsRes, grpRes] = await Promise.all([
          fetch('/api/v1/admin/allocations', { headers }),
          fetch('/api/v1/admin/purchased-labs', { headers }),
          fetch('/api/v1/admin/groups', { headers })
        ]);

        if (schRes.ok) {
          const data = await schRes.json();
          if (Array.isArray(data)) {
            const mapped = data.map((a: any) => ({
              id: a.id || `sch-${a.labId}`,
              labId: a.labId,
              labTitle: a.labTitle || 'Allocated Lab Schedule',
              groupId: a.groupId || 'grp-1',
              groupName: a.groupName || 'Enterprise Cohort',
              startTime: a.allocatedDate || new Date().toISOString(),
              endTime: a.expiryDate || new Date().toISOString(),
              autoProvision: true,
              emailReminders: true,
              status: (a.status?.toLowerCase() === 'active' ? 'live' : 'completed') as any,
              activeInstances: a.assignedSeats || 0,
              totalAssignedUsers: a.totalSeats || 0,
              extendedMinutes: 0,
              createdDate: a.allocatedDate || '2026-07-20'
            }));
            setSchedules(mapped);
          }
        }

        if (labsRes.ok) {
          const lData = await labsRes.json();
          if (Array.isArray(lData)) setAvailableLabs(lData);
        }

        if (grpRes.ok) {
          const gData = await grpRes.json();
          if (Array.isArray(gData)) setAvailableGroups(gData);
        }
      } catch (err) {
        console.error('Error fetching lab schedules:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedulesAndOptions();
  }, []);

  // New Schedule Form State
  const [newLabTitle, setNewLabTitle] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newAutoProvision, setNewAutoProvision] = useState(true);
  const [newEmailReminders, setNewEmailReminders] = useState(true);

  // Filtered list
  const filteredSchedules = schedules.filter((s) => {
    const matchesSearch = s.labTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.groupName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Schedule Actions
  const handleForceStart = (id: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'live', activeInstances: s.totalAssignedUsers } : s))
    );
  };

  const handleForceStop = (id: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'completed', activeInstances: 0 } : s))
    );
  };

  const handleExtend = (id: string, minutes: number) => {
    setSchedules((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const endMs = new Date(s.endTime).getTime() + minutes * 60 * 1000;
          return {
            ...s,
            endTime: new Date(endMs).toISOString(),
            extendedMinutes: (s.extendedMinutes || 0) + minutes,
          };
        }
        return s;
      })
    );
  };

  const handleDelete = (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const newSchedule: ScheduleItem = {
      id: `sch-${Date.now()}`,
      labId: 'lab-custom',
      labTitle: newLabTitle,
      groupId: 'grp-custom',
      groupName: newGroupName,
      startTime: newStart || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      endTime: newEnd || new Date(Date.now() + 180 * 60 * 1000).toISOString(),
      autoProvision: newAutoProvision,
      emailReminders: newEmailReminders,
      status: 'upcoming',
      activeInstances: 0,
      totalAssignedUsers: 35,
      createdDate: new Date().toISOString().split('T')[0],
    };
    setSchedules([newSchedule, ...schedules]);
    setIsModalOpen(false);
  };

  const getStatusBadge = (status: ScheduleStatus) => {
    switch (status) {
      case 'live':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 animate-pulse">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-emerald-500"></span> Live Session
          </span>
        );
      case 'provisioning':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Server className="w-3 h-3 mr-1 animate-spin" /> Provisioning
          </span>
        );
      case 'upcoming':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1" /> Scheduled
          </span>
        );
      case 'expiring':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
            <AlertTriangle className="w-3 h-3 mr-1" /> Ending Soon
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            <CheckCircle className="w-3 h-3 mr-1" /> Completed
          </span>
        );
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Header Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-[#0052CC] dark:text-blue-400" />
              Lab Execution Scheduler
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Schedule automated lab instance deployment windows, email notifications, and auto-teardowns.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-center"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Schedule Lab Window
          </button>
        </div>

        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Total Schedules</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{schedules.length}</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-[#0052CC] dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-800">
              <CalendarIcon className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Active Instances</p>
              <p className="text-2xl font-black text-[#28A745] dark:text-emerald-400 mt-1">
                {schedules.reduce((acc, curr) => acc + curr.activeInstances, 0)} Nodes
              </p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-[#28A745] dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800">
              <Server className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Targeted Training Groups</p>
              <p className="text-2xl font-black text-[#6F42C1] dark:text-purple-400 mt-1">3 Training Groups</p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/60 text-[#6F42C1] dark:text-purple-400 rounded-xl border border-purple-100 dark:border-purple-800">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Auto-Teardown Engine</p>
              <p className="text-2xl font-black text-[#28A745] dark:text-emerald-400 mt-1">Operational</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-[#28A745] dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filters & View Switcher */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search lab or group..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full sm:w-44 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="live">Live Only</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-end md:self-auto">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'list' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" /> List View
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'calendar' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" /> Schedule Timeline
            </button>
          </div>
        </div>

        {/* Schedule List Content View */}
        {activeTab === 'list' ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Lab Title</th>
                    <th className="py-3.5 px-4">Target Training Group</th>
                    <th className="py-3.5 px-4">Execution Window</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Instances</th>
                    <th className="py-3.5 px-4 text-center">Settings</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredSchedules.map((schedule) => (
                    <tr key={schedule.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-4 px-4 font-bold text-slate-900 dark:text-slate-100 max-w-xs truncate">
                        {schedule.labTitle}
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center">
                          <Users className="w-3.5 h-3.5 mr-1.5 text-[#6F42C1] dark:text-purple-400" />
                          {schedule.groupName}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                        <div>Start: {new Date(schedule.startTime).toLocaleString()}</div>
                        <div className="text-slate-500 dark:text-slate-400">End: {new Date(schedule.endTime).toLocaleString()}</div>
                        {schedule.extendedMinutes ? (
                          <span className="inline-block mt-0.5 text-[#0052CC] dark:text-blue-400 font-bold">
                            +{schedule.extendedMinutes}m Extended
                          </span>
                        ) : null}
                      </td>
                      <td className="py-4 px-4">{getStatusBadge(schedule.status)}</td>
                      <td className="py-4 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {schedule.activeInstances} / {schedule.totalAssignedUsers}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <span
                            title={schedule.autoProvision ? 'Auto-Provision Enabled' : 'Manual Provision'}
                            className={`p-1 rounded ${schedule.autoProvision ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                          >
                            <Server className="w-4 h-4" />
                          </span>
                          <span
                            title={schedule.emailReminders ? 'Email Reminders Active' : 'No Email Alerts'}
                            className={`p-1 rounded ${schedule.emailReminders ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                          >
                            <Mail className="w-4 h-4" />
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {schedule.status !== 'live' && schedule.status !== 'completed' && (
                            <button
                              onClick={() => handleForceStart(schedule.id)}
                              title="Force Start Lab Now"
                              className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-[#28A745] dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}

                          {schedule.status === 'live' && (
                            <>
                              <button
                                onClick={() => handleExtend(schedule.id, 15)}
                                title="Extend Window (+15 mins)"
                                className="px-2 py-1 text-xs font-extrabold bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-[#0052CC] dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                              >
                                +15m
                              </button>
                              <button
                                onClick={() => handleForceStop(schedule.id)}
                                title="Emergency Teardown Containers"
                                className="p-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                              >
                                <Square className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => handleDelete(schedule.id)}
                            title="Delete Schedule Entry"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSchedules.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400 font-medium">
                        No lab execution schedules matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grid Calendar View */
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Execution Timeline Grid</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSchedules.map((sch) => (
                <div key={sch.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50/50 hover:border-blue-400 transition-colors space-y-3">
                  <div className="flex items-center justify-between">
                    {getStatusBadge(sch.status)}
                    <span className="text-xs font-mono text-gray-500">ID: {sch.id}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{sch.labTitle}</h4>
                    <p className="text-xs text-purple-700 font-semibold mt-0.5">{sch.groupName}</p>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1 font-mono bg-white p-2.5 rounded-lg border border-gray-200">
                    <div>Start: {new Date(sch.startTime).toLocaleString()}</div>
                    <div>End: {new Date(sch.endTime).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-gray-500 font-mono">Nodes: {sch.activeInstances} / {sch.totalAssignedUsers}</span>
                    <div className="flex items-center space-x-2">
                      {sch.status === 'live' && (
                        <button
                          onClick={() => handleExtend(sch.id, 30)}
                          className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          +30m Extend
                        </button>
                      )}
                      {sch.status !== 'completed' && (
                        <button
                          onClick={() => handleForceStop(sch.id)}
                          className="px-2 py-1 text-xs font-medium bg-rose-600 text-white rounded hover:bg-rose-700"
                        >
                          Teardown
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schedule Creation Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h3 className="text-lg font-bold text-gray-900">Schedule Lab Execution Window</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSchedule} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Select Purchased Lab
                  </label>
                  <select
                    value={newLabTitle}
                    onChange={(e) => setNewLabTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select Security Lab</option>
                    {availableLabs.map((l) => (
                      <option key={l.id} value={l.title}>{l.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Assign Target Student Training Group
                  </label>
                  <select
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select Student Training Group</option>
                    {availableGroups.map((g) => (
                      <option key={g.id || g.name} value={g.name}>{g.name} ({g.memberCount || 0} Members)</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      End Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAutoProvision}
                      onChange={(e) => setNewAutoProvision(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>Auto-Provision Container Instances at Start</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEmailReminders}
                      onChange={(e) => setNewEmailReminders(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>Send Email Notification 10 Minutes Before Start</span>
                  </label>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    Schedule Window
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
