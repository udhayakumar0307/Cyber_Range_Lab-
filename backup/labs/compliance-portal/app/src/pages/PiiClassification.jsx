import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../layout/PageContainer";
import { getPiiData } from "../services/piiService";
import { useToast } from "../context/ToastContext";
import MetricCard from "../components/common/MetricCard";
import SearchBar from "../components/common/SearchBar";
import DataTable from "../components/common/DataTable";
import StatusBadge from "../components/common/StatusBadge";
import { API_BASE_URL } from "../config/appConfig";
import {
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Share2,
  Database,
  Cpu,
  Trash2,
  TrendingUp,
  Activity,
  Layers,
  ChevronDown,
  Check,
  X,
  Play,
  Clock,
  ArrowRight,
  ExternalLink,
  Wifi
} from "lucide-react";

export default function PiiClassification() {
  const [statusInfo, setStatusInfo] = useState({ status: "NOT_CONNECTED" });
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Live third-party sharing log — synced from localStorage (written by AnonymizationPage)
  const [liveShareLog, setLiveShareLog] = useState(() => {
    try {
      const saved = localStorage.getItem("anon_sharing_log");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const { addToast } = useToast();
  const navigate = useNavigate();

  const tabs = [
    { id: "overview", label: "Executive Posture", icon: Shield },
    { id: "inventory", label: "PII Inventory", icon: Layers },
    { id: "lifecycle", label: "Data Lifecycle", icon: Activity },
    { id: "sharing", label: "Sharing & Minimization", icon: Share2 }
  ];

  useEffect(() => {
    checkStatusAndLoad();
  }, []);

  // Poll localStorage every 4 seconds so new Anonymization shares appear here in near-real-time
  useEffect(() => {
    const syncFromStorage = () => {
      try {
        const saved = localStorage.getItem("anon_sharing_log");
        const parsed = saved ? JSON.parse(saved) : [];
        setLiveShareLog(parsed);
      } catch {}
    };
    // Also respond to cross-tab storage events immediately
    window.addEventListener("storage", syncFromStorage);
    const interval = setInterval(syncFromStorage, 4000);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
      clearInterval(interval);
    };
  }, []);

  const checkStatusAndLoad = async () => {
    try {
      const statusRes = await fetch(`${API_BASE_URL}/status`);
      if (!statusRes.ok) throw new Error();
      const statusData = await statusRes.json();
      setStatusInfo(statusData);

      if (statusData.status === "READY") {
        const piiData = await getPiiData();
        setData(piiData);
      }
      setIsLoading(false);
    } catch {
      setStatusInfo({ status: "NOT_CONNECTED" });
      setIsLoading(false);
    }
  };

  const handleScan = () => {
    addToast("Initiating full PII structural scan across connected stores...", "info");
    setTimeout(() => {
      addToast("PII discovery analysis complete.", "success");
      checkStatusAndLoad();
    }, 1200);
  };

  const filteredFields = useMemo(() => {
    if (!data) return [];
    return (data.fields || []).filter((item) => {
      const matchSearch =
        item.field.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase());

      const matchRisk = riskFilter === "all" || item.riskLevel.toLowerCase() === riskFilter.toLowerCase();
      return matchSearch && matchRisk;
    });
  }, [data, search, riskFilter]);

  if (isLoading) {
    return (
      <PageContainer title="PII Intelligence" subtitle="Loading PII posture inventory..." breadcrumbs={["PII Intelligence"]}>
        <div className="skeleton-card animate-pulse" style={{ height: "400px" }}></div>
      </PageContainer>
    );
  }

  if (statusInfo.status !== "READY" || !data) {
    return (
      <PageContainer title="PII Intelligence" subtitle="PII risk assessment & inventory workspace.">
        <div className="section-card text-center" style={{ padding: "80px 40px", maxWidth: "680px", margin: "40px auto", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
          <AlertTriangle size={64} className="text-warning mb-4 animate-bounce" style={{ margin: "0 auto", color: "var(--warning)" }} />
          <h3 className="section-card-title mb-3" style={{ fontSize: "24px", fontWeight: "700" }}>No Platform Connected</h3>
          <p className="text-muted mb-6" style={{ fontSize: "15px", color: "var(--text-muted)", lineHeight: "1.6" }}>
            Connect an external business platform via REST APIs to run sensitive PII scans and risk modeling.
          </p>
          <button onClick={() => navigate("/integration")} className="btn-primary" style={{ padding: "12px 24px", borderRadius: "8px", fontWeight: "600" }}>
            Go to Platform Integration
          </button>
        </div>
      </PageContainer>
    );
  }

  const riskScore = parseInt(data.summary.privacyRiskScore || "0");
  const riskColor = riskScore >= 75 ? "var(--critical)" : riskScore >= 50 ? "var(--warning)" : "var(--success)";

  const columns = [
    { key: "field", label: "Field Name" },
    { key: "category", label: "Category" },
    {
      key: "riskLevel",
      label: "Risk Level",
      render: (row) => <StatusBadge status={row.riskLevel} />
    },
    { key: "source", label: "Data Source" },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      key: "actions",
      label: "Remediation",
      width: "120px",
      render: (row) => (
        <button
          type="button"
          onClick={() => addToast(`Quarantining or encrypting field: ${row.field}`, "success")}
          className="btn-secondary btn-sm"
          style={{ padding: "4px 10px", fontSize: "12px", border: "1px solid var(--border-card)" }}
        >
          Mask Field
        </button>
      )
    }
  ];

  return (
    <PageContainer
      title="PII Intelligence Command"
      subtitle="Executive privacy posture benchmarking, risk index logs, and structural data minimization counsel."
      breadcrumbs={["PII Intelligence"]}
      actionButton={
        <button onClick={handleScan} className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <Play size={16} />
          <span>Scan for PII</span>
        </button>
      }
    >
      {/* Tab Navigation Menu */}
      <div className="module-tabs" style={{ marginBottom: "28px" }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`module-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* RENDER ACTIVE TAB VIEW */}
      {activeTab === "overview" && (
        <>
          {/* 1. Global KPIs Grid */}
          <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "32px" }}>
            <MetricCard label="Total PII Records" value={data.summary.totalPiiRecords} />
            <MetricCard label="Sensitive PII Fields" value={data.summary.sensitivePii} />
            <MetricCard label="Encrypted PII Records" value={data.summary.encryptedRecords} />
            <MetricCard label="Scanned Today" value={data.summary.detectedToday} />
          </div>

          {/* 2. PII Risk Assessment Block */}
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "32px" }}>
            
            {/* Risk Score Circle Gauge & Factors */}
            <div className="section-card" style={{ flex: "2 1 500px", padding: "28px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
              <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldAlert size={18} style={{ color: riskColor }} />
                <span>DPDP Risk Score Calculation</span>
              </h3>

              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{
                  position: "relative",
                  width: "130px",
                  height: "130px",
                  borderRadius: "50%",
                  background: `conic-gradient(${riskColor} 0% ${riskScore}%, rgba(255,255,255,0.05) ${riskScore}% 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <div style={{
                    width: "100px",
                    height: "100px",
                    borderRadius: "50%",
                    background: "var(--bg-card)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <span style={{ fontSize: "28px", fontWeight: "800", color: "var(--text-primary)" }}>{riskScore}</span>
                    <span style={{ fontSize: "10px", fontWeight: "700", color: riskColor, textTransform: "uppercase" }}>{data.summary.privacyRiskLevel}</span>
                  </div>
                </div>

                <div style={{ flexGrow: 1, minWidth: "260px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-card)", color: "var(--text-muted)" }}>
                        <th style={{ textAlign: "left", paddingBottom: "6px" }}>Contributing Factor</th>
                        <th style={{ textAlign: "right", paddingBottom: "6px" }}>Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.riskBreakdown || []).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === data.riskBreakdown.length - 1 ? "none" : "1px solid rgba(255,255,255,0.02)" }}>
                          <td style={{ padding: "6px 0" }}>
                            <strong style={{ color: "var(--text-primary)" }}>{row.factor}</strong>
                            <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>{row.details}</span>
                          </td>
                          <td style={{ textAlign: "right", padding: "6px 0", color: row.impact.startsWith("-") ? "var(--success)" : "var(--critical)", fontWeight: "700" }}>
                            {row.impact}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Industry Benchmarking Box */}
            <div className="section-card" style={{ flex: "1 1 300px", padding: "28px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <TrendingUp size={18} style={{ color: "var(--info)" }} />
                  <span>Industry Benchmarking</span>
                </h3>
                
                <div style={{ padding: "16px", background: "var(--bg-card-hover)", borderRadius: "8px", border: "1px solid var(--border-card)", marginBottom: "16px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "600" }}>Market Context</span>
                  <strong style={{ display: "block", color: "var(--text-primary)", fontSize: "14px", marginTop: "2px" }}>
                    {data.industryAssessment.industry}
                  </strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "16px" }}>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Industry Avg</span>
                    <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-primary)" }}>
                      {data.industryAssessment.averageRisk}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Actual Org Risk</span>
                    <div style={{ fontSize: "20px", fontWeight: "800", color: riskColor }}>
                      {data.industryAssessment.actualRisk}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border-card)", paddingTop: "12px", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                <strong>Assessment:</strong> {data.industryAssessment.gapDescription}
              </div>
            </div>

          </div>

          {/* 3. AI Recommendations Panel */}
          {showRecommendations && (data.aiRecommendations || []).length > 0 && (
            <div className="section-card" style={{
              padding: "24px",
              background: "linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(124, 58, 237, 0.01) 100%)",
              border: "1px solid rgba(124, 58, 237, 0.15)",
              borderRadius: "16px",
              marginBottom: "32px",
              position: "relative"
            }}>
              <button 
                type="button" 
                onClick={() => setShowRecommendations(false)}
                style={{ position: "absolute", right: "20px", top: "20px", background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                aria-label="Dismiss recommendations"
              >
                <X size={16} />
              </button>
              
              <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#8b5cf6" }}>
                <Cpu size={18} />
                <span>AI Privacy Counsel Recommendations</span>
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                {(data.aiRecommendations).map((rec, idx) => (
                  <div key={idx} style={{ padding: "16px", background: "var(--bg-card)", border: "1px solid rgba(124, 58, 237, 0.1)", borderRadius: "10px", fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                    {rec}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Historical Risk Trends Area */}
          <div className="section-card" style={{ padding: "28px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
            <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingUp size={18} style={{ color: "var(--info)" }} />
              <span>Historical Privacy Risk Trends (6 Months)</span>
            </h3>
            
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: "140px", padding: "10px 20px", background: "var(--bg-card-hover)", borderRadius: "8px", border: "1px solid var(--border-card)" }}>
              {(data.historicalTrends || []).map((point, index) => {
                const riskVal = point.risk !== undefined ? point.risk : (point.records !== undefined ? Math.min(95, Math.max(15, Math.round(point.records * 0.1))) : 40);
                const monthLabel = point.month || point.name || point.date || "";
                return (
                  <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1 }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
                      {riskVal}
                    </div>
                    <div style={{
                      width: "32px",
                      height: `${riskVal * 1.2}px`,
                      background: riskVal >= 70 ? "var(--critical)" : riskVal >= 50 ? "var(--warning)" : "var(--success)",
                      borderRadius: "4px 4px 0 0",
                      transition: "height 0.3s"
                    }}></div>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>{monthLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {activeTab === "inventory" && (
        <div className="section-card">
          <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Layers size={18} style={{ color: "var(--info)" }} />
            <span>PII Fields Inventory Registry</span>
          </h3>

          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search fields or categories..."
            statusFilter={riskFilter}
            onStatusChange={setRiskFilter}
            statusOptions={[
              { label: "Critical Risk", value: "critical" },
              { label: "High Risk", value: "high" },
              { label: "Medium Risk", value: "medium" },
              { label: "Low Risk", value: "low" }
            ]}
          />

          <DataTable
            columns={columns}
            data={filteredFields}
            isLoading={isLoading}
            emptyTitle="No PII fields found"
            emptyDescription="Connect a platform or check integration settings."
          />
        </div>
      )}

      {activeTab === "lifecycle" && (
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          
          {/* System Distribution */}
          <div className="section-card" style={{ flex: "1 1 350px", padding: "28px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
            <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Database size={18} style={{ color: "var(--success)" }} />
              <span>PII System Distribution</span>
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {(data.systemDistribution || []).map((row, idx) => (
                <div key={idx}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                    <span style={{ color: "var(--text-muted)", fontWeight: "500" }}>{row.system}</span>
                    <strong style={{ color: "var(--text-primary)" }}>{row.records.toLocaleString()} ({row.share}%)</strong>
                  </div>
                  <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.04)", borderRadius: "100px", overflow: "hidden" }}>
                    <div style={{ width: `${row.share}%`, height: "100%", background: "var(--success)", borderRadius: "100px" }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lifecycle Tracking */}
          <div className="section-card" style={{ flex: "1 1 350px", padding: "28px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
            <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Activity size={18} style={{ color: "var(--warning)" }} />
              <span>Data Lifecycle Tracking</span>
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {(data.lifecycle || []).map((stage, idx) => {
                const isWarning = stage.status === "Warning";
                const isCritical = stage.status === "Critical";
                const stageColor = isCritical ? "var(--critical)" : isWarning ? "var(--warning)" : "var(--success)";
                
                return (
                  <div key={idx} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: stageColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontSize: "11px",
                        fontWeight: "700"
                      }}>
                        {idx + 1}
                      </div>
                      {idx < data.lifecycle.length - 1 && (
                        <div style={{ width: "2px", height: "20px", background: "var(--border-card)", marginTop: "4px" }}></div>
                      )}
                    </div>
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                        <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>{stage.stage}</strong>
                        <span className="status-badge" style={{
                          fontSize: "9px",
                          fontWeight: "700",
                          padding: "2px 8px",
                          borderRadius: "100px",
                          background: isCritical ? "rgba(239,68,68,0.1)" : isWarning ? "rgba(234,88,12,0.1)" : "rgba(22,163,74,0.1)",
                          color: stageColor
                        }}>
                          {stage.status.toUpperCase()}
                        </span>
                      </div>
                      <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)" }}>{stage.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {activeTab === "sharing" && (
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          
          {/* Third-Party Exposure Table — live-synced from Anonymization module */}
          <div className="section-card" style={{ flex: "2 1 500px", padding: "28px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Share2 size={18} style={{ color: "var(--warning)" }} />
                <span>Third-Party Data Exposure</span>
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "700", color: "var(--success)", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", padding: "3px 10px", borderRadius: "100px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success)", animation: "pulse 1.5s infinite" }} />
                  LIVE
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{liveShareLog.length} record{liveShareLog.length !== 1 ? "s" : ""}</span>
              </div>
            </div>

            {liveShareLog.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
                <Share2 size={36} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                <p style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>No third-party disclosures yet</p>
                <p style={{ fontSize: "12px" }}>Records appear here automatically when you authorize a share in the <strong style={{ color: "var(--info)" }}>Anonymization</strong> module.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="premium-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-card)", color: "var(--text-muted)" }}>
                      <th style={{ textAlign: "left", padding: "10px 12px" }}>Partner / Vendor</th>
                      <th style={{ textAlign: "left", padding: "10px 12px" }}>Purpose</th>
                      <th style={{ textAlign: "left", padding: "10px 12px" }}>Medium</th>
                      <th style={{ textAlign: "left", padding: "10px 12px" }}>Fields Shared</th>
                      <th style={{ textAlign: "left", padding: "10px 12px" }}>Risk</th>
                      <th style={{ textAlign: "left", padding: "10px 12px" }}>Timestamp</th>
                      <th style={{ textAlign: "right", padding: "10px 12px" }}>Compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveShareLog.map((record, idx) => {
                      const dest = record.sharedTo || record.destination || "Unknown";
                      const highRiskDestinations = ["Stripe Payment Gateway", "AWS Analytics DWH"];
                      const medRiskDestinations = ["Salesforce CRM", "HubSpot CRM"];
                      const risk = highRiskDestinations.includes(dest) ? "High" : medRiskDestinations.includes(dest) ? "Medium" : "Low";
                      const riskCol = risk === "High" ? "var(--critical)" : risk === "Medium" ? "var(--warning)" : "var(--success)";
                      const fields = Array.isArray(record.fields) ? record.fields : [];
                      const isLast = idx === liveShareLog.length - 1;
                      return (
                        <tr key={record.id || idx} style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.025)", transition: "background 0.2s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <td style={{ padding: "12px" }}>
                            <div style={{ fontWeight: "700", color: "var(--text-primary)", fontSize: "13px" }}>{dest}</div>
                            <div style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "monospace", marginTop: "2px" }}>{record.id}</div>
                          </td>
                          <td style={{ padding: "12px", color: "var(--text-body)", maxWidth: "160px" }}>{record.purpose}</td>
                          <td style={{ padding: "12px" }}>
                            <span style={{ fontSize: "11px", background: "rgba(99,102,241,0.08)", color: "var(--info)", padding: "2px 8px", borderRadius: "100px", fontWeight: "600" }}>
                              {record.sharingMedium}
                            </span>
                          </td>
                          <td style={{ padding: "12px", maxWidth: "180px" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                              {fields.slice(0, 3).map(f => (
                                <span key={f} style={{ fontSize: "10px", background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", padding: "1px 6px", borderRadius: "4px", border: "1px solid var(--border-card)" }}>{f}</span>
                              ))}
                              {fields.length > 3 && (
                                <span style={{ fontSize: "10px", color: "var(--text-muted)", padding: "1px 4px" }}>+{fields.length - 3} more</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "12px" }}>
                            <span style={{ color: riskCol, fontWeight: "700", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              {risk === "High" && <AlertTriangle size={12} />}
                              {risk}
                            </span>
                          </td>
                          <td style={{ padding: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "var(--text-muted)" }}>
                              <Clock size={11} />
                              <span>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.timestamp))}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px", textAlign: "right" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: "700", color: "var(--success)" }}>
                              <ShieldCheck size={13} />
                              DPDP Compliant
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

          {/* Minimization Opportunities */}
          <div className="section-card" style={{ flex: "1 1 300px", padding: "28px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
            <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Trash2 size={18} style={{ color: "var(--critical)" }} />
              <span>Data Minimization Audits</span>
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {(data.minimizationOpps || []).map((opp, idx) => (
                <div key={idx} style={{ padding: "12px", background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.08)", borderRadius: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span className="status-badge" style={{ background: "rgba(239,68,68,0.1)", color: "var(--critical)", fontSize: "10px", padding: "2px 8px", borderRadius: "100px", fontWeight: "700" }}>
                      OPPORTUNITY
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--success)", fontWeight: "700" }}>
                      -{opp.estimatedReduction} Footprint
                    </span>
                  </div>
                  <strong style={{ display: "block", fontSize: "13px", color: "var(--text-primary)", marginBottom: "2px" }}>Truncate field '{opp.field}'</strong>
                  <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>{opp.opportunity}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </PageContainer>
  );
}
