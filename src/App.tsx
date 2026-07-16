import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { LabMarketplace } from './pages/admin/LabMarketplace';
import { LabPurchaseConfirmation } from './pages/admin/LabPurchaseConfirmation';
import { UserManagement } from './pages/admin/UserManagement';
import { GroupManagement } from './pages/admin/GroupManagement';
import { LabAllocation } from './pages/admin/LabAllocation';
import { LabControlPanel } from './pages/admin/LabControlPanel';
import { MonitoringAnalytics } from './pages/admin/MonitoringAnalytics';
import { AdminSettings } from './pages/admin/AdminSettings';

// Auth Section Pages (1.1 - 1.4)
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { RegisterPage } from './pages/auth/RegisterPage';

// User Layout & Pages
import { UserLayout } from './components/user/UserLayout';
import { UserDashboard } from './pages/user/UserDashboard';
import { AvailableLabs } from './pages/user/AvailableLabs';
import { ChallengeSession } from './pages/user/ChallengeSession';
import { ProgressTracking } from './pages/user/ProgressTracking';
import { LeaderboardPortal } from './pages/user/LeaderboardPortal';
import { UserProfile } from './pages/user/UserProfile';

// Shared Pages (4.1 to 4.5)
import { RootRedirect } from './pages/shared/RootRedirect';
import { NotFoundPage } from './pages/shared/NotFoundPage';
import { ServerErrorPage } from './pages/shared/ServerErrorPage';
import { MaintenancePage } from './pages/shared/MaintenancePage';
import { UnauthorizedPage } from './pages/shared/UnauthorizedPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 4.1 Root Auto-Redirect Gateway */}
        <Route path="/" element={<RootRedirect />} />

        {/* Auth Flow Routes (1.1 - 1.4) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* User Portal Dashboard (Page 3.1) */}
        <Route
          path="/dashboard"
          element={
            <UserLayout>
              <UserDashboard />
            </UserLayout>
          }
        />
        <Route
          path="/labs"
          element={
            <UserLayout>
              <AvailableLabs />
            </UserLayout>
          }
        />
        <Route
          path="/labs/:labId/session/:sessionId"
          element={<ChallengeSession />}
        />
        <Route
          path="/progress"
          element={
            <UserLayout>
              <ProgressTracking />
            </UserLayout>
          }
        />
        <Route
          path="/leaderboards"
          element={
            <UserLayout>
              <LeaderboardPortal />
            </UserLayout>
          }
        />
        <Route
          path="/profile"
          element={
            <UserLayout>
              <UserProfile />
            </UserLayout>
          }
        />
        <Route path="/error" element={<ServerErrorPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Admin Management Suite Routes (2.1 - 2.9) */}
        <Route
          path="/admin/dashboard"
          element={
            <AdminLayout>
              <AdminDashboard />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/labs"
          element={
            <AdminLayout>
              <LabMarketplace />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/labs/:labId/purchase"
          element={
            <AdminLayout>
              <LabPurchaseConfirmation />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminLayout>
              <UserManagement />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/groups"
          element={
            <AdminLayout>
              <GroupManagement />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/allocations"
          element={
            <AdminLayout>
              <LabAllocation />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/labs/control"
          element={
            <AdminLayout>
              <LabControlPanel />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/monitoring"
          element={
            <AdminLayout>
              <MonitoringAnalytics />
            </AdminLayout>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <AdminLayout>
              <AdminSettings />
            </AdminLayout>
          }
        />

        {/* 4.2 Catch-All 404 Page Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
