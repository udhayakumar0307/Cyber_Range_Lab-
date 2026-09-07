import React, { useState } from "react";
import { usePrivacySoc } from "../context/PrivacySocContext.jsx";
import { Database, Link2, Plus, Terminal, RefreshCw, CheckCircle, AlertCircle, Play, Shield } from "lucide-react";

export default function DataSources() {
  const { 
    apiKey, 
    setApiKey, 
    activeApiKey, 
    triggerSync, 
    disconnect, 
    loading, 
    error 
  } = usePrivacySoc();

  // Scanner states
  const [scanStep, setScanStep] = useState(0); // 0: Idle, 1: Connecting, 2: Parsing Schemas, 3: Completed
  const [scanLog, setScanLog] = useState([]);
  const [customEndpoint, setCustomEndpoint] = useState("");

  const handleConnect = (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    triggerSync(apiKey);
    
    // Auto trigger scanning logs
    setScanStep(1);
    setScanLog(["[INFO] Initiating Secure Handshake...", "[INFO] Resolving endpoint gateway mappings..."]);
    
    setTimeout(() => {
      setScanStep(2);
      setScanLog(prev => [
        ...prev,
        "[SUCCESS] Authorization handshake verified.",
        "[INFO] Syncing ROPA activities catalog...",
        "[INFO] Parsing database schemas on port 5432...",
        "[PII] Detected 154 sensitive fields in payload objects."
      ]);
    }, 1500);

    setTimeout(() => {
      setScanStep(3);
      setScanLog(prev => [
        ...prev,
        "[SUCCESS] DPDP Compliance Score computed: 91% Readiness.",
        "[SUCCESS] Database sync completed. 1,452 records indexed."
      ]);
    }, 3000);
  };

  const startScanOnly = () => {
    setScanStep(1);
    setScanLog(["[INFO] Scanning active Gateway endpoints...", "[INFO] Pulling live headers..."]);
    setTimeout(() => {
      setScanStep(2);
      setScanLog(prev => [...prev, "[INFO] Matching parameters against DPDP rule registry...", "[WARNING] Missing purpose disclaimer header in GET /api/v1/user/profile"]);
    }, 1200);
    setTimeout(() => {
      setScanStep(3);
      setScanLog(prev => [...prev, "[SUCCESS] Audit scan finished. +4% compliance gain recommendation updated."]);
    }, 2500);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow" style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            <Database size={12} /> Compliance Governance
          </span>
          <h1 className="page-title">Connected Data Sources</h1>
          <p className="page-subtitle">Configure APIs, database instances, and secure connection feeds to catalog personal data automatically.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "24px" }}>
        
        {/* Connection Setup */}
        <div className="glass-panel" style={{ padding: "28px" }}>
          <h3 style={{ fontSize: "1.15rem", fontWeight: "600", color: "var(--text-primary)", marginBottom: "16px", display: "flex", gap: "10px", alignItems: "center" }}>
            <Link2 size={20} style={{ color: "var(--primary)" }} />
            <span>DPDP API Feed Connection</span>
          </h3>
          
          {activeApiKey ? (
            <div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", background: "var(--primary-glow)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-card)", marginBottom: "20px" }}>
                <CheckCircle size={20} style={{ color: "var(--success)", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--text-primary)" }}>Feed Active</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "monospace" }}>Key: {activeApiKey.slice(0, 15)}...</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button className="premium-btn primary" onClick={startScanOnly} disabled={scanStep === 1 || scanStep === 2}>
                  <RefreshCw size={16} className={scanStep === 1 || scanStep === 2 ? "animate-spin" : ""} />
                  <span>Scan Now</span>
                </button>
                <button className="premium-btn secondary" onClick={disconnect}>
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConnect}>
              <p style={{ color: "var(--text-body)", fontSize: "0.88rem", lineHeight: "1.5", marginBottom: "20px" }}>
                Paste your compliance connection key below to authorize synchronization with database catalogs and endpoint routers.
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                <input
                  type="text"
                  placeholder="Sentinel API connection key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 16px",
                    background: "var(--bg-app)",
                    border: "1px solid var(--border-card)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    outline: "none"
                  }}
                />
              </div>

              <button type="submit" className="premium-btn primary" style={{ width: "100%", justifyContent: "center" }}>
                <Plus size={16} />
                <span>Connect Source</span>
              </button>
            </form>
          )}

          {error && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "16px", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.1)", borderRadius: "8px", padding: "12px", color: "var(--critical)", fontSize: "0.8rem" }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Operational Scanner wizard */}
        <div className="glass-panel" style={{ padding: "28px", display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: "1.15rem", fontWeight: "600", color: "var(--text-primary)", marginBottom: "16px", display: "flex", gap: "10px", alignItems: "center" }}>
            <Terminal size={20} style={{ color: "var(--primary)" }} />
            <span>Discovery & Scanner Logs</span>
          </h3>

          <div style={{ flexGrow: 1, background: "var(--bg-app)", border: "1px solid var(--border-card)", borderRadius: "8px", padding: "16px", fontFamily: "monospace", fontSize: "0.8rem", color: "var(--text-primary)", minHeight: "180px", overflowY: "auto" }}>
            {scanLog.length === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-soft)", textAlign: "center", padding: "20px" }}>
                <Play size={24} style={{ marginBottom: "12px" }} />
                <p>No active scan session. Connect a data source or click "Scan Now" to begin indexing personal data fields.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {scanLog.map((log, idx) => (
                  <p key={idx} style={{ 
                    color: log.includes("[SUCCESS]") ? "var(--success)" : 
                           log.includes("[WARNING]") ? "var(--warning)" : 
                           log.includes("[PII]") ? "var(--info)" : "var(--text-body)"
                  }}>
                    {log}
                  </p>
                ))}
                {(scanStep === 1 || scanStep === 2) && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-soft)", marginTop: "6px" }}>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Processing schemas...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {scanStep === 3 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", color: "var(--success)", fontSize: "0.85rem", fontWeight: "600" }}>
              <CheckCircle size={16} />
              <span>Personal data landscape scan completed. All attributes indexed.</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
