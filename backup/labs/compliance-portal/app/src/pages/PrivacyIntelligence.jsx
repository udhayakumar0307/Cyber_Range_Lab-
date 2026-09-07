import React from "react";
import { usePrivacySoc } from "../context/PrivacySocContext.jsx";
import { useNavigate } from "react-router-dom";
import { Eye, Fingerprint, AlertOctagon, Scale, CheckSquare, Scan, ShieldAlert, ArrowRight } from "lucide-react";

export default function PrivacyIntelligence() {
  const { readinessScores, piiCount, consents } = usePrivacySoc();
  const navigate = useNavigate();

  const systemsList = [
    {
      id: "pii",
      title: "PII Discovery Catalog",
      desc: "Identifies personal data columns, maps sensitivity, and lists encryption controls.",
      count: `${piiCount} fields`,
      status: "Monitored",
      statusColor: "var(--success)",
      icon: Fingerprint,
      route: "/pii"
    },
    {
      id: "risks",
      title: "Risk Control Center",
      desc: "Vulnerability heatmaps correlating database catalog tables with API endpoints.",
      count: "8 Threats",
      status: "Critical Gaps",
      statusColor: "var(--critical)",
      icon: AlertOctagon,
      route: "/risks"
    },
    {
      id: "compliance",
      title: "DPDP Readiness Rules",
      desc: "Statutory checklist auditing notice, consent withdrawal, and kids data regulations.",
      count: `${readinessScores.dpdp}%`,
      status: readinessScores.dpdp >= 75 ? "Excellent" : "Needs Action",
      statusColor: readinessScores.dpdp >= 75 ? "var(--success)" : "var(--warning)",
      icon: Scale,
      route: "/compliance"
    },
    {
      id: "consent",
      title: "Consent Analytics logs",
      desc: "Real-time records tracking granted vs revoked share proportions by purpose.",
      count: `${consents.length} profiles`,
      status: "Synced",
      statusColor: "var(--info)",
      icon: CheckSquare,
      route: "/consent"
    },
    {
      id: "scanner",
      title: "Active API Scanner Gateway",
      desc: "Ingests swagger documents and AWS cloud profiles to identify data leaks.",
      count: "Online",
      status: "Active Scraper",
      statusColor: "var(--success)",
      icon: Scan,
      route: "/scanner"
    },
    {
      id: "breach",
      title: "Breach Containment center",
      desc: "Execute mitigation logs and playbooks under Sec. 8(6) breach notifications.",
      count: "Protected",
      status: "Secure",
      statusColor: "var(--success)",
      icon: ShieldAlert,
      route: "/breach"
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow" style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            <Eye size={12} /> SentinelAI Core Systems
          </span>
          <h1 className="page-title">Privacy Intelligence Hub</h1>
          <p className="page-subtitle">Central command center directory monitoring active catalogs and privacy postures.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
        {systemsList.map(sys => {
          const IconComp = sys.icon;
          return (
            <div 
              key={sys.id} 
              className="glass-panel" 
              style={{ 
                padding: "24px", 
                cursor: "pointer", 
                display: "flex", 
                flexDirection: "column", 
                justifyContent: "space-between",
                gap: "16px"
              }}
              onClick={() => navigate(sys.route)}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "8px", color: "var(--primary)" }}>
                    <IconComp size={22} />
                  </div>
                  <span 
                    className="severity-badge" 
                    style={{ 
                      backgroundColor: "rgba(255,255,255,0.03)", 
                      color: sys.statusColor,
                      border: `1px solid ${sys.statusColor}33`
                    }}
                  >
                    {sys.status}
                  </span>
                </div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: "700", color: "var(--text-primary)" }}>{sys.title}</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "6px", lineHeight: "1.4" }}>
                  {sys.desc}
                </p>
              </div>

              <div style={{ display: "flex", justify: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px", marginTop: "8px" }}>
                <div>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-soft)", textTransform: "uppercase", fontWeight: "700" }}>Indexed Vol</span>
                  <p style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--text-primary)" }}>{sys.count}</p>
                </div>
                <div style={{ color: "var(--text-soft)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "0.78rem" }}>Launch</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
