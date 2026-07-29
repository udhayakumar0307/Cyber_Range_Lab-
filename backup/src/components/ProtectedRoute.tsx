import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/admin/login" replace />;
    }
    return <Navigate to="/unauthorized" replace />;
  }

  // Onboarding Redirection Guard for students
  if (user.role !== 'admin' && user.profile_completed === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  if (user.role !== 'admin' && user.profile_completed === true && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
