import React from "react";

export default function MinorConsentPage() {
  return (
    <section className="module-section">
      <div className="glass-panel panel-card">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Module</p>
            <h3>Minor Consent</h3>
          </div>
          <span className="panel-badge">Guardians</span>
        </div>
        <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
          Guardian approvals, minor records, and pending verification workflows can live here without cluttering the dashboard.
        </p>
      </div>
    </section>
  );
}
