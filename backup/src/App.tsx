/**
 * App.tsx — Route Lazy Loading applied.
 *
 * OPTIMIZATION 1: Every page component is now loaded via React.lazy() +
 * dynamic import(). Vite automatically splits each lazy import into a
 * separate JS chunk. Only the chunk for the currently visited route is
 * downloaded, drastically reducing initial bundle size.
 *
 * Layout components (AdminLayout, UserLayout) remain statically imported
 * because they are shared wrappers loaded immediately on first navigation
 * to that section — lazy-loading them would cause visible layout flash.
 *
 * Security: ProtectedRoute, AuthProvider, ThemeProvider are unchanged.
 * All RBAC checks run before any lazy component renders.
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageLoader } from './components/PageLoader';

// ─── Layouts (statically imported — shared shell, loaded once) ───────────────
import { AdminLayout } from './components/admin/AdminLayout';
import { UserLayout } from './components/user/UserLayout';

// ─── Auth Chunk ───────────────────────────────────────────────────────────────
const LoginPage            = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const AdminLoginPage       = lazy(() => import('./pages/auth/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
const ForgotPasswordPage   = lazy(() => import('./pages/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage    = lazy(() => import('./pages/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const RegisterPage         = lazy(() => import('./pages/auth/RegisterPage').then(m => ({ default: m.RegisterPage })));
const AdminRegisterPage    = lazy(() => import('./pages/auth/AdminRegisterPage').then(m => ({ default: m.AdminRegisterPage })));
const OnboardingPage       = lazy(() => import('./pages/auth/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const VerificationPage     = lazy(() => import('./pages/shared/VerificationPage').then(m => ({ default: m.VerificationPage })));

// ─── Admin Chunk ──────────────────────────────────────────────────────────────
const AdminDashboard       = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const LabMarketplace       = lazy(() => import('./pages/admin/LabMarketplace').then(m => ({ default: m.LabMarketplace })));
const LabPurchaseConfirmation = lazy(() => import('./pages/admin/LabPurchaseConfirmation').then(m => ({ default: m.LabPurchaseConfirmation })));
const UserManagement       = lazy(() => import('./pages/admin/UserManagement').then(m => ({ default: m.UserManagement })));
const StudentDetailsPage   = lazy(() => import('./pages/admin/StudentDetailsPage').then(m => ({ default: m.StudentDetailsPage })));
const GroupManagement      = lazy(() => import('./pages/admin/GroupManagement').then(m => ({ default: m.GroupManagement })));
const LabAllocation        = lazy(() => import('./pages/admin/LabAllocation').then(m => ({ default: m.LabAllocation })));
const LabControlPanel      = lazy(() => import('./pages/admin/LabControlPanel').then(m => ({ default: m.LabControlPanel })));
const MonitoringAnalytics  = lazy(() => import('./pages/admin/MonitoringAnalytics').then(m => ({ default: m.MonitoringAnalytics })));
const AdminSettings        = lazy(() => import('./pages/admin/AdminSettings').then(m => ({ default: m.AdminSettings })));
const LabSchedulerPage     = lazy(() => import('./pages/admin/LabSchedulerPage').then(m => ({ default: m.LabSchedulerPage })));
const CtfAdminPage         = lazy(() => import('./pages/admin/CtfAdminPage').then(m => ({ default: m.CtfAdminPage })));
const SystemAuditPortal    = lazy(() => import('./pages/admin/SystemAuditPortal').then(m => ({ default: m.SystemAuditPortal })));
const SystemPortal         = lazy(() => import('./pages/admin/SystemPortal').then(m => ({ default: m.SystemPortal })));
const AdminProfilePage     = lazy(() => import('./pages/admin/AdminProfilePage').then(m => ({ default: m.AdminProfilePage })));
const PaymentHistoryPage   = lazy(() => import('./pages/admin/PaymentHistoryPage').then(m => ({ default: m.PaymentHistoryPage })));
const PurchasedLabsPage    = lazy(() => import('./pages/admin/PurchasedLabsPage').then(m => ({ default: m.PurchasedLabsPage })));
const ReportsPage          = lazy(() => import('./pages/admin/ReportsPage').then(m => ({ default: m.ReportsPage })));

// ─── User Chunk ───────────────────────────────────────────────────────────────
const UserDashboard        = lazy(() => import('./pages/user/UserDashboard').then(m => ({ default: m.UserDashboard })));
const AvailableLabs        = lazy(() => import('./pages/user/AvailableLabs').then(m => ({ default: m.AvailableLabs })));
const CartPage             = lazy(() => import('./pages/user/CartPage').then(m => ({ default: m.CartPage })));
const ChallengeSession     = lazy(() => import('./pages/user/ChallengeSession').then(m => ({ default: m.ChallengeSession })));
const CommandLineLabPage    = lazy(() => import('./pages/user/CommandLineLabPage').then(m => ({ default: m.CommandLineLabPage })));
const CryptographyLabPage   = lazy(() => import('./pages/user/CryptographyLabPage').then(m => ({ default: m.CryptographyLabPage })));
const CloudSecurityLabPage  = lazy(() => import('./pages/user/CloudSecurityLabPage').then(m => ({ default: m.CloudSecurityLabPage })));
const PuzzleLabPage         = lazy(() => import('./pages/user/PuzzleLabPage').then(m => ({ default: m.PuzzleLabPage })));
const TechCorpLabSession    = lazy(() => import('./pages/user/TechCorpLabSession').then(m => ({ default: m.TechCorpLabSession })));
const ProgressTracking     = lazy(() => import('./pages/user/ProgressTracking').then(m => ({ default: m.ProgressTracking })));
const LeaderboardPortal    = lazy(() => import('./pages/user/LeaderboardPortal').then(m => ({ default: m.LeaderboardPortal })));
const ProfilePage          = lazy(() => import('./pages/user/ProfilePage').then(m => ({ default: m.ProfilePage })));
const SettingsPage         = lazy(() => import('./pages/user/SettingsPage').then(m => ({ default: m.SettingsPage })));
const StudyMaterial        = lazy(() => import('./pages/user/StudyMaterial').then(m => ({ default: m.StudyMaterial })));
const PdfViewerPage        = lazy(() => import('./pages/user/PdfViewerPage').then(m => ({ default: m.PdfViewerPage })));
const AssignedLabsPage     = lazy(() => import('./pages/user/AssignedLabsPage').then(m => ({ default: m.AssignedLabsPage })));
const MyLabsPage           = lazy(() => import('./pages/user/MyLabsPage').then(m => ({ default: m.MyLabsPage })));
const StatisticsPage       = lazy(() => import('./pages/user/StatisticsPage').then(m => ({ default: m.StatisticsPage })));

// ─── CTF Chunk ────────────────────────────────────────────────────────────────
const CtfPortalPage        = lazy(() => import('./pages/user/CtfPortalPage').then(m => ({ default: m.CtfPortalPage })));
const CtfArenaPage         = lazy(() => import('./pages/user/CtfArenaPage').then(m => ({ default: m.CtfArenaPage })));
const CtfScoreboardPage    = lazy(() => import('./pages/user/CtfScoreboardPage').then(m => ({ default: m.CtfScoreboardPage })));

// ─── Shared / Error Pages ─────────────────────────────────────────────────────
const RootRedirect         = lazy(() => import('./pages/shared/RootRedirect').then(m => ({ default: m.RootRedirect })));
const NotFoundPage         = lazy(() => import('./pages/shared/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const ServerErrorPage      = lazy(() => import('./pages/shared/ServerErrorPage').then(m => ({ default: m.ServerErrorPage })));
const MaintenancePage      = lazy(() => import('./pages/shared/MaintenancePage').then(m => ({ default: m.MaintenancePage })));
const UnauthorizedPage     = lazy(() => import('./pages/shared/UnauthorizedPage').then(m => ({ default: m.UnauthorizedPage })));
const NotificationCenterPage = lazy(() => import('./pages/shared/NotificationCenterPage').then(m => ({ default: m.NotificationCenterPage })));

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          {/*
           * Single top-level Suspense boundary.
           * PageLoader is shown while any lazy chunk is downloading.
           * ErrorBoundary above each lazy admin page catches chunk-load errors.
           */}
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Root Gateway */}
              <Route path="/" element={<RootRedirect />} />

              {/* ── Public Verification Portal ───────────────────────────── */}
              <Route path="/certificate/verify/:certificateId" element={<VerificationPage />} />
              <Route path="/verify/:certificateId" element={<VerificationPage />} />

              {/* ── Auth Flow ─────────────────────────────────────────────── */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Admin Portal Routes */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin/register" element={<AdminRegisterPage />} />
              <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
              {/* Legacy / Alias Route Redirections */}
              <Route path="/adminform" element={<Navigate to="/admin/login" replace />} />
              <Route path="/admin-login" element={<Navigate to="/admin/login" replace />} />
              <Route path="/adminform/register" element={<Navigate to="/admin/register" replace />} />
              <Route path="/admin-register" element={<Navigate to="/admin/register" replace />} />
              <Route path="/adminform/forgot-password" element={<Navigate to="/admin/forgot-password" replace />} />
              <Route path="/adminform/reset-password" element={<Navigate to="/admin/reset-password" replace />} />

              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <OnboardingPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <UserLayout><UserDashboard /></UserLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/notifications"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <UserLayout><NotificationCenterPage /></UserLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/notifications"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminLayout><NotificationCenterPage /></AdminLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/labs"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <UserLayout><AvailableLabs /></UserLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assigned-labs"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <UserLayout><AssignedLabsPage /></UserLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-labs"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <UserLayout><MyLabsPage /></UserLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/available-labs"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <UserLayout><AvailableLabs /></UserLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cart"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <UserLayout><CartPage /></UserLayout>
                  </ProtectedRoute>
                }
              />



              {/* Command Line Lab — canonical routes only */}
              <Route
                path="/labs/command-line-lab"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <CommandLineLabPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/labs/command-line-lab/session"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <CommandLineLabPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/labs/command-line-lab/session/:sessionId"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <CommandLineLabPage />
                  </ProtectedRoute>
                }
              />

              {/* Cryptography Lab */}
              <Route
                path="/labs/cryptography-lab"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <CryptographyLabPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/labs/cryptography-lab/session"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <CryptographyLabPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/labs/cryptography-lab/session/:sessionId"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <CryptographyLabPage />
                  </ProtectedRoute>
                }
              />

              {/* Cloud Security Lab */}
              <Route
                path="/labs/cloud-security-lab"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <CloudSecurityLabPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/labs/cloud-security-lab/session"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <CloudSecurityLabPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/labs/cloud-security-lab/session/:sessionId"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <CloudSecurityLabPage />
                  </ProtectedRoute>
                }
              />

              {/* TechCorp Lab Session */}
              <Route
                path="/labs/techcorp/session"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <TechCorpLabSession />
                  </ProtectedRoute>
                }
              />
              {/* Puzzle Lab Session */}
              <Route
                path="/puzzle"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <PuzzleLabPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/labs/puzzle"
                element={<Navigate to="/puzzle" replace />}
              />
              <Route
                path="/labs/puzzle-lab"
                element={<Navigate to="/puzzle" replace />}
              />
              <Route
                path="/labs/puzzle-lab/session"
                element={<Navigate to="/puzzle" replace />}
              />
              {/* Dynamic Lab Challenge Session */}
              <Route
                path="/labs/:labSlug/session"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <ChallengeSession />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/labs/:labSlug/session/:sessionId"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <ChallengeSession />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/labs/lab1-recon/session"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <ChallengeSession />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recon-lab"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <ChallengeSession />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/labs/lab1-recon"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <ChallengeSession />
                  </ProtectedRoute>
                }
              />

              {/* Dynamic Lab Sessions */}
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

              {/* CTF Competition Engine */}
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
                    <UserLayout><ProgressTracking /></UserLayout>
                  </ProtectedRoute>
                }
              />

              {/* Leaderboard */}
              <Route
                path="/leaderboards"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <UserLayout><LeaderboardPortal /></UserLayout>
                  </ProtectedRoute>
                }
              />

              {/* User Profile */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <UserLayout><ProfilePage /></UserLayout>
                  </ProtectedRoute>
                }
              />

              {/* My Statistics */}
              <Route
                path="/statistics"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <UserLayout><StatisticsPage /></UserLayout>
                  </ProtectedRoute>
                }
              />

              {/* Settings */}
              <Route
                path="/settings"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <UserLayout><SettingsPage /></UserLayout>
                  </ProtectedRoute>
                }
              />

              {/* Study Material */}
              <Route
                path="/study-material"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <UserLayout><StudyMaterial /></UserLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/study-material/view/:id"
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <PdfViewerPage />
                  </ProtectedRoute>
                }
              />

              {/* Error Pages */}
              <Route path="/error" element={<ServerErrorPage />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* ── Admin Management Suite ────────────────────────────────── */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><AdminDashboard /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/labs"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><LabMarketplace /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/scheduler"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary><LabSchedulerPage /></ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/lab-scheduler"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary><LabSchedulerPage /></ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/ctf"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary><CtfAdminPage /></ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/labs/:labId/purchase"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><LabPurchaseConfirmation /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><UserManagement /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/student-management/student/:studentId"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><StudentDetailsPage /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/groups"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><GroupManagement /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/allocations"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><LabAllocation /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/labs/control"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><LabControlPanel /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/lab-control"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><LabControlPanel /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/monitoring"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><MonitoringAnalytics /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><ReportsPage /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/study-material"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><StudyMaterial /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><AdminSettings /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/profile"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><AdminProfilePage /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/payments"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><PaymentHistoryPage /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />

              {/* System Portal */}
              <Route path="/system" element={<SystemPortal />} />
              <Route
                path="/system/audit"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'system_admin', 'SYSTEM_ADMIN']}>
                    <ErrorBoundary>
                      <AdminLayout><SystemAuditPortal /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/payment-history"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><PaymentHistoryPage /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/purchased-labs"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminLayout><PurchasedLabsPage /></AdminLayout>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />

              {/* Catch-All 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
