import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredCapabilities?: string[];
}

const ADMIN_ROUTE_CAPABILITIES: Array<[string, string]> = [
  ['/admin/dashboard', 'DASHBOARD_VIEW'],
  ['/admin/labs', 'LAB_PURCHASE'],
  ['/admin/users', 'ROSTER_MANAGE'],
  ['/admin/groups', 'ROSTER_MANAGE'],
  ['/admin/allocations', 'LAB_ASSIGN'],
  ['/admin/monitoring', 'PROGRESS_VIEW'],
  ['/admin/reports', 'REPORT_VIEW'],
  ['/admin/rubrics', 'RUBRIC_VIEW'],
  ['/admin/gradebook', 'GRADE_VIEW'],
  ['/admin/study-material', 'CONTENT_MANAGE'],
  ['/admin/ctf', 'CTF_MANAGE'],
  ['/admin/settings', 'DASHBOARD_VIEW'],
  ['/admin/profile', 'DASHBOARD_VIEW'],
  ['/admin/notifications', 'DASHBOARD_VIEW'],
];

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requiredCapabilities,
}) => {
  const { user, isLoading, authorization, hasCapability } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#0052CC] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = (user.role || '').toLowerCase();
  const normalizedUserRole = userRole === 'student' ? 'user' : userRole;
  const effectiveRoles = new Set((authorization?.roles || []).map((role) => role.toLowerCase()));

  const isAllowedByRole = !allowedRoles || allowedRoles.some((requested) => {
    const role = requested.toLowerCase();
    if (role === normalizedUserRole || effectiveRoles.has(role)) return true;
    if (role === 'admin' && (effectiveRoles.has('admin') || effectiveRoles.has('system_admin'))) return true;
    return false;
  });

  const inferredCapability = location.pathname.startsWith('/admin')
    ? ADMIN_ROUTE_CAPABILITIES.find(([prefix]) => location.pathname.startsWith(prefix))?.[1]
    : undefined;
  const capabilitiesToCheck = requiredCapabilities?.length
    ? requiredCapabilities
    : inferredCapability
      ? [inferredCapability]
      : [];
  const isAllowedByCapability = capabilitiesToCheck.every(hasCapability);

  // For administrative routes, capability is authoritative. This prevents stale
  // App.tsx role lists from accidentally denying a valid scoped PROFESSOR/TA.
  const roleGateApplies = capabilitiesToCheck.length === 0 || !location.pathname.startsWith('/admin');
  if ((roleGateApplies && !isAllowedByRole) || !isAllowedByCapability) {
    return <Navigate to="/unauthorized" replace />;
  }

  const isAdministrative = hasCapability('DASHBOARD_VIEW') || hasCapability('SYSTEM_ADMIN');
  const isLabSessionRoute = location.pathname.includes('/labs/') || location.pathname.includes('/session');

  if (!isAdministrative && user.profile_completed === false && location.pathname !== '/onboarding' && !isLabSessionRoute) {
    return <Navigate to="/onboarding" replace />;
  }
  if (!isAdministrative && user.profile_completed === true && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
