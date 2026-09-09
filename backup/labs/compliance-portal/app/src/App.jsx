import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { PrivacySocProvider } from "./context/PrivacySocContext";
import MainLayout from "./layout/MainLayout";

// Pages
import Overview from "./pages/Overview";
import IntegrationPage from "./pages/IntegrationPage";
import ConsentModulePage from "./pages/ConsentModulePage";
import DpdpCompliance from "./pages/DpdpCompliance";
import PiiClassification from "./pages/PiiClassification";
import AnonymizationPage from "./pages/AnonymizationPage";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

import "./styles.css";

// Served at the domain root by default; under a reverse-proxy sub-path
// (VITE_BASE_PATH=/compliance-lab/) Vite sets BASE_URL and the router needs it
// as its basename so client-side routes resolve.
const routerBasename = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "") || "/";

export default function App() {
  return (
    <ThemeProvider>
      <PrivacySocProvider>
        <ToastProvider>
          <Router basename={routerBasename}>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Overview />} />
                <Route path="integration" element={<IntegrationPage />} />
                <Route path="consent-management" element={<ConsentModulePage />} />
                <Route path="dpdp-compliance" element={<DpdpCompliance />} />
                <Route path="pii-management" element={<PiiClassification />} />
                <Route path="anonymization" element={<AnonymizationPage />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </Router>
        </ToastProvider>
      </PrivacySocProvider>
    </ThemeProvider>
  );
}
