import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../layout/PageContainer";
import { getDashboardData } from "../services/dashboardService";
import { useToast } from "../context/ToastContext";
import { usePrivacySoc } from "../context/PrivacySocContext";
import {
  Shield,
  ShieldCheck,
  CheckCircle,
  Lock,
  Share2,
  Database,
  AlertTriangle,
  Play,
  FileDown,
  UserCheck,
  RefreshCw,
  ArrowRight,
  Clock,
  Activity,
  Layers,
  Sparkles
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  Legend,
  CartesianGrid
} from "recharts";
import { API_BASE_URL } from "../config/appConfig";

export default function Overview() {
  const {
    statusInfo,
    dashboardData: data,
    dashboardLoading: isLoading,
    isRefreshing,
    forceRefresh,
    checkStatusAndLoad
  } = usePrivacySoc();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleForceRefresh = async () => {
    addToast("Triggering full data sync & analysis pipeline...", "info");
    const success = await forceRefresh();
    if (success) {
      addToast("Sync and privacy analysis complete.", "success");
    } else {
      addToast("Failed to refresh dashboard. Check connection settings.", "error");
    }
  };

  const handleTriggerSync = async () => {
    addToast("Re-analysing every connected platform...", "info");
    try {
      // fetch() does not throw on a 404, so the previous version reported
      // success for a route that did not exist. Check the response.
      const response = await fetch(`${API_BASE_URL}/refresh`, { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Sync failed (${response.status})`);
      addToast(
        result.sources ? `Analysis complete across ${result.sources} platform(s).` : "Analysis complete.",
        "success"
      );
      checkStatusAndLoad();
    } catch (error) {
      addToast(error.message || "Sync request failed.", "error");
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="Command Center" subtitle="Loading privacy posture...">
        <div className="skeleton-grid" style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <div className="skeleton-card animate-pulse" style={{ height: "240px", borderRadius: "12px", background: "rgba(255,255,255,0.03)" }}></div>
          <div className="skeleton-card animate-pulse" style={{ height: "240px", borderRadius: "12px", background: "rgba(255,255,255,0.03)" }}></div>
          <div className="skeleton-card animate-pulse" style={{ height: "240px", borderRadius: "12px", background: "rgba(255,255,255,0.03)" }}></div>
        </div>
      </PageContainer>
    );
  }

  if (statusInfo.status === "NOT_CONNECTED") {
    return (
      <PageContainer title="Privacy Command Center" subtitle="Real-time DPDP posture and governance summary.">
        <div className="section-card text-center" style={{ padding: "80px 40px", maxWidth: "680px", margin: "40px auto", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", boxShadow: "0 8px 30px rgba(0,0,0,0.05)" }}>
          <AlertTriangle size={64} className="text-warning mb-4 animate-bounce" style={{ margin: "0 auto", color: "var(--warning)" }} />
          <h2 className="section-card-title mb-3" style={{ fontSize: "28px", fontWeight: "700", color: "var(--text-primary)" }}>No Platform Connected</h2>
          <p className="text-muted mb-6" style={{ fontSize: "16px", color: "var(--text-muted)", lineHeight: "1.6" }}>
            The Privacy Command Center requires a business platform connection to begin scanning customer consents, mapping sensitive PII, and checking regulatory alignment.
          </p>
          <button onClick={() => navigate("/integration")} className="btn-primary" style={{ padding: "14px 28px", borderRadius: "8px", fontSize: "16px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <span>Establish Connection</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </PageContainer>
    );
  }

  const complianceScoreVal = parseInt(data?.kpis?.complianceScore || "0");
  const activeConsentsCount = parseInt(data?.kpis?.activeConsents?.replace(/,/g, "") || "0");
  const pendingRequestsCount = parseInt(String(data?.kpis?.pendingRequests ?? "0").replace(/,/g, ""));
  const revokedRequestsCount = parseInt(String(data?.kpis?.revokedConsents ?? "0").replace(/,/g, ""));
  const piiHighRisk = parseInt(data?.kpis?.piiHighRisk || "0");
  const piiMediumRisk = parseInt(data?.kpis?.piiMediumRisk || "0");
  const piiLowRisk = parseInt(data?.kpis?.piiLowRisk || "0");

  const isHealthyScore = complianceScoreVal >= 80;

  // 1. Consent Breakdown Donut Chart Data
  const consentBreakdownData = [
    { name: "Granted / Approved", value: activeConsentsCount, color: "#10b981" },
    { name: "Revoked / Opt-out", value: revokedRequestsCount, color: "#ef4444" },
    { name: "Pending Audit", value: pendingRequestsCount, color: "#f59e0b" }
  ];

  // 2. PII Risk Distribution Bar Chart Data
  const piiRiskData = [
    { name: "High Risk", value: piiHighRisk, color: "#ef4444" },
    { name: "Medium Risk", value: piiMediumRisk, color: "#f59e0b" },
    { name: "Low Risk", value: piiLowRisk, color: "#3b82f6" }
  ];

  // 3. Anonymization Activity 7-day Trend Data
  const anonymizationTrendData = data?.anonymizationTrendData || [];

  return (
    <PageContainer 
      title="DPDP Command Center" 
      subtitle="Executive summary of the organization's real-time privacy posture and regulatory compliance."
    >
      {/* Premium KPIs Grid */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "28px" }}>
        <div style={{ padding: "16px 20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "12px" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-soft)", textTransform: "uppercase" }}>Compliance Index</span>
          <strong style={{ display: "block", fontSize: "28px", color: "var(--info)", margin: "4px 0" }}>{data?.kpis?.complianceScore}</strong>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Target threshold: &gt;80%</span>
        </div>
        <div style={{ padding: "16px 20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "12px" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-soft)", textTransform: "uppercase" }}>Total Consents</span>
          <strong style={{ display: "block", fontSize: "28px", color: "var(--success)", margin: "4px 0" }}>{data?.kpis?.totalConsents ?? "0"}</strong>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{data?.kpis?.activeConsents ?? 0} active in this sector</span>
        </div>
        <div style={{ padding: "16px 20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "12px" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-soft)", textTransform: "uppercase" }}>Discovered PII</span>
          <strong style={{ display: "block", fontSize: "28px", color: "#7c3aed", margin: "4px 0" }}>{data?.kpis?.sensitivePii} fields</strong>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Sensitive data categories</span>
        </div>
        <div style={{ padding: "16px 20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "12px" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-soft)", textTransform: "uppercase" }}>Adapter State</span>
          <strong style={{ display: "block", fontSize: "28px", color: "var(--text-primary)", margin: "4px 0" }}>{data?.systemHealth?.api === "Connected" ? "Active" : "Offline"}</strong>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{data?.sector?.label || "No platform connected"}</span>
        </div>
      </section>

      {/* Visual Analytics Charts Workspace */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px", marginBottom: "32px" }}>
        
        {/* Chart 1: DPDP Compliance Score Circular Gauge */}
        <div className="section-card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", minHeight: "300px", display: "flex", flexDirection: "column" }}>
          <h4 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={16} className="text-info" style={{ color: "var(--info)" }} />
            <span>DPDP Statutory Compliance Audit</span>
          </h4>
          
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "24px" }}>
            <div style={{ width: "130px", height: "130px", flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Satisfied", value: complianceScoreVal },
                      { name: "Gap Gaps", value: 100 - complianceScoreVal }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={55}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                  >
                    <Cell fill="var(--info)" />
                    <Cell fill="var(--border-card)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: "relative", top: "-88px", textAlign: "center", fontSize: "22px", fontWeight: "800", color: "var(--text-primary)" }}>
                {complianceScoreVal}%
              </div>
            </div>
            <div>
              <h5 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "700", color: "var(--text-primary)" }}>Statutory Alignment Index</h5>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                Score is automatically graded out of the 10 core data protection provisions under the Indian Digital Personal Data Protection (DPDP) Act.
              </p>
              <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Notice Coverage: <strong>{data?.complianceOverview?.consentCoverage}</strong></span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>PII Protected: <strong>Yes</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart 2: Consent Status Breakdown Donut Chart */}
        <div className="section-card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", minHeight: "300px", display: "flex", flexDirection: "column" }}>
          <h4 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle size={16} className="text-success" style={{ color: "var(--success)" }} />
            <span>Consent Status Breakdown</span>
          </h4>
          <div style={{ flex: 1, minHeight: "180px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={consentBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {consentBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "8px" }}
                  itemStyle={{ color: "var(--text-primary)", fontSize: "12px" }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: PII Risk Distribution Bar Chart */}
        <div className="section-card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", minHeight: "300px", display: "flex", flexDirection: "column" }}>
          <h4 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Lock size={16} style={{ color: "#7c3aed" }} />
            <span>PII Risk Distribution</span>
          </h4>
          <div style={{ flex: 1, minHeight: "180px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={piiRiskData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-card)" />
                <XAxis dataKey="name" stroke="var(--text-soft)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-soft)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "8px" }}
                  itemStyle={{ color: "var(--text-primary)", fontSize: "12px" }}
                />
                {/* The data carries `value`; reading `count` gave every bar a
                    height of zero, which is why this chart looked empty. */}
                <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {piiRiskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Anonymization Trends Sleek Area Chart */}
        <div className="section-card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", minHeight: "300px", display: "flex", flexDirection: "column" }}>
          <h4 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Share2 size={16} style={{ color: "#ec4899" }} />
            <span>Anonymization Activity Trends</span>
          </h4>
          <div style={{ flex: 1, minHeight: "180px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={anonymizationTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="processedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-card)" />
                <XAxis dataKey="day" stroke="var(--text-soft)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-soft)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "8px" }}
                  itemStyle={{ color: "var(--text-primary)", fontSize: "12px" }}
                />
                <Area type="monotone" dataKey="processed" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#processedGrad)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </section>

      {/* ROPA Audit Trail & Active Tasks Checklist */}
      <div className="dashboard-layout-row" style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
        
        {/* Left Side: Audit Log Timeline */}
        <div style={{ flex: "2 1 500px" }}>
          <div className="section-card" style={{ padding: "24px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", height: "100%" }}>
            <h3 className="section-card-title" style={{ fontSize: "16px", fontWeight: "700", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Activity size={18} style={{ color: "var(--success)" }} />
              <span>Real-Time Audit Trail (ROPA)</span>
            </h3>
            
            <div className="activity-timeline" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {(data?.recentActivity || []).length > 0 ? (
                (data.recentActivity).map((activity) => (
                  <div key={activity.id} className="timeline-item" style={{ display: "flex", gap: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div className={`timeline-dot dot-${activity.status}`} style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: activity.status === "danger" ? "var(--critical)" : "var(--success)",
                        border: "2px solid var(--bg-card)",
                        zIndex: 1
                      }}></div>
                      <div style={{ width: "2px", flexGrow: 1, background: "var(--border-card)", margin: "4px 0" }}></div>
                    </div>
                    <div style={{ flexGrow: 1, paddingBottom: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                        <strong className="activity-title" style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>{activity.action}</strong>
                        <span className="activity-time" style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Clock size={12} />
                          <span>{activity.timestamp}</span>
                        </span>
                      </div>
                      <p className="activity-detail" style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>{activity.detail}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: "14px", padding: "20px 0" }}>
                  No synchronization runs performed yet. Check platform connection.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Quick Action & Compliance Tasks */}
        <div style={{ flex: "1 1 300px" }}>
          <div className="section-card" style={{ padding: "24px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <h3 className="section-card-title" style={{ fontSize: "16px", fontWeight: "700", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Layers size={18} style={{ color: "var(--warning)" }} />
                <span>Action Required Items</span>
              </h3>
              
              <div className="tasks-list" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {(data?.upcomingTasks || []).length > 0 ? (
                  (data.upcomingTasks).map((task) => (
                    <div key={task.id} className="task-item-card" style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      background: "var(--bg-card-hover)",
                      border: "1px solid var(--border-card)",
                      borderRadius: "8px"
                    }}>
                      <div>
                        <strong className="task-title" style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>{task.task}</strong>
                        <span className="task-due-date" style={{ fontSize: "11px", color: "var(--text-muted)" }}>Due: {task.due}</span>
                      </div>
                      <span className={`status-badge status-badge-${task.priority === "high" ? "danger" : "warning"}`} style={{
                        fontSize: "10px",
                        fontWeight: "700",
                        padding: "2px 8px",
                        borderRadius: "100px",
                        textTransform: "uppercase"
                      }}>
                        {task.priority}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "var(--success)", fontSize: "14px", padding: "20px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                    <ShieldCheck size={18} />
                    <span>All regulatory checklist items closed!</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-card)", paddingTop: "20px", marginTop: "24px" }}>
              <button 
                type="button" 
                onClick={handleTriggerSync}
                className="btn-primary" 
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px", borderRadius: "8px", fontSize: "14px", fontWeight: "600" }}
              >
                <Play size={16} />
                <span>Run Compliance Scan</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </PageContainer>
  );
}
