export type LabDifficulty = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export type UserRole = 'Admin' | 'User' | 'Instructor';

export type AccountStatus = 'Active' | 'Inactive' | 'Pending';

export interface AdminMetric {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  period: string;
  iconName: string;
  colorTheme: 'blue' | 'green' | 'orange' | 'purple';
}

export interface OperationalActivity {
  id: string;
  timestamp: string;
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
  action: string;
  target: string;
  status: 'success' | 'warning' | 'info';
}

export interface LabModule {
  id: string;
  title: string;
  durationMinutes: number;
  points: number;
}

export interface SecurityLab {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  difficulty: LabDifficulty;
  category: string;
  priceInr: number;
  durationHours: number;
  rating: number;
  reviewCount: number;
  prerequisites: string[];
  skillsCovered: string[];
  modules: LabModule[];
  isPurchased?: boolean;
  activeSessionsCount?: number;
  purchasedDate?: string;
  assignedGroupCount?: number;
}

export type LicenseTierType = 'perpetual' | 'annual_subscription' | 'per_user_seats';

export interface LicenseOption {
  type: LicenseTierType;
  label: string;
  description: string;
  baseMultiplier: number;
  unitPrice: number;
}

export interface LabPurchaseOrder {
  labId: string;
  licenseType: LicenseTierType;
  seats: number;
  unitPrice: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string;
}

export interface UserGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  createdDate: string;
}

export interface PlatformUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  groupName: string;
  groupId: string;
  status: AccountStatus;
  joinedDate: string;
  lastActive: string;
  score: number;
  completedLabsCount: number;
  avatarUrl?: string;
}

export interface CsvImportUserRow {
  fullName: string;
  email: string;
  role: string;
  groupName: string;
  isValid: boolean;
  errorMessage?: string;
}
