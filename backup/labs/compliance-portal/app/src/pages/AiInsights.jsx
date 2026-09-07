import React, { useState, useEffect } from "react";
import { Sparkles, Brain, Cpu, Send, ShieldAlert, ArrowRight, ShieldCheck, RefreshCw } from "lucide-react";
import { usePrivacySoc } from "../context/PrivacySocContext.jsx";

export default function AiInsights() {
  const { readinessScores } = usePrivacySoc();
  
  // Streaming insights state
  const [insightText, setInsightText] = useState("");
  const [loading, setLoading] = useState(false);

  const fullInsightText = `Today's automated scan identified 12 new personal data fields.

Most newly discovered sensitive parameters originate from the /api/v1/checkout schema within the Customer API catalog.

Overall DPDP compliance score has improved by 4% since the last audit.

Actionable Advice: Applying column-level encryption to all Aadhaar and PAN fields would immediately increase DPDP compliance rating to 96% and reduce business liability.`;

  useEffect(() => {
    let index = 0;
    setLoading(true);
    const interval = setInterval(() => {
      setInsightText(fullInsightText.slice(0, index));
      index++;
      if (index > fullInsightText.length) {
        clearInterval(interval);
        setLoading(false);
      }
    }, 15);

    return () => clearInterval(interval);
  }, []);

  const triggerReanalyze = () => {
    setInsightText("");
    setLoading(true);
    let index = 0;
    const interval = setInterval(() => {
      setInsightText(fullInsightText.slice(0, index));
      index++;
      if (index > fullInsightText.length) {
        clearInterval(interval);
        setLoading(false);
      }
    }, 15);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow" style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            <Sparkles size={12} /> Cognitive Analysis
          </span>
          <h1 className="page-title">AI Compliance Insights</h1>
          <p className="page-subtitle">Understand your organization's personal data landscape through automated LLM audits and code remediation logs.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", marginTop: "24px" }}>
        
        {/* Streaming AI Summary card */}
        <div className="glass-panel" style={{ padding: "28px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--primary-glow)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Brain size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "var(--text-primary)" }}>Active Scan Summary</h3>
                <span style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>Audited via Llama-3-Privacy model</span>
              </div>
            </div>

            <button className="premium-btn secondary" onClick={triggerReanalyze} disabled={loading} style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              <span>Re-analyze</span>
            </button>
          </div>

          <div style={{
            flexGrow: 1,
            background: "var(--bg-app)",
            border: "1px solid var(--border-card)",
            borderRadius: "8px",
            padding: "24px",
            fontSize: "0.95rem",
            lineHeight: "1.7",
            color: "var(--text-body)",
            whiteSpace: "pre-wrap",
            minHeight: "260px"
          }}>
            {insightText}
            {loading && <span style={{ width: "8px", height: "15px", display: "inline-block", background: "var(--primary)", marginLeft: "4px", verticalAlign: "middle" }} className="animate-pulse" />}
          </div>
        </div>

        {/* Dynamic score summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <div className="glass-panel" style={{ padding: "24px" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", color: "var(--text-soft)" }}>Governance Stats</span>
            <h4 style={{ fontSize: "1rem", fontWeight: "600", color: "var(--text-primary)", marginTop: "12px", marginBottom: "16px" }}>PII Coverage Metrics</h4>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "4px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Protected Records Ratio</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: "600" }}>72%</span>
                </div>
                <div style={{ height: "4px", width: "100%", background: "var(--border-card)", borderRadius: "2px" }}>
                  <div style={{ height: "100%", width: "72%", background: "var(--primary)", borderRadius: "2px" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "4px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Notice Disclosure Coverage</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: "600" }}>64%</span>
                </div>
                <div style={{ height: "4px", width: "100%", background: "var(--border-card)", borderRadius: "2px" }}>
                  <div style={{ height: "100%", width: "64%", background: "var(--warning)", borderRadius: "2px" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "4px" }}>
                  <span style={{ color: "var(--text-muted)" }}>DPIA Rule Coverage</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: "600" }}>91%</span>
                </div>
                <div style={{ height: "4px", width: "100%", background: "var(--border-card)", borderRadius: "2px" }}>
                  <div style={{ height: "100%", width: "91%", background: "var(--success)", borderRadius: "2px" }} />
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "24px" }}>
            <h4 style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--text-primary)", marginBottom: "8px" }}>Improvement Projection</h4>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: "1.4" }}>
              Resolving database encryption gaps will boost your overall DPDP readiness score by **+4.8%**, pushing the platform to **95.8% (Highly Compliant)** status.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
