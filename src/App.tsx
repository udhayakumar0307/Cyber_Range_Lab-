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

        {/* 4.3 500 Error Page */}
        <Route path="/error" element={<ServerErrorPage />} />

        {/* 4.4 Maintenance Mode Page */}
        <Route path="/maintenance" element={<MaintenancePage />} />

        {/* 4.5 403 Access Denied Page */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Full Admin Section Routes (Pages 2.1 to 2.9) */}
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

        {/* 4.2 404 Catch-All Page Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
