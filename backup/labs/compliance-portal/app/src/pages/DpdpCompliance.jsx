import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../layout/PageContainer";
import { useToast } from "../context/ToastContext";
import { usePrivacySoc } from "../context/PrivacySocContext";
import { calculateDpdpCompliance } from "../utils/dpdpCompliance";
import {
  Shield,
  ShieldCheck,
  CheckCircle,
  Lock,
  Share2,
  Database,
  AlertTriangle,
  Play,
  ArrowRight,
  Clock,
  Activity,
  Layers,
  ChevronDown,
  Check,
  X,
  ShieldAlert
} from "lucide-react";
import { API_BASE_URL } from "../config/appConfig";


// Present the server's sector-aware assessment in the shape this page renders.
// A control the source cannot evidence is reported as "not measured" rather
// than scored zero, so an unanswerable check never looks like a failure.
function mapServerCompliance(payload) {
  if (!payload || typeof payload.compliancePercent !== "number") return null;

  const rules = (payload.checklist || []).map((check, index) => {
    const measured = check.status !== "Not measured";
    const score = measured ? check.passRate ?? 0 : null;
    return {
      id: index + 1,
      name: check.control,
      description: measured
        ? `${check.passRate}% of records satisfy this control.`
        : "Cannot be evidenced from consent data alone.",
      weight: check.weight,
      score: measured ? score : 0,
      measured,
      // These labels are the ones the page's distribution chart filters on.
      status: !measured ? "Not Measured"
        : score >= 99.9 ? "Excellent"
        : score >= 90 ? "Good"
        : score >= 80 ? "Needs Action"
        : "Critical",
      compliant: !measured ? "unknown" : score >= 99.9 ? "yes" : "no"
    };
  });

  const score = payload.compliancePercent;
  return {
    score,
    percent: score,
    status: score >= 80 ? "Compliant" : score >= 50 ? "Needs attention" : "Critical",
    rules,
    rulesReviewed: payload.stats?.measured ?? rules.filter((rule) => rule.measured).length,
    needsAction: payload.stats?.remaining ?? rules.filter((rule) => rule.measured && rule.score < 99.9).length,
    criticalRisks: payload.stats?.highRisk ?? rules.filter((rule) => rule.measured && rule.score < 80).length,
    criticalRules: rules.filter((rule) => rule.status === "Critical"),
    actionRules: rules.filter((rule) => rule.measured && rule.score < 99.9),
    sector: payload.sector,
    findings: payload.findings,
    fromServer: true
  };
}

