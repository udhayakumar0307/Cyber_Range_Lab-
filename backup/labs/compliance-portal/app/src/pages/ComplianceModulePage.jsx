import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FileCheck2, Scale, ShieldCheck, Sparkles } from "lucide-react";
import { usePrivacySoc } from "../context/PrivacySocContext.jsx";
import DpdpComplianceOverview from "../components/DpdpComplianceOverview.jsx";

const tabs = [
  {
    id: "overview",
    label: "Overview",
    path: "/compliance",
    description: "See the current compliance posture and most urgent gaps",
    icon: ShieldCheck
  },
  {
    id: "dpdp",
    label: "DPDP Compliance",
    path: "/compliance/dpdp",
    description: "Review statutory readiness and rule coverage",
    icon: Scale
  },
  {
    id: "dpia",
    label: "DPIA",
    path: "/compliance/dpia",
    description: "Launch and track data protection impact assessments",
    icon: Sparkles
  },
  {
    id: "minor",
    label: "Minor Consent",
    path: "/compliance/minor-consent",
    description: "Validate guardian approvals and child-specific controls",
    icon: FileCheck2
  }
];

export default function ComplianceModulePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dpdpCompliance, readinessScores, loading, error, activeApiKey } = usePrivacySoc();
  const activeTab = tabs.find((tab) => location.pathname === tab.path)?.id || "overview";
  const activeEntry = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  return (
    <div className="module-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Compliance Operations</span>
          <h1 className="page-title">Compliance</h1>
          <p className="page-subtitle">Keep regulatory and policy obligations visible, prioritized, and actionable.</p>
        </div>
      </div>

      <div className="module-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button key={tab.id} type="button" className={`module-tab ${isActive ? "active" : ""}`} onClick={() => navigate(tab.path)}>
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="glass-panel module-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Module Focus</p>
            <h3>{activeEntry.label}</h3>
          </div>
          <span className="panel-badge">Regulatory</span>
        </div>
        <p className="module-panel-copy">{activeEntry.description}</p>

        <div className="module-metrics-grid">
          <div className="module-metric-card">
            <strong>{readinessScores.dpdp}%</strong>
            <span>DPDP readiness</span>
          </div>
          <div className="module-metric-card">
            <strong>{dpdpCompliance.rulesReviewed}</strong>
            <span>Rules reviewed</span>
          </div>
          <div className="module-metric-card">
            <strong>{dpdpCompliance.needsAction}</strong>
            <span>Needs action</span>
          </div>
          <div className="module-metric-card">
            <strong>{dpdpCompliance.criticalRisks}</strong>
            <span>Critical risks</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="glass-panel module-panel">
          <p className="module-panel-copy">Refreshing compliance telemetry from the existing readiness engine.</p>
        </div>
      )}

      {error && (
        <div className="glass-panel module-panel">
          <p className="module-panel-copy" style={{ color: "var(--critical)" }}>{error}</p>
        </div>
      )}

      {!activeApiKey && !loading && (
        <div className="glass-panel module-panel">
          <p className="module-panel-copy">No live connection is active yet. Connect an API key to populate DPDP compliance and assessment metrics from the existing compliance services.</p>
        </div>
      )}

      {!loading && activeApiKey && <DpdpComplianceOverview compliance={dpdpCompliance} />}

      <div className="module-card-grid">
        <button type="button" className="module-action-card" onClick={() => navigate("/compliance/dpdp")}>
          <h4>Open DPDP readiness</h4>
          <p>Inspect the current compliance score and rule-level posture.</p>
        </button>
        <button type="button" className="module-action-card" onClick={() => navigate("/dpia")}>
          <h4>Launch DPIA</h4>
          <p>Start a new assessment or review a prior impact analysis.</p>
        </button>
        <button type="button" className="module-action-card" onClick={() => navigate("/minor-consent")}>
          <h4>Check minor consent</h4>
          <p>Verify guardian approvals and child-related consent controls.</p>
        </button>
      </div>
    </div>
  );
}
