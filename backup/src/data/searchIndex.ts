export interface SearchEntry {
  label: string;
  description: string;
  path: string;
}

export const adminSearchIndex: SearchEntry[] = [
  { label: 'Dashboard', description: 'Overview of your organization', path: '/admin/dashboard' },
  { label: 'Lab Marketplace', description: 'Browse and purchase lab environments', path: '/admin/labs' },
  { label: 'Lab Scheduler', description: 'Schedule lab availability windows', path: '/admin/scheduler' },
  { label: 'Student Management', description: 'Manage students and groups', path: '/admin/users' },
  { label: 'Training Groups', description: 'View and manage student groups', path: '/admin/groups' },
  { label: 'Lab Allocation', description: 'Allocate purchased lab seats', path: '/admin/allocations' },
  { label: 'Lab Control Panel', description: 'Monitor and control running lab sessions', path: '/admin/labs/control' },
  { label: 'Monitoring & Analytics', description: 'Live usage and performance analytics', path: '/admin/monitoring' },
  { label: 'Reports', description: 'Historical lab assignment reports and exports', path: '/admin/reports' },
  { label: 'CTF Manager', description: 'Create and schedule CTF competitions', path: '/admin/ctf' },
  { label: 'Study Material', description: 'Upload reference material for students', path: '/admin/study-material' },
  { label: 'Purchased Labs', description: 'View labs your organization has purchased', path: '/admin/purchased-labs' },
  { label: 'Payment History', description: 'View past payments and invoices', path: '/admin/payments' },
  { label: 'Settings', description: 'Organization profile and account settings', path: '/admin/settings' },
  { label: 'My Profile', description: 'Your admin profile', path: '/admin/profile' },
];

export const studentSearchIndex: SearchEntry[] = [
  { label: 'Dashboard', description: 'Your score, rank, and recent activity', path: '/dashboard' },
  { label: 'Available Labs', description: 'Browse and start hands-on labs', path: '/labs' },
  { label: 'Assignments', description: 'Labs assigned to you, with deadlines', path: '/assigned-labs' },
  { label: 'My Labs', description: 'Labs you have purchased or started', path: '/my-labs' },
  { label: 'CTF Competitions', description: 'Join live Capture-The-Flag events', path: '/ctf' },
  { label: 'My Statistics', description: 'Score, badges, certificates, and completed labs', path: '/statistics' },
  { label: 'Leaderboards', description: 'Personal, college, and global rankings', path: '/leaderboards' },
  { label: 'Progress Tracking', description: 'Your training progress over time', path: '/progress' },
  { label: 'Study Material', description: 'Reference guides shared by instructors', path: '/study-material' },
  { label: 'Cart', description: 'Labs in your cart', path: '/cart' },
  { label: 'My Profile', description: 'Your student profile', path: '/profile' },
  { label: 'Settings', description: 'Password, notifications, and preferences', path: '/settings' },
];
