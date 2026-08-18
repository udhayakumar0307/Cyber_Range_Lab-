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
  title?: string | null;
  durationMinutes?: number | null;
  points?: number | null;
}

export interface SecurityLab {
  id: string;
  title?: string | null;
  shortDescription?: string | null;
  fullDescription?: string | null;
  difficulty?: LabDifficulty | null;
  category?: string | null;
  priceInr?: number | null;
  isFree?: boolean;
  durationHours?: number | null;
  durationDisplay?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  prerequisites?: string[] | null;
  skillsCovered?: string[] | null;
  modules?: LabModule[] | null;
  dockerImage?: string | null;
  registryPath?: string | null;
  isPurchased?: boolean;
  isCompleted?: boolean;
  certificateId?: string | null;
  certificatePdfUrl?: string | null;
  timeSpentSeconds?: number | null;
  timeSpentDisplay?: string | null;
  assignedTo?: string | null;
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
  db_id?: number;
  name: string;
  description: string;
  memberCount: number;
  createdDate: string;
}

export interface PlatformUser {
  id: string;
  db_id?: number;
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
  rollNumber?: string;
  department?: string;
  year?: string;
  phone?: string;
}

export interface CsvImportUserRow {
  fullName: string;
  email: string;
  role: string;
  groupName: string;
  isValid: boolean;
  errorMessage?: string;
}
