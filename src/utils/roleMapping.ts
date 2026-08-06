/**
 * Centralized Role Display Mapping Utility
 * Maps internal database role identifiers to standardized display names
 * without altering stored database values or backend RBAC logic.
 */

export const ROLE_DISPLAY_MAP: Record<string, string> = {
  SYSTEM_ADMIN: 'System Admin',
  SYSTEM_ADMINISTRATOR: 'System Admin',
  SYS_ADMIN: 'System Admin',
  CIA: 'CIA',
  CYBER_INFRASTRUCTURE_ADMINISTRATOR: 'CIA',
  ADMIN: 'Admin',
  SECURITY_OFFICER: 'Security Officer',
  PROFESSOR: 'Instructor',
  INSTRUCTOR: 'Instructor',
  USER: 'Regular User',
  STUDENT: 'Regular User',
  INDIVIDUAL: 'Regular User'
};

export const getRoleDisplayName = (role?: string | null): string => {
  if (!role) return 'Regular User';
  const cleanRole = role.trim();
  const normalizedKey = cleanRole.toUpperCase().replace(/\s+/g, '_');
  return ROLE_DISPLAY_MAP[normalizedKey] || cleanRole;
};
