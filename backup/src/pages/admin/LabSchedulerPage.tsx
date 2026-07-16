import React, { useState } from 'react';
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

const INITIAL_SCHEDULES: ScheduleItem[] = [
  {
    id: 'sch-1',
    labId: 'lab-1',
    labTitle: 'Enterprise Threat Hunting & Packet Analysis',
    groupId: 'grp-1',
    groupName: 'Cybersecurity Cohort Alpha (45 Users)',
    startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    autoProvision: true,
    emailReminders: true,
    status: 'live',
    activeInstances: 42,
    totalAssignedUsers: 45,
    extendedMinutes: 0,
    createdDate: '2026-07-10',
  },
  {
    id: 'sch-2',
    labId: 'lab-2',
    labTitle: 'Active Directory Exploitation & Privilege Escalation',
    groupId: 'grp-2',
    groupName: 'Red Team Batch B (30 Users)',
    startTime: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 300 * 60 * 1000).toISOString(),
    autoProvision: true,
    emailReminders: true,
    status: 'upcoming',
    activeInstances: 0,
    totalAssignedUsers: 30,
    extendedMinutes: 0,
    createdDate: '2026-07-12',
  },
  {
    id: 'sch-3',
    labId: 'lab-3',
    labTitle: 'Kubernetes Container Security & Runtime Defense',
    groupId: 'grp-3',
    groupName: 'DevSecOps Engineers (20 Users)',
    startTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 130 * 60 * 1000).toISOString(),
    autoProvision: true,
    emailReminders: true,
    status: 'provisioning',
    activeInstances: 15,
    totalAssignedUsers: 20,
    extendedMinutes: 0,
    createdDate: '2026-07-14',
  },
  {
    id: 'sch-4',
    labId: 'lab-4',
    labTitle: 'Web Application Vulnerability Scanning & XSS',
    groupId: 'grp-1',
    groupName: 'Cybersecurity Cohort Alpha (45 Users)',
    startTime: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    autoProvision: false,
    emailReminders: true,
    status: 'completed',
    activeInstances: 0,
    totalAssignedUsers: 45,
    createdDate: '2026-07-08',
  }
];

export const LabSchedulerPage: React.FC = () => {
  const [schedules, setSchedules] = useState<ScheduleItem[]>(INITIAL_SCHEDULES);
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ScheduleStatus>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Schedule Form State
  const [newLabTitle, setNewLabTitle] = useState('Enterprise Threat Hunting & Packet Analysis');
  const [newGroupName, setNewGroupName] = useState('Cybersecurity Cohort Alpha (45 Users)');
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
      <div className="space-y-6">
        {/* Header Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lab Execution Scheduler</h1>
            <p className="text-sm text-gray-500 mt-1">
              Schedule automated lab instance deployment windows, email notifications, and auto-teardowns.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-2" /> Schedule Lab Window
          </button>
        </div>

        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Schedules</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{schedules.length}</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <CalendarIcon className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Instances</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {schedules.reduce((acc, curr) => acc + curr.activeInstances, 0)} Container Nodes
              </p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <Server className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Targeted Cohorts</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">3 Student Groups</p>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Auto-Teardown Engine</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">Operational</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filters & View Switcher */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search lab or group..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full sm:w-44 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="live">Live Sessions</option>
              <option value="upcoming">Scheduled</option>
              <option value="provisioning">Provisioning</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'list' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <List className="w-3.5 h-3.5 mr-1.5" /> Roster View
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'calendar' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5 mr-1.5" /> Grid Calendar
            </button>
          </div>
        </div>

        {/* Tabular Roster View */}
        {activeTab === 'list' ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                    <th className="py-3.5 px-4">Lab Title</th>
                    <th className="py-3.5 px-4">Target Cohort</th>
                    <th className="py-3.5 px-4">Execution Window</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Instances</th>
                    <th className="py-3.5 px-4 text-center">Settings</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-700">
                  {filteredSchedules.map((schedule) => (
                    <tr key={schedule.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-4 px-4 font-semibold text-gray-900 max-w-xs truncate">
                        {schedule.labTitle}
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        <span className="inline-flex items-center">
                          <Users className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                          {schedule.groupName}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-xs font-mono text-gray-600">
                        <div>Start: {new Date(schedule.startTime).toLocaleString()}</div>
                        <div className="text-gray-500">End: {new Date(schedule.endTime).toLocaleString()}</div>
                        {schedule.extendedMinutes ? (
                          <span className="inline-block mt-0.5 text-blue-600 font-bold">
                            +{schedule.extendedMinutes}m Extended
                          </span>
                        ) : null}
                      </td>
                      <td className="py-4 px-4">{getStatusBadge(schedule.status)}</td>
                      <td className="py-4 px-4 font-mono font-semibold text-gray-900">
                        {schedule.activeInstances} / {schedule.totalAssignedUsers}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <span
                            title={schedule.autoProvision ? 'Auto-Provision Enabled' : 'Manual Provision'}
                            className={`p-1 rounded ${schedule.autoProvision ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}
                          >
                            <Server className="w-4 h-4" />
                          </span>
                          <span
                            title={schedule.emailReminders ? 'Email Reminders Active' : 'No Email Alerts'}
                            className={`p-1 rounded ${schedule.emailReminders ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}
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
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition-colors"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}

                          {schedule.status === 'live' && (
                            <>
                              <button
                                onClick={() => handleExtend(schedule.id, 15)}
                                title="Extend Window (+15 mins)"
                                className="px-2 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md border border-blue-200 transition-colors"
                              >
                                +15m
                              </button>
                              <button
                                onClick={() => handleForceStop(schedule.id)}
                                title="Emergency Teardown Containers"
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors"
                              >
                                <Square className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => handleDelete(schedule.id)}
                            title="Delete Schedule Entry"
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSchedules.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
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
                    <option value="Enterprise Threat Hunting & Packet Analysis">
                      Enterprise Threat Hunting & Packet Analysis
                    </option>
                    <option value="Active Directory Exploitation & Privilege Escalation">
                      Active Directory Exploitation & Privilege Escalation
                    </option>
                    <option value="Kubernetes Container Security & Runtime Defense">
                      Kubernetes Container Security & Runtime Defense
                    </option>
                    <option value="Web Application Vulnerability Scanning & XSS">
                      Web Application Vulnerability Scanning & XSS
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Assign Target Student Cohort
                  </label>
                  <select
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Cybersecurity Cohort Alpha (45 Users)">
                      Cybersecurity Cohort Alpha (45 Users)
                    </option>
                    <option value="Red Team Batch B (30 Users)">
                      Red Team Batch B (30 Users)
                    </option>
                    <option value="DevSecOps Engineers (20 Users)">
                      DevSecOps Engineers (20 Users)
                    </option>
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
