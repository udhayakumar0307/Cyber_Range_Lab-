export type ScheduleStatus = 'upcoming' | 'provisioning' | 'live' | 'expiring' | 'completed';

export interface ScheduleItem {
  id: string;
  labId: string;
  labTitle: string;
  groupId: string;
  groupName: string;
  startTime: string; // ISO String
  endTime: string;   // ISO String
  autoProvision: boolean;
  emailReminders: boolean;
  status: ScheduleStatus;
  activeInstances: number;
  totalAssignedUsers: number;
  extendedMinutes?: number;
  createdDate: string;
}

export interface ScheduleCreationPayload {
  labId: string;
  groupId: string;
  startTime: string;
  endTime: string;
  autoProvision: boolean;
  emailReminders: boolean;
}

export interface ScheduleFilter {
  searchQuery: string;
  status: 'all' | ScheduleStatus;
  groupId: string;
}
