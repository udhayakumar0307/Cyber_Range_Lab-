import React, { useState } from "react";
import { ShieldCheck, ShieldAlert, Clock, AlertTriangle, Play, CheckCircle } from "lucide-react";
import { usePrivacySoc } from "../context/PrivacySocContext.jsx";

export default function BreachCenter() {
  const { addNotification } = usePrivacySoc();
  const [exposureDetected, setExposureDetected] = useState(true);
  const [simulating, setSimulating] = useState(false);

  const incidents = [
    {
      id: 1,
      event: "Potential API Payload Leak Blocked",
      desc: "Checkout API call containing unmasked Aadhaar records intercepted by Sentinel payload filter.",
      time: "15 mins ago",
      status: "Contained",
      color: "var(--success)"
    },
    {
      id: 2,
      event: "Notice Coverage Warning Alert",
      desc: "Marketing consents updated without mandatory purpose disclosure. Rule 2 Notice coverage degraded.",
      time: "2 hours ago",
      status: "Warning Resolved",
      color: "var(--warning)"
    },
    {
      id: 3,
      event: "Unencrypted JWT Telemetry Sync Logged",
      desc: "Bearer tokens detected in cleartext in debug trace records. Gateway routing modified.",
      time: "1 day ago",
      status: "Patched",
      color: "var(--success)"
    }
  ];

  const handleSimulate = () => {
    setSimulating(true);
    setTimeout(() => {
      setSimulating(false);
      setExposureDetected(true);
      addNotification("Breach simulation complete: Potential checkout credential exposure detected.", "critical");
    }, 2000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow" style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            <ShieldAlert size={12} /> DPDP Sec. 8(6) Breach Management
          </span>
          <h1 className="page-title">Breach Response Center</h1>
          <p className="page-subtitle">Simulate threat vectors, execute containment playbooks, and log statutory breach notices.</p>
        </div>
      </div>

      {/* Large Status Card */}
      <div className="glass-panel" style={{ padding: "32px", overflow: "hidden", position: "relative", marginBottom: "24px" }}>
        {exposureDetected ? (
          <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
            <div 
              style={{ 
                background: "rgba(239, 68, 68, 0.1)", 
                padding: "20px", 
                borderRadius: "50%",
                color: "var(--critical)",
                animation: "pulseRed 2s infinite",
                border: "2px solid rgba(239,68,68,0.2)"
              }}
            >
              <ShieldAlert size={40} />
            </div>
            <div style={{ flexGrow: 1 }}>
              <span className="severity-badge critical" style={{ marginBottom: "12px", display: "inline-block" }}>
                Potential Data Exposure Detected
              </span>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
                Aadhaar identifiers mapped on unencrypted API routes
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.92rem", lineHeight: "1.5", marginBottom: "20px" }}>
                DPDP compliance audits flagged 8 client minor accounts transmitting national identity records without matching guardian signatures inside the `/api/v1/checkout` payment payload.
              </p>
              <div style={{ display: "flex", gap: "12px" }}>
                <button className="premium-btn primary" onClick={() => setExposureDetected(false)}>
                  <span>Exclusion Confirmed (Mark Clean)</span>
                </button>
                <button className="premium-btn secondary" onClick={handleSimulate} disabled={simulating}>
                  <span>{simulating ? "Running Threat Simulation..." : "Run Threat Simulation"}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
            <div 
              style={{ 
                background: "rgba(16, 185, 129, 0.1)", 
                padding: "20px", 
                borderRadius: "50%",
                color: "var(--success)",
                border: "2px solid rgba(16,185,129,0.2)"
              }}
            >
              <ShieldCheck size={40} className="animate-pulse" />
            </div>
            <div style={{ flexGrow: 1 }}>
              <span className="severity-badge success" style={{ marginBottom: "12px", display: "inline-block" }}>
                System Secure & Protected
              </span>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
                Zero active exposure vectors scanned
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.92rem", lineHeight: "1.5", marginBottom: "20px" }}>
                All API gateways are matching encryption standards, and consent schemas represent active ROPA audit policies. No leaking data tokens detected in the last scan.
              </p>
              <div style={{ display: "flex", gap: "12px" }}>
                <button className="premium-btn secondary" onClick={() => setExposureDetected(true)}>
                  <span>Enable Simulated Exposure State</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Incident History & Simulation Timeline */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <h4 style={{ fontSize: "0.85rem", fontWeight: "800", textTransform: "uppercase", color: "var(--text-soft)", marginBottom: "20px" }}>
          Active Threat Response Log Timeline
        </h4>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative" }}>
          {/* Vertical Timeline Bar */}
          <div style={{ position: "absolute", left: "19px", top: "10px", bottom: "10px", width: "2px", background: "rgba(255,255,255,0.04)" }} />

          {incidents.map(inc => (
            <div key={inc.id} style={{ display: "flex", gap: "20px", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
              <div 
                style={{ 
                  width: "40px", 
                  height: "40px", 
                  borderRadius: "50%", 
                  background: "#111827", 
                  border: `2px solid ${inc.color}`, 
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <Clock size={16} style={{ color: inc.color }} />
              </div>
              <div 
                style={{ 
                  flexGrow: 1, 
                  background: "rgba(255,255,255,0.01)", 
                  border: "1px solid var(--border-card)", 
                  borderRadius: "8px", 
                  padding: "16px" 
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <p style={{ fontWeight: "600", color: "var(--text-primary)", fontSize: "0.9rem" }}>{inc.event}</p>
                  <span style={{ fontSize: "0.75rem", color: inc.color, fontWeight: "700" }}>{inc.status}</span>
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--text-body)", lineHeight: "1.4" }}>
                  {inc.desc}
                </p>
                <span style={{ fontSize: "0.7rem", color: "var(--text-soft)", marginTop: "10px", display: "inline-block" }}>
                  Triggered: {inc.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
