import React, { useState } from "react";
import { usePrivacySoc } from "../context/PrivacySocContext.jsx";
import { 
  Fingerprint, 
  Mail, 
  Phone, 
  CreditCard, 
  Key, 
  Cookie, 
  ShieldAlert, 
  X, 
  Server, 
  ShieldCheck, 
  User, 
  Lock,
  ArrowRight,
  TrendingDown
} from "lucide-react";

export default function PiiDiscovery() {
  const { piiFields, consents, activeApiKey } = usePrivacySoc();
  const [selectedCard, setSelectedCard] = useState(null);

  // Compute counts from consents dataset
  const getFieldCount = (type) => {
    if (!consents || !consents.length) return 0;
    if (type === "Emails") {
      return consents.filter(c => c.email).length;
    }
    if (type === "Phone Numbers") {
      return consents.filter(c => c.phone).length;
    }
    if (type === "PAN" || type === "Aadhaar") {
      // Aadhaar and PAN columns in national identifier classification
      return consents.filter(c => c.address && c.address.includes("India")).length; 
    }
    return Math.floor(consents.length * 0.7); // Mock active ratio for settings
  };

  // Reusable PII catalog setup
  const piiCategories = [
    {
      id: "emails",
      title: "Emails",
      count: getFieldCount("Emails") || 214,
      severity: "medium",
      icon: Mail,
      desc: "Electronic mail contact vectors cataloged inside database core schema.",
      table: "consent_records",
      column: "email",
      encryption: "AES-256 Masked",
      owner: "User Management Dev Group",
      policy: "Keep for 5 years after account termination.",
      affectedApis: ["/api/v1/user/profile", "/api/v1/notifications"]
    },
    {
      id: "phone",
      title: "Phone Numbers",
      count: getFieldCount("Phone Numbers") || 198,
      severity: "medium",
      icon: Phone,
      desc: "Mobile identity tokens scanned inside active transaction tables.",
      table: "consent_records",
      column: "phone",
      encryption: "Masked last 4 digits",
      owner: "Marketing Ops Team",
      policy: "Purge after 1 year of revocation.",
      affectedApis: ["/api/v1/user/profile", "/api/v1/checkout"]
    },
    {
      id: "pan",
      title: "PAN",
      count: getFieldCount("PAN") || 84,
      severity: "high",
      icon: CreditCard,
      desc: "Permanent Account Numbers discovered in client tax records.",
      table: "tax_filing_store",
      column: "pan_number",
      encryption: "AES-256 Fully Encrypted",
      owner: "Finance Audit Team",
      policy: "Keep for 7 years for compliance reporting.",
      affectedApis: ["/api/v1/checkout", "/api/v1/billing"]
    },
    {
      id: "aadhaar",
      title: "Aadhaar",
      count: getFieldCount("Aadhaar") || 143,
      severity: "critical",
      icon: Fingerprint,
      desc: "Indian national identity registers. Requires guardian verification for minors.",
      table: "consent_records",
      column: "aadhaar_id",
      encryption: "Plaintext (No Encryption Detected)",
      owner: "KYC Onboarding Team",
      policy: "Must comply with Aadhaar Vault regulations.",
      affectedApis: ["/api/v1/checkout", "/api/v1/kyc"]
    },
    {
      id: "passwords",
      title: "Passwords",
      count: 0, // Should be 0 in a secure system!
      severity: "critical",
      icon: Lock,
      desc: "Hashed credential variables scanned in authentication databases.",
      table: "user_credentials",
      column: "password_hash",
      encryption: "bcrypt Salted Hashed",
      owner: "InfoSec Core Team",
      policy: "Encrypted at all times. Never display.",
      affectedApis: ["/api/v1/auth/login", "/api/v1/auth/reset"]
    },
    {
      id: "tokens",
      title: "Tokens",
      count: 32,
      severity: "high",
      icon: Key,
      desc: "Bearer JWT logs and session keys stored in telemetry layers.",
      table: "session_cache",
      column: "auth_token",
      encryption: "Hashed SHA-256",
      owner: "Auth Gateway Engineers",
      policy: "Purge automatically after 24 hours.",
      affectedApis: ["/api/v1/auth/verify"]
    },
    {
      id: "cookies",
      title: "Cookies",
      count: 154,
      severity: "low",
      icon: Cookie,
      desc: "Tracking cookies containing analytics telemetry.",
      table: "analytics_tracking",
      column: "cookie_id",
      encryption: "None",
      owner: "Growth Marketing",
      policy: "Expire after 30 days of inactivity.",
      affectedApis: ["/api/v1/analytics/track"]
    },
    {
      id: "session",
      title: "Session IDs",
      count: 98,
      severity: "low",
      icon: Server,
      desc: "Ephemeral memory logs cached across database clusters.",
      table: "redis_sessions",
      column: "session_key",
      encryption: "Encrypted in Transit",
      owner: "Infra Devops Team",
      policy: "Evict immediately after logout.",
      affectedApis: ["/api/v1/auth/status"]
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow" style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            <Fingerprint size={12} /> DPDP Sec. 4 Compliance
          </span>
          <h1 className="page-title">Personally Identifiable Information (PII)</h1>
          <p className="page-subtitle">Interactive inventory of personal identifiers discovered in API logs and databases.</p>
        </div>
      </div>

      {/* Grid view of card components */}
      <div className="pii-grid">
        {piiCategories.map(cat => {
          const IconComp = cat.icon;
          return (
            <div 
              key={cat.id} 
              className="glass-panel pii-soc-card" 
              onClick={() => setSelectedCard(cat)}
            >
              <div className="pii-soc-header">
                <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "8px", color: "var(--primary)" }}>
                  <IconComp size={20} />
                </div>
                <span className={`severity-badge ${cat.severity}`}>{cat.severity}</span>
              </div>
              <p style={{ color: "var(--text-soft)", fontSize: "0.8rem", fontWeight: "700", textTransform: "uppercase" }}>
                PII Attribute
              </p>
              <h3 className="pii-soc-title" style={{ marginTop: "4px", fontSize: "1.2rem" }}>{cat.title}</h3>
              <p className="pii-soc-count" style={{ marginTop: "8px" }}>{cat.count}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px", marginTop: "12px" }}>
                <span style={{ fontSize: "0.74rem", color: "var(--text-soft)" }}>Click to inspect columns</span>
                <ArrowRight size={14} style={{ color: "var(--text-soft)" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Side Slide-Out Drawer Panel */}
      {selectedCard && (
        <div className="slide-drawer-backdrop" onClick={() => setSelectedCard(null)}>
          <div className="slide-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="slide-drawer-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Fingerprint size={20} style={{ color: "var(--primary)" }} />
                <div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-primary)" }}>{selectedCard.title} Inspection</h3>
                  <span className={`severity-badge ${selectedCard.severity}`}>{selectedCard.severity} Impact</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCard(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-soft)", cursor: "pointer", padding: "6px" }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="slide-drawer-body">
              <div>
                <h4 style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "var(--text-soft)", fontWeight: "800", marginBottom: "8px" }}>
                  Description
                </h4>
                <p style={{ color: "var(--text-body)", fontSize: "0.92rem", lineHeight: "1.5" }}>
                  {selectedCard.desc}
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px" }}>
                <div>
                  <h4 style={{ fontSize: "0.78rem", textTransform: "uppercase", color: "var(--text-soft)", fontWeight: "800", marginBottom: "4px" }}>
                    Database Table
                  </h4>
                  <p style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.9rem" }}>{selectedCard.table}</p>
                </div>
                <div>
                  <h4 style={{ fontSize: "0.78rem", textTransform: "uppercase", color: "var(--text-soft)", fontWeight: "800", marginBottom: "4px" }}>
                    Mapped Column
                  </h4>
                  <p style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.9rem", fontFamily: "monospace" }}>{selectedCard.column}</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px" }}>
                <div>
                  <h4 style={{ fontSize: "0.78rem", textTransform: "uppercase", color: "var(--text-soft)", fontWeight: "800", marginBottom: "4px" }}>
                    Encryption Status
                  </h4>
                  <span style={{ fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "4px", color: selectedCard.encryption.includes("None") || selectedCard.encryption.includes("Plaintext") ? "var(--critical)" : "var(--success)", fontWeight: "600" }}>
                    {selectedCard.encryption.includes("None") || selectedCard.encryption.includes("Plaintext") ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
                    {selectedCard.encryption}
                  </span>
                </div>
                <div>
                  <h4 style={{ fontSize: "0.78rem", textTransform: "uppercase", color: "var(--text-soft)", fontWeight: "800", marginBottom: "4px" }}>
                    Data Controller
                  </h4>
                  <p style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "0.9rem" }}>{selectedCard.owner}</p>
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px" }}>
                <h4 style={{ fontSize: "0.78rem", textTransform: "uppercase", color: "var(--text-soft)", fontWeight: "800", marginBottom: "8px" }}>
                  Data Retention Policy (Sec. 12)
                </h4>
                <p style={{ color: "var(--text-body)", fontSize: "0.88rem", lineHeight: "1.4" }}>
                  {selectedCard.policy}
                </p>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px" }}>
                <h4 style={{ fontSize: "0.78rem", textTransform: "uppercase", color: "var(--text-soft)", fontWeight: "800", marginBottom: "8px" }}>
                  Affected API Endpoints
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {selectedCard.affectedApis.map((api, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        fontFamily: "monospace", 
                        fontSize: "0.82rem", 
                        padding: "8px 12px", 
                        background: "rgba(255,255,255,0.03)", 
                        border: "1px solid var(--border-card)", 
                        borderRadius: "6px",
                        color: "var(--primary)",
                        display: "flex",
                        justifyContent: "space-between"
                      }}
                    >
                      <span>{api}</span>
                      <span style={{ color: "var(--text-soft)", fontSize: "0.7rem" }}>Active logs</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Fix Section */}
              <div style={{ background: "rgba(99,102,241,0.06)", border: "1px dashed var(--border-card-active)", borderRadius: "8px", padding: "16px", marginTop: "10px" }}>
                <h4 style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: "700", marginBottom: "6px" }}>
                  Recommended Action Fix
                </h4>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: "1.4", marginBottom: "12px" }}>
                  {selectedCard.severity === "critical" || selectedCard.severity === "high" 
                    ? "Plaintext payload transmission detected. Patch with encrypt filter before writing database log."
                    : "Obfuscate details using partial string masking values in UI display cards."}
                </p>
                <code style={{ display: "block", background: "#09090b", padding: "10px", borderRadius: "6px", fontSize: "0.78rem", color: "#a5b4fc", fontFamily: "monospace" }}>
                  {selectedCard.id === "aadhaar" 
                    ? "app.post('/api/checkout', encrypt_field('aadhaar'))" 
                    : `obfuscate_${selectedCard.id === "emails" ? "email" : "mobile"}(payload.${selectedCard.column})`}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
