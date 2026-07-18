import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
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

// Admin Scheduler & CTF Hub Pages
import { LabSchedulerPage } from './pages/admin/LabSchedulerPage';
import { CtfAdminPage } from './pages/admin/CtfAdminPage';

// Auth Section Pages
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { OnboardingPage } from './pages/auth/OnboardingPage';

// User Layout & Pages
import { UserLayout } from './components/user/UserLayout';
import { UserDashboard } from './pages/user/UserDashboard';
import { AvailableLabs } from './pages/user/AvailableLabs';
import { ChallengeSession } from './pages/user/ChallengeSession';
import { CommandLineLabSession } from './pages/user/CommandLineLabSession';
import { ProgressTracking } from './pages/user/ProgressTracking';
import { LeaderboardPortal } from './pages/user/LeaderboardPortal';
import { ProfilePage } from './pages/user/ProfilePage';
import { SettingsPage } from './pages/user/SettingsPage';

// Student CTF Competition Engine Pages
import { CtfPortalPage } from './pages/user/CtfPortalPage';
import { CtfArenaPage } from './pages/user/CtfArenaPage';
import { CtfScoreboardPage } from './pages/user/CtfScoreboardPage';

// Shared Pages
import { RootRedirect } from './pages/shared/RootRedirect';
import { NotFoundPage } from './pages/shared/NotFoundPage';
import { ServerErrorPage } from './pages/shared/ServerErrorPage';
import { MaintenancePage } from './pages/shared/MaintenancePage';
import { UnauthorizedPage } from './pages/shared/UnauthorizedPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            {/* Root Gateway */}
            <Route path="/" element={<RootRedirect />} />

            {/* Auth Flow Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />

            {/* User Portal Dashboard Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <UserLayout>
                    <UserDashboard />
                  </UserLayout>
                </ProtectedRoute>
              }
            />

            {/* Available Labs Routes */}
            <Route
              path="/labs"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <UserLayout>
                    <AvailableLabs />
                  </UserLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/available-labs"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <UserLayout>
                    <AvailableLabs />
                  </UserLayout>
                </ProtectedRoute>
              }
            />

            {/* Command Line Lab Routes & Aliases */}
            <Route
              path="/labs/command-line-lab/session"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <CommandLineLabSession />
                </ProtectedRoute>
              }
            />
            <Route
              path="/command-line-lab"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <CommandLineLabSession />
                </ProtectedRoute>
              }
            />
            <Route
              path="/labs/command-line-lab"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <CommandLineLabSession />
                </ProtectedRoute>
              }
            />

            {/* Dynamic Lab Challenge Sessions */}
            <Route
              path="/labs/:labId/session/:sessionId"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <ChallengeSession />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lab/:id"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <ChallengeSession />
                </ProtectedRoute>
              }
            />

            {/* Student CTF Competition Engine Routes */}
            <Route
              path="/ctf"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <CtfPortalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ctf/events/:eventId"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <CtfArenaPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ctf/events/:eventId/scoreboard"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <CtfScoreboardPage />
                </ProtectedRoute>
              }
            />

            {/* Progress Tracking */}
            <Route
              path="/progress"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <UserLayout>
                    <ProgressTracking />
                  </UserLayout>
                </ProtectedRoute>
              }
            />

            {/* Leaderboard */}
            <Route
              path="/leaderboards"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <UserLayout>
                    <LeaderboardPortal />
                  </UserLayout>
                </ProtectedRoute>
              }
            />

            {/* User Profile */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <UserLayout>
                    <ProfilePage />
                  </UserLayout>
                </ProtectedRoute>
              }
            />

            {/* Settings */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin']}>
                  <UserLayout>
                    <SettingsPage />
                  </UserLayout>
                </ProtectedRoute>
              }
            />

            {/* Error Pages */}
            <Route path="/error" element={<ServerErrorPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Admin Management Suite Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <AdminDashboard />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/labs"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <LabMarketplace />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/scheduler"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <LabSchedulerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ctf"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <CtfAdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/labs/:labId/purchase"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <LabPurchaseConfirmation />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <UserManagement />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/groups"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <GroupManagement />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/allocations"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <LabAllocation />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/labs/control"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <LabControlPanel />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/monitoring"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <MonitoringAnalytics />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <AdminSettings />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* Catch-All 404 Page Not Found */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
