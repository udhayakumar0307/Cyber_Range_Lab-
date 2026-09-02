import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#0052CC] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Normalise role: the DB stores 'student' but routes use 'user' as the
  // canonical non-admin role. Treat them as equivalent here so we don't have
  // to change every single route definition in App.tsx.
  const userRole = user.role.toLowerCase();
  const normalisedUserRole = userRole === 'student' ? 'user' : userRole;
  const isAllowed = !allowedRoles || allowedRoles.some(r => {
    const roleLower = r.toLowerCase();
    if (roleLower === normalisedUserRole) return true;
    if (roleLower === 'admin' && (userRole === 'super_admin' || userRole === 'system_admin')) return true;
    return false;
  });

  if (!isAllowed) {
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/admin/login" replace />;
    }
    return <Navigate to="/unauthorized" replace />;
  }

  const ADMIN_ROLES = ['admin', 'super_admin', 'system_admin', 'professor'];
  const isAdminRole = ADMIN_ROLES.includes((user.role || '').toLowerCase());

  // Onboarding Redirection Guard for students
  const isLabSessionRoute = location.pathname.includes('/labs/') || location.pathname.includes('/session');
  if (!isAdminRole && user.profile_completed === false && location.pathname !== '/onboarding' && !isLabSessionRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!isAdminRole && user.profile_completed === true && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }


  return <>{children}</>;
};