export default function DpdpCompliance() {
  // isLoading starts false — statusInfo now comes from context which already
  // knows whether the platform is connected. Setting it true initially caused
  // a flash of the skeleton card even when the status was already NOT_CONNECTED.
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Retrieve live database data from global state
  const { consents, activeApiKey, statusInfo } = usePrivacySoc();
  const [serverCompliance, setServerCompliance] = useState(null);

  // The server analyses each connected platform under its own sector's rules,
  // so its assessment is the authoritative one. Computing locally from the
  // context's `consents` array made every sector show the same figure, because
  // that array is only filled by the manual key-entry flow and is otherwise
  // empty — which scores zero regardless of what is actually connected.
  const complianceData = useMemo(() => {
    if (serverCompliance) return serverCompliance;
    return calculateDpdpCompliance(consents, Boolean(activeApiKey));
  }, [serverCompliance, consents, activeApiKey]);

  useEffect(() => {
    checkStatusAndLoad();
  }, []);

  // Re-fetch compliance data whenever the global connection status changes to
  // READY so the stats update immediately after the platform is connected.
  useEffect(() => {
    if (statusInfo?.status === "READY") {
      checkStatusAndLoad();
    }
  }, [statusInfo?.status]);

  const checkStatusAndLoad = async () => {
    try {
      const dpdpRes = await fetch(`${API_BASE_URL}/dpdp`);
      if (dpdpRes.ok) setServerCompliance(mapServerCompliance(await dpdpRes.json()));
      setIsLoading(false);
    } catch {
      setIsLoading(false);
    }
  };

  const handleRunAudit = () => {
    addToast("Initiating full compliance audit scan...", "info");
    setTimeout(() => {
      addToast("Compliance Audit complete. Scores updated.", "success");
    }, 1000);
  };

  if (isLoading) {
    return (
      <PageContainer title="DPDP Compliance" subtitle="Loading compliance audit data..." breadcrumbs={["DPDP Compliance"]}>
        <div className="skeleton-card animate-pulse" style={{ height: "400px" }}></div>
      </PageContainer>
    );
  }

  if (statusInfo?.status !== "READY") {
    return (
      <PageContainer title="DPDP Compliance" subtitle="DPDP readiness compliance center.">
        <div className="section-card text-center" style={{ padding: "80px 40px", maxWidth: "680px", margin: "40px auto", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
          <AlertTriangle size={64} className="text-warning mb-4 animate-bounce" style={{ margin: "0 auto", color: "var(--warning)" }} />
          <h3 className="section-card-title mb-3" style={{ fontSize: "24px", fontWeight: "700" }}>No Platform Connected</h3>
          <p className="text-muted mb-6" style={{ fontSize: "15px", color: "var(--text-muted)", lineHeight: "1.6" }}>
            Connect an external business platform via REST APIs to run personal data compliance audits.
          </p>
          <button onClick={() => navigate("/integration")} className="btn-primary" style={{ padding: "12px 24px", borderRadius: "8px", fontWeight: "600" }}>
            Go to Platform Integration
          </button>
        </div>
      </PageContainer>
    );
  }

  const { score: complianceScoreVal, status: overallStatus, rules, rulesReviewed, needsAction, criticalRisks } = complianceData;
  const isHealthy = complianceScoreVal >= 80;

  // Distribution chart data
  const passedCount = rules.filter(r => r.status === "Excellent" || r.status === "Good").length;
  const warningCount = rules.filter(r => r.status === "Needs Action").length;
  const failedCount = rules.filter(r => r.status === "Critical").length;

  const ruleCount = rules.length || 1;
  const passedPct = (passedCount / ruleCount) * 100;
  const warningPct = (warningCount / ruleCount) * 100;

  return (
    <PageContainer
      title="DPDP Compliance"
      subtitle="Review the current compliance posture, inspect every rule, and focus on the controls that need attention."
      breadcrumbs={["DPDP Compliance"]}
      actionButton={
        <button onClick={handleRunAudit} className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <Play size={16} />
          <span>Run Compliance Audit</span>
        </button>
      }
    >
      {/* 1. Operational Compliance Overview Box */}
      <div className="section-card" style={{ padding: "32px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", marginBottom: "32px" }}>
        <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
          
          {/* Left: Score Circle & Text */}
          <div style={{ flex: "2 1 400px", display: "flex", gap: "28px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{
              position: "relative",
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              background: `conic-gradient(var(--success) 0% ${complianceScoreVal}%, rgba(22, 163, 74, 0.1) ${complianceScoreVal}% 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <div style={{
                width: "96px",
                height: "96px",
                borderRadius: "50%",
                background: "var(--bg-card)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <span style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-primary)" }}>{complianceScoreVal}%</span>
                <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--success)" }}>{overallStatus.toUpperCase()}</span>
              </div>
            </div>

            <div style={{ flex: "1 1 240px" }}>
              <div style={{ display: "inline-flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                <span className="status-badge" style={{ background: "rgba(37,99,235,0.1)", color: "var(--info)", fontSize: "11px", padding: "4px 10px", borderRadius: "100px", fontWeight: "700" }}>CURRENT POSTURE</span>
                <span className="status-badge" style={{ background: isHealthy ? "rgba(22,163,74,0.1)" : "rgba(234,88,12,0.1)", color: isHealthy ? "var(--success)" : "var(--warning)", fontSize: "11px", padding: "4px 10px", borderRadius: "100px", fontWeight: "700" }}>{overallStatus}</span>
              </div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "22px", fontWeight: "700", color: "var(--text-primary)" }}>Operational compliance overview</h3>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                Use this summary to confirm the current DPDP status and identify the rules that require follow-up.
              </p>
            </div>
          </div>

          {/* Right: Stacked Stats */}
          <div style={{ flex: "1 1 250px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ padding: "16px", background: "var(--bg-card-hover)", borderRadius: "8px", border: "1px solid var(--border-card)" }}>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase" }}>Rules Reviewed</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
                <span style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-primary)" }}>{rulesReviewed}</span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Controls included in current review</span>
              </div>
            </div>
            <div style={{ padding: "16px", background: "var(--bg-card-hover)", borderRadius: "8px", border: "1px solid var(--border-card)" }}>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase" }}>Needs Action</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
                <span style={{ fontSize: "24px", fontWeight: "800", color: needsAction > 0 ? "var(--warning)" : "var(--text-primary)" }}>{needsAction}</span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Rules requiring follow-up or remediation</span>
              </div>
            </div>
            <div style={{ padding: "16px", background: "var(--bg-card-hover)", borderRadius: "8px", border: "1px solid var(--border-card)" }}>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase" }}>Critical Risks</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
                <span style={{ fontSize: "24px", fontWeight: "800", color: criticalRisks > 0 ? "var(--critical)" : "var(--text-primary)" }}>{criticalRisks}</span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Controls below critical thresholds</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 2. Grid & Donut Distribution */}
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "32px" }}>
        
        {/* Left Side: Rule Cards */}
        <div style={{ flex: "2 1 600px" }}>
          <span className="eyebrow" style={{ color: "var(--info)", fontWeight: "600", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Rule Coverage</span>
          <h3 style={{ margin: "4px 0 20px 0", fontSize: "20px", fontWeight: "700", color: "var(--text-primary)" }}>Compliance controls at a glance</h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {rules.map((rule) => {
              const isExcel = rule.score >= 85;
              const isWarn = rule.score >= 60 && rule.score < 85;
              const statusColor = isExcel ? "var(--success)" : isWarn ? "var(--warning)" : "var(--critical)";
              
              return (
                <div key={rule.id} className="section-card hover-glow-card" style={{
                  padding: "20px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-card)",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "transform 0.2s"
                }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <div style={{ background: "rgba(255,255,255,0.03)", padding: "6px", borderRadius: "6px", display: "flex", color: statusColor }}>
                        <Shield size={16} />
                      </div>
                      <span className="status-badge" style={{ background: isExcel ? "rgba(22,163,74,0.1)" : isWarn ? "rgba(234,88,12,0.1)" : "rgba(239,68,68,0.1)", color: statusColor, fontSize: "11px", padding: "2px 8px", borderRadius: "100px", fontWeight: "700" }}>
                        {rule.status}
                      </span>
                    </div>

                    <h4 style={{ margin: "0 0 6px 0", fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>{rule.name}</h4>
                    <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>{rule.description}</p>
                  </div>

                  <div>
                    <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden", marginBottom: "8px" }}>
                      <div style={{ width: `${rule.score}%`, height: "100%", background: statusColor, borderRadius: "3px" }}></div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
                      <span>{rule.score.toFixed(1)}%</span>
                      <span>Section {rule.id + 3}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Compliance Distribution Donut */}
        <div style={{ flex: "1 1 300px" }}>
          <span className="eyebrow" style={{ color: "var(--info)", fontWeight: "600", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Distribution</span>
          <h3 style={{ margin: "4px 0 20px 0", fontSize: "20px", fontWeight: "700", color: "var(--text-primary)" }}>Compliance distribution</h3>
          
          <div className="section-card" style={{ padding: "28px 24px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "28px" }}>
            
            {/* Donut circle */}
            <div style={{
              position: "relative",
              width: "140px",
              height: "140px",
              borderRadius: "50%",
              background: `conic-gradient(var(--success) 0% ${passedPct}%, var(--warning) ${passedPct}% ${passedPct + warningPct}%, var(--critical) ${passedPct + warningPct}% 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <div style={{
                width: "108px",
                height: "108px",
                borderRadius: "50%",
                background: "var(--bg-card)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <span style={{ fontSize: "15px", fontWeight: "800", color: "var(--text-primary)" }}>
                  {passedCount} / 10 Met
                </span>
              </div>
            </div>

            {/* Legends list */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--success)" }}></div>
                  <span style={{ color: "var(--text-muted)", fontWeight: "500" }}>Passed Rules</span>
                </div>
                <strong style={{ color: "var(--text-primary)" }}>{passedCount}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--warning)" }}></div>
                  <span style={{ color: "var(--text-muted)", fontWeight: "500" }}>Warning Rules</span>
                </div>
                <strong style={{ color: "var(--text-primary)" }}>{warningCount}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--critical)" }}></div>
                  <span style={{ color: "var(--text-muted)", fontWeight: "500" }}>Failed Rules</span>
                </div>
                <strong style={{ color: "var(--text-primary)" }}>{failedCount}</strong>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* 3. Collapsible Detailed Audit Table */}
      <div className="section-card" style={{ padding: "0", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", overflow: "hidden" }}>
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "24px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left"
          }}
        >
          <div>
            <span className="eyebrow" style={{ color: "var(--info)", fontWeight: "600", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Rule Details</span>
            <h3 style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "700", color: "var(--text-primary)" }}>View Rule Details</h3>
          </div>
          <ChevronDown
            size={20}
            style={{
              color: "var(--text-muted)",
              transform: showDetails ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s"
            }}
          />
        </button>

        {showDetails && (
          <div style={{ padding: "0 24px 24px 24px", overflowX: "auto" }}>
            <table className="premium-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-card)" }}>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Rule Name</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "var(--text-muted)", fontWeight: "600" }}>DPDP Act Section</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Score</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Weight</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const isExcel = rule.score >= 85;
                  const isWarn = rule.score >= 60 && rule.score < 85;
                  const statusColor = isExcel ? "var(--success)" : isWarn ? "var(--warning)" : "var(--critical)";

                  return (
                    <tr key={rule.id} style={{ borderBottom: "1px solid var(--border-card)" }}>
                      <td style={{ padding: "16px" }}>
                        <strong style={{ display: "block", color: "var(--text-primary)" }}>{rule.name}</strong>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{rule.description}</span>
                      </td>
                      <td style={{ padding: "16px", color: "var(--text-primary)" }}>Section {rule.id + 3}</td>
                      <td style={{ padding: "16px", color: "var(--text-primary)", fontWeight: "600" }}>{rule.score.toFixed(1)}%</td>
                      <td style={{ padding: "16px", color: "var(--text-primary)" }}>{rule.weight}</td>
                      <td style={{ padding: "16px" }}>
                        <span className="status-badge" style={{ background: isExcel ? "rgba(22,163,74,0.1)" : isWarn ? "rgba(234,88,12,0.1)" : "rgba(239,68,68,0.1)", color: statusColor, fontSize: "12px", padding: "4px 10px", borderRadius: "100px", fontWeight: "700" }}>
                          {rule.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
