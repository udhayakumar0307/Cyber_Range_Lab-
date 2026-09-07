import React, { useState } from "react";
import ApiArchitecture from "../components/ApiArchitecture.jsx";
import { AlertOctagon, Terminal, Flame, Zap, ShieldCheck, Check, Clipboard } from "lucide-react";

export default function RiskCenter() {
  const [copiedId, setCopiedId] = useState(null);

  const activeRisks = [
    {
      id: "risk-1",
      api: "/api/v1/checkout",
      severity: "critical",
      impact: "High - Exposes national identities (Aadhaar/PAN) in plaintext JSON checkout objects.",
      fix: "app.post('/api/checkout', encrypt_field('aadhaar'))",
      owner: "Payments Core Team"
    },
    {
      id: "risk-2",
      api: "/api/v1/user/profile",
      severity: "high",
      impact: "Medium - Telemetry logs store plaintext mobile numbers without masking rules.",
      fix: "mask_mobile(payload.phone)",
      owner: "Identity Services"
    },
    {
      id: "risk-3",
      api: "https://stripe.com/*",
      severity: "medium",
      impact: "Low - Cross-border data sync forwards address profiles to unapproved server zones.",
      fix: "restrict_cross_border(payload.address)",
      owner: "Fintech Integration"
    }
  ];

  const handleCopy = (id, code) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow" style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            <AlertOctagon size={12} /> DPDP Sec. 8(5) Vulnerability Matrix
          </span>
          <h1 className="page-title">Risk Command Center</h1>
          <p className="page-subtitle">Mitigate threat models, monitor API surface attack vectors and push cryptographic patches.</p>
        </div>
      </div>

      {/* API Topology Interactive Section */}
      <ApiArchitecture />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "20px", marginTop: "24px" }}>
        {/* Left Column: Heatmap Risk Distribution */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <h4 style={{ fontSize: "0.85rem", fontWeight: "800", textTransform: "uppercase", color: "var(--text-soft)", marginBottom: "16px" }}>
            Vulnerability Heatmap
          </h4>
          <div className="heatmap-container">
            <div className="heatmap-cell critical">
              2
              <span>Critical</span>
            </div>
            <div className="heatmap-cell high">
              3
              <span>High</span>
            </div>
            <div className="heatmap-cell medium">
              4
              <span>Medium</span>
            </div>
            <div className="heatmap-cell low">
              6
              <span>Low</span>
            </div>
          </div>
          <p style={{ color: "var(--text-soft)", fontSize: "0.78rem", lineHeight: "1.4", marginTop: "16px" }}>
            Heatmap quadrants represent active API vulnerabilities correlated by payload sensitivity and data principal volumes.
          </p>
        </div>

        {/* Right Column: Top Active Risks & Recommendations */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <h4 style={{ fontSize: "0.85rem", fontWeight: "800", textTransform: "uppercase", color: "var(--text-soft)", marginBottom: "16px" }}>
            Active Vulnerability Registry
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {activeRisks.map(risk => (
              <div 
                key={risk.id} 
                style={{ 
                  padding: "16px", 
                  background: "rgba(255,255,255,0.01)", 
                  border: "1px solid var(--border-card)", 
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <code style={{ fontSize: "0.88rem", fontWeight: "700", color: "var(--text-primary)" }}>
                    {risk.api}
                  </code>
                  <span className={`severity-badge ${risk.severity}`}>{risk.severity}</span>
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--text-body)", lineHeight: "1.4" }}>
                  <strong>Impact:</strong> {risk.impact}
                </p>
                <div 
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between", 
                    background: "#09090b", 
                    padding: "8px 12px", 
                    borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.04)"
                  }}
                >
                  <code style={{ fontSize: "0.76rem", color: "#a5b4fc", fontFamily: "monospace" }}>
                    {risk.fix}
                  </code>
                  <button 
                    onClick={() => handleCopy(risk.id, risk.fix)}
                    style={{ background: "transparent", border: "none", color: "var(--text-soft)", cursor: "pointer", display: "flex" }}
                  >
                    {copiedId === risk.id ? <Check size={14} style={{ color: "var(--success)" }} /> : <Clipboard size={14} />}
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-soft)" }}>
                  <span>Owner: {risk.owner}</span>
                  <span>Action: Deploy patch</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
