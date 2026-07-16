import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

export function App() {
  return (
    <BrowserRouter>
      <Routes>
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

        {/* Default Route Redirect */}
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
