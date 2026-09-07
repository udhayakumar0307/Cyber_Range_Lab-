import React from "react";
import { ShieldCheck } from "lucide-react";

export default function ConsentManagementPage() {
  return (
    <section className="module-section">
      <div className="glass-panel panel-card">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Module</p>
            <h3>Consent Management</h3>
          </div>
          <span className="panel-badge">Dedicated</span>
        </div>
        <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
          This module now hosts the consent records, history, grant/revoke workflows, and consent analytics that were previously crowded into the landing page.
        </p>
      </div>
    </section>
  );
}
