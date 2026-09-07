import React, { useState, useEffect } from "react";
import { usePrivacySoc } from "../context/PrivacySocContext.jsx";
import { useNavigate } from "react-router-dom";
import { 
  Scan, 
  Database, 
  Terminal, 
  Cpu, 
  Github, 
  Cloud, 
  FileCode, 
  Layers, 
  CheckCircle, 
  Play, 
  RefreshCw, 
  AlertTriangle 
} from "lucide-react";

export default function ApiScanner() {
  const { addNotification } = usePrivacySoc();
  const [step, setStep] = useState(1); // 1 = Select Source, 2 = Scanning, 3 = Completed
  const [selectedSource, setSelectedSource] = useState(null);
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [progressVal, setProgressVal] = useState(0);
  const navigate = useNavigate();

  const scanSteps = [
    "Connecting API feed...",
    "Reading JSON-LD endpoints...",
    "Mapping payload variables...",
    "Evaluating PII schema logs...",
    "Running DPDP rules parser...",
    "Synthesizing recommendations report...",
    "Completed successfully!"
  ];

  const sources = [
    { id: "rest", name: "REST API", icon: Database },
    { id: "swagger", name: "Swagger Schema", icon: FileCode },
    { id: "openapi", name: "OpenAPI Specs", icon: Layers },
    { id: "postman", name: "Postman Suite", icon: Terminal },
    { id: "aws", name: "AWS Cloud Catalog", icon: Cloud },
    { id: "azure", name: "Azure Services", icon: Cloud },
    { id: "gcp", name: "GCP Catalogs", icon: Cloud },
    { id: "github", name: "GitHub Repos", icon: Github }
  ];

  useEffect(() => {
    let timer;
    if (step === 2) {
      if (scanStepIndex < scanSteps.length - 1) {
        timer = setTimeout(() => {
          setScanStepIndex(prev => prev + 1);
          setProgressVal(prev => Math.min(100, prev + Math.floor(100 / (scanSteps.length - 1))));
        }, 1200);
      } else {
        // Complete Scan
        timer = setTimeout(() => {
          setStep(3);
          addNotification("Global API Scan completed. 214 endpoints mapped, 8 active threats detected.", "success");
        }, 1000);
      }
    }
    return () => clearTimeout(timer);
  }, [step, scanStepIndex]);

  const startScan = () => {
    if (!selectedSource) return;
    setStep(2);
    setScanStepIndex(0);
    setProgressVal(0);
  };

  const resetScan = () => {
    setStep(1);
    setSelectedSource(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow" style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            <Scan size={12} /> DPDP Sec. 8 Operations
          </span>
          <h1 className="page-title">Active API Scanner</h1>
          <p className="page-subtitle">Inventory active gateways and run automatic privacy leak assessments.</p>
        </div>
      </div>

      {step === 1 && (
        /* ================= STEP 1: SELECT SOURCE ================= */
        <div className="glass-panel" style={{ padding: "32px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "var(--text-primary)", marginBottom: "8px" }}>
            Step 1: Choose Integration Source
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: "24px" }}>
            Select an endpoint catalog source to automatically scrape schema payloads and index PII data.
          </p>

          <div className="scan-source-grid">
            {sources.map(src => {
              const IconComp = src.icon;
              return (
                <div 
                  key={src.id}
                  className={`scan-source-card ${selectedSource === src.id ? "selected" : ""}`}
                  onClick={() => setSelectedSource(src.id)}
                >
                  <div style={{ color: selectedSource === src.id ? "var(--primary)" : "var(--text-soft)" }}>
                    <IconComp size={32} />
                  </div>
                  <span className="scan-source-name">{src.name}</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "32px", borderTop: "1px solid var(--border-card)", paddingTop: "20px" }}>
            <button 
              className="premium-btn primary"
              disabled={!selectedSource}
              onClick={startScan}
              style={{ display: "flex", gap: "8px", alignItems: "center" }}
            >
              <Play size={16} />
              <span>Launch Scan</span>
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        /* ================= STEP 2: SCANNING ANIMATION ================= */
        <div className="glass-panel" style={{ padding: "40px", textAlign: "center" }}>
          <div style={{ position: "relative", width: "80px", height: "80px", margin: "0 auto 24px" }}>
            <RefreshCw className="animate-spin" size={60} style={{ color: "var(--primary)", margin: "10px" }} />
          </div>
          
          <h3 style={{ fontSize: "1.3rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
            Privacy Scan in Progress
          </h3>
          <p style={{ color: "var(--text-soft)", fontSize: "0.9rem", marginBottom: "24px" }}>
            Parsing: <strong style={{ color: "var(--primary)" }}>{scanSteps[scanStepIndex]}</strong>
          </p>

          {/* Progress Bar */}
          <div style={{ width: "100%", maxWidth: "500px", height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", margin: "0 auto 30px", overflow: "hidden" }}>
            <div 
              style={{ 
                height: "100%", 
                width: `${progressVal}%`, 
                background: "var(--primary)", 
                borderRadius: "3px",
                transition: "width 0.4s ease"
              }} 
            />
          </div>

          {/* Simulated scan logs console */}
          <div 
            style={{ 
              maxWidth: "600px", 
              margin: "0 auto", 
              background: "#09090b", 
              border: "1px solid var(--border-card)", 
              borderRadius: "8px", 
              padding: "16px",
              textAlign: "left",
              fontFamily: "monospace",
              fontSize: "0.78rem",
              color: "#a5b4fc"
            }}
          >
            <p style={{ color: "var(--text-soft)" }}>[SYSTEM CONSOLE INITIALIZED]</p>
            {scanSteps.slice(0, scanStepIndex + 1).map((log, idx) => (
              <p key={idx} style={{ marginTop: "4px" }}>
                &gt; {log}
              </p>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        /* ================= STEP 3: COMPLETED ================= */
        <div className="glass-panel" style={{ padding: "40px", textAlign: "center" }}>
          <CheckCircle size={56} style={{ color: "var(--success)", marginBottom: "20px", filter: "drop-shadow(0 0 8px rgba(16,185,129,0.3))" }} />
          <h2 style={{ fontSize: "1.6rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
            Scan Complete
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginBottom: "32px", maxWidth: "600px", margin: "0 auto 30px" }}>
            Successfully mapped gateway catalog endpoints. AI analyzed data fields and verified statutory compliance readiness.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", maxWidth: "600px", margin: "0 auto 30px" }}>
            <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-card)", borderRadius: "8px", padding: "16px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>Endpoints Analyzed</span>
              <p style={{ fontSize: "1.6rem", fontWeight: "700", color: "var(--text-primary)", marginTop: "4px" }}>214</p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-card)", borderRadius: "8px", padding: "16px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>PII Gaps Flagged</span>
              <p style={{ fontSize: "1.6rem", fontWeight: "700", color: "var(--critical)", marginTop: "4px" }}>8</p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-card)", borderRadius: "8px", padding: "16px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>Compliance Gain</span>
              <p style={{ fontSize: "1.6rem", fontWeight: "700", color: "var(--success)", marginTop: "4px" }}>+3%</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button className="premium-btn secondary" onClick={resetScan}>
              Run Another Scan
            </button>
            <button className="premium-btn primary" onClick={() => navigate("/risks")}>
              Inspect 8 Gaps
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
