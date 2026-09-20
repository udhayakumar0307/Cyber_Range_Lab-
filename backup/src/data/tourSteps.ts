import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Store,
  UsersRound,
  FileBarChart,
  BookOpen,
  Trophy,
  Settings,
  FlaskConical,
  ClipboardList,
  Award,
} from 'lucide-react';

export interface TourStep {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const adminTourSteps: TourStep[] = [
  {
    icon: LayoutDashboard,
    title: 'Welcome to the Admin Console',
    description: 'A quick look around your command center for managing labs, students, and reports.',
  },
  {
    icon: Store,
    title: 'Lab Marketplace',
    description: 'Browse and purchase lab environments to make available to your students.',
  },
  {
    icon: UsersRound,
    title: 'Student Management',
    description: 'Create groups, enroll students, and assign labs. Open any group to see live progress, score, and grade for each student.',
  },
  {
    icon: FileBarChart,
    title: 'Reports',
    description: 'Review past lab assignments per group, export results, and track scores and grades over time.',
  },
  {
    icon: BookOpen,
    title: 'Study Material',
    description: 'Upload and organize reference material for your students.',
  },
  {
    icon: Trophy,
    title: 'CTF Manager',
    description: 'Create and schedule Capture-The-Flag competitions for your students.',
  },
  {
    icon: Settings,
    title: 'Settings',
    description: 'Manage your organization profile, notifications, and account security.',
  },
];

export const studentTourSteps: TourStep[] = [
  {
    icon: LayoutDashboard,
    title: 'Welcome to CyberRange',
    description: 'Your dashboard shows your score, rank, and recent activity at a glance.',
  },
  {
    icon: FlaskConical,
    title: 'Available Labs',
    description: 'Browse and start hands-on cybersecurity labs whenever you like.',
  },
  {
    icon: ClipboardList,
    title: 'Assignments',
    description: 'Labs assigned to you by your instructor appear here, with deadlines and progress.',
  },
  {
    icon: Trophy,
    title: 'CTF Competitions',
    description: 'Join live Capture-The-Flag events and compete on the scoreboard.',
  },
  {
    icon: Award,
    title: 'My Statistics',
    description: 'Track your score, badges, certificates, and completed labs — including your grade for each one.',
  },
  {
    icon: BookOpen,
    title: 'Study Material',
    description: 'Reference guides and material shared by your instructors.',
  },
  {
    icon: Settings,
    title: 'Settings',
    description: 'Update your profile, password, and notification preferences.',
  },
];
