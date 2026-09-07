import React, { useState, useMemo } from "react";
import { usePrivacySoc } from "../context/PrivacySocContext.jsx";
import { 
  Bar, 
  BarChart, 
  CartesianGrid, 
  Cell, 
  Legend, 
  Pie, 
  PieChart, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis 
} from "recharts";
import { 
  calculateKpis, 
  filterConsents, 
  getPurposeChartData, 
  getStatusChartData, 
  toCsv 
} from "../utils/consentMetrics.js";
import { ThumbsUp, ThumbsDown, RefreshCcw, Download, Search, CheckSquare } from "lucide-react";

const CHART_COLORS = {
  Granted: "#10b981", // Emerald
  Revoked: "#ef4444"  // Rose
};

export default function ConsentIntelligence() {
  const { consents, loading, error, activeApiKey } = usePrivacySoc();
  const [purpose, setPurpose] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(() => {
    return filterConsents(consents, purpose, searchTerm);
  }, [consents, purpose, searchTerm]);

  const kpis = useMemo(() => calculateKpis(filtered), [filtered]);
  const statusData = useMemo(() => getStatusChartData(filtered), [filtered]);
  const purposeData = useMemo(() => getPurposeChartData(filtered), [filtered]);

  const handleExport = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "consent-intelligence-logs.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const purposesList = ["All", "Marketing", "Research", "Analytics"];

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow" style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            <CheckSquare size={12} /> DPDP Sec. 6 Consent Logs
          </span>
          <h1 className="page-title">Consent Intelligence</h1>
          <p className="page-subtitle">Track, filter, and audit user consent telemetry records in real-time.</p>
        </div>
        <div>
          <button className="premium-btn secondary" onClick={handleExport} disabled={filtered.length === 0}>
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: "16px 20px", 
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
          flexWrap: "wrap"
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexGrow: 1, maxWidth: "400px" }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "12px", color: "var(--text-soft)" }} />
            <input
              type="text"
              placeholder="Search user name, ID, or email..."
              style={{
                width: "100%",
                height: "38px",
                paddingLeft: "38px",
                paddingRight: "12px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border-card)",
                borderRadius: "8px",
                color: "var(--text-primary)",
                outline: "none",
                fontSize: "0.88rem"
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Purpose:</span>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border-card)" }}>
            {purposesList.map(p => (
              <button
                key={p}
                onClick={() => setPurpose(p)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: purpose === p ? "var(--primary)" : "transparent",
                  color: purpose === p ? "var(--primary-contrast)" : "var(--text-muted)",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Consent Metrics Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: "24px" }}>
        <div className="glass-panel kpi-soc-card">
          <div className="kpi-soc-header">
            <span>Granted Rate</span>
            <ThumbsUp size={16} style={{ color: "var(--success)" }} />
          </div>
          <div>
            <p className="kpi-soc-value" style={{ color: "var(--success)" }}>
              {kpis.grantedPercent.toFixed(1)}%
            </p>
          </div>
          <div className="kpi-soc-footer">User approval ratio</div>
        </div>

        <div className="glass-panel kpi-soc-card">
          <div className="kpi-soc-header">
            <span>Revoked Rate</span>
            <ThumbsDown size={16} style={{ color: "var(--critical)" }} />
          </div>
          <div>
            <p className="kpi-soc-value" style={{ color: "var(--critical)" }}>
              {kpis.revokedPercent.toFixed(1)}%
            </p>
          </div>
          <div className="kpi-soc-footer">User withdrawal ratio</div>
        </div>

        <div className="glass-panel kpi-soc-card">
          <div className="kpi-soc-header">
            <span>Revocation Volatility</span>
            <RefreshCcw size={16} style={{ color: "var(--warning)" }} />
          </div>
          <div>
            <p className="kpi-soc-value">{kpis.revocationRate.toFixed(1)}%</p>
          </div>
          <div className="kpi-soc-footer">Temporal revocation activity</div>
        </div>

        <div className="glass-panel kpi-soc-card">
          <div className="kpi-soc-header">
            <span>Total Sync Logs</span>
            <CheckSquare size={16} style={{ color: "var(--info)" }} />
          </div>
          <div>
            <p className="kpi-soc-value">{kpis.total}</p>
          </div>
          <div className="kpi-soc-footer">Active indexed profiles</div>
        </div>
      </div>

      {/* Visual Analytics Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "20px", marginBottom: "24px" }}>
        <div className="glass-panel" style={{ padding: "24px" }}>
          <h4 style={{ fontSize: "0.85rem", fontWeight: "800", textTransform: "uppercase", color: "var(--text-soft)", marginBottom: "16px" }}>
            Granted vs Revoked Shares
          </h4>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {statusData.map(entry => (
                  <Cell key={entry.name} fill={CHART_COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid var(--border-card)", borderRadius: "8px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel" style={{ padding: "24px" }}>
          <h4 style={{ fontSize: "0.85rem", fontWeight: "800", textTransform: "uppercase", color: "var(--text-soft)", marginBottom: "16px" }}>
            Purpose Categorizations
          </h4>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={purposeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="purpose" stroke="var(--text-muted)" fontSize={10} />
              <YAxis allowDecimals={false} stroke="var(--text-muted)" fontSize={10} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid var(--border-card)", borderRadius: "8px" }} />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="granted" name="Granted" fill={CHART_COLORS.Granted} radius={[4, 4, 0, 0]} />
              <Bar dataKey="revoked" name="Revoked" fill={CHART_COLORS.Revoked} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Consent Database Log Table */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <h4 style={{ fontSize: "0.85rem", fontWeight: "800", textTransform: "uppercase", color: "var(--text-soft)", marginBottom: "16px" }}>
          Active Consent Database Logs
        </h4>
        <div className="table-responsive">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Data Principal Name</th>
                <th>User ID</th>
                <th>Contact info</th>
                <th>Registered Purpose</th>
                <th>Consent Status</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "40px", color: "var(--text-soft)" }}>
                    No consent log matches
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 100).map(c => (
                  <tr key={c.user_id}>
                    <td>
                      <p style={{ fontWeight: "600", color: "var(--text-primary)" }}>{c.name}</p>
                      <p style={{ fontSize: "0.74rem", color: "var(--text-soft)" }}>{c.address || "No Address"}</p>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {c.user_id}
                    </td>
                    <td style={{ fontSize: "0.82rem" }}>
                      <p style={{ color: "var(--text-body)" }}>{c.email || "-"}</p>
                      <p style={{ color: "var(--text-soft)", fontSize: "0.78rem" }}>{c.phone || "-"}</p>
                    </td>
                    <td style={{ color: "var(--text-body)", fontWeight: "600" }}>{c.purpose}</td>
                    <td>
                      <span 
                        className="severity-badge"
                        style={{
                          backgroundColor: c.consent_status === "granted" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                          color: c.consent_status === "granted" ? "#6ee7b7" : "#fca5a5"
                        }}
                      >
                        {c.consent_status}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-soft)", fontSize: "0.78rem" }}>
                      {c.timestamp ? new Date(c.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
