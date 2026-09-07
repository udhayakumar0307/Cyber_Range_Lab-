import React, { useState } from "react";
import { AlertTriangle, ShieldCheck, Check, Copy, HelpCircle, ArrowRight, Play, Database, FileCode } from "lucide-react";

export default function PrivacyRisks() {
  const [copiedId, setCopiedId] = useState(null);

  const recommendations = [
    {
      id: 1,
      priority: "Critical",
      title: "Verifiable Parental Consent verification",
      rule: "Section 9 (Rule 10)",
      problem: "Minor age data fields discovered in checkout logs without associated parental validation tags.",
      impact: "Processing minor records without guardian OTP verification breaches Section 9 of the DPDP Act, risking statutory penalties up to ₹150 Crore.",
      suggestedFix: "Implement age check gate in authentication routers, sending a verification check payload to the guardian email address.",
      gain: 5.8,
      code: `// Express server age gating handler
app.post('/api/v1/auth/register', (req, res) => {
  const { email, age, parentEmail } = req.body;
  if (age < 18) {
    if (!parentEmail) {
      return res.status(400).json({ error: "Parental verification email required" });
    }
    sendParentalConsentVerification(parentEmail, email);
    return res.status(202).json({ status: "Pending parental authorization" });
  }
  // Proceed with registration...
});`
    },
    {
      id: 2,
      priority: "High",
      title: "Database Encryption Posture mitigation",
      rule: "Section 8 (Rule 8)",
      problem: "Discovered plain-text Aadhaar and PAN columns stored in database catalogs.",
      impact: "Storing direct identifiers without encryption fails Rule 8 safeguards, rendering the platform highly vulnerable to exposure during breach incidents.",
      suggestedFix: "Encrypt direct identifiers at rest prior to persistence utilizing AES-256-GCM encryption middleware.",
      gain: 4.5,
      code: `const crypto = require('crypto');

function encryptField(value, secretKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return { 
    encrypted, 
    iv: iv.toString('hex'), 
    tag 
  };
}`
    },
    {
      id: 3,
      priority: "Medium",
      title: "Notice disclaimer check during checkout",
      rule: "Section 5 (Rule 2)",
      problem: "Consent logs recorded without notice descriptive headers for checkout operations.",
      impact: "Section 5 requires clear notification of data collected and purpose prior to consent. Missing notices make consent legally invalid.",
      suggestedFix: "Inject purpose description headers to the payload object and display notice checkboxes to customers prior to checkout.",
      gain: 3.2,
      code: `// Consent log validation schema
const consentRecord = {
  user_id: user.id,
  consent_status: "granted",
  purpose: "Billing & Order Dispatch", 
  notice_version: "v2.1", // Link to notices catalog
  timestamp: new Date().toISOString()
};`
    }
  ];

  const handleCopy = (id, code) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow" style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            <AlertTriangle size={12} /> Risk Management
          </span>
          <h1 className="page-title">Privacy Risk Recommendations</h1>
          <p className="page-subtitle">Prioritized list of data discoveries requiring mitigation, showing business impact analysis and developer fix code.</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginTop: "24px" }}>
        {recommendations.map((rec) => (
          <div key={rec.id} className="glass-panel" style={{ padding: "28px" }}>
            
            {/* Header info */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid var(--border-card)", paddingBottom: "16px", marginBottom: "16px" }}>
              <div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span className={`severity-badge ${rec.priority.toLowerCase()}`} style={{ fontSize: "0.75rem" }}>
                    {rec.priority} Priority
                  </span>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-soft)", fontWeight: "600" }}>{rec.rule}</span>
                </div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "var(--text-primary)", marginTop: "8px" }}>
                  {rec.title}
                </h3>
              </div>

              <div style={{ background: "var(--primary-glow)", border: "1px solid var(--border-card)", borderRadius: "8px", padding: "8px 16px", textAlign: "center" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-soft)", textTransform: "uppercase", fontWeight: "700" }}>Compliance Gain</span>
                <p style={{ fontSize: "1.15rem", fontWeight: "700", color: "var(--primary)", marginTop: "2px" }}>+{rec.gain}%</p>
              </div>
            </div>

            {/* Problem & Impact description */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "20px" }}>
              <div>
                <h4 style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>Problem Statement</h4>
                <p style={{ fontSize: "0.85rem", color: "var(--text-body)", lineHeight: "1.5" }}>{rec.problem}</p>
              </div>
              <div>
                <h4 style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>Business & Regulatory Impact</h4>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: "1.5" }}>{rec.impact}</p>
              </div>
            </div>

            {/* Fix instructions */}
            <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-card)", borderRadius: "8px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h4 style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-primary)", display: "flex", gap: "6px", alignItems: "center" }}>
                  <FileCode size={16} style={{ color: "var(--primary)" }} />
                  <span>Suggested Developer Code Fix</span>
                </h4>
                <button 
                  onClick={() => handleCopy(rec.id, rec.code)}
                  className="premium-btn secondary"
                  style={{ padding: "4px 8px", fontSize: "0.75rem", display: "flex", gap: "6px", alignItems: "center" }}
                >
                  {copiedId === rec.id ? <Check size={12} style={{ color: "var(--success)" }} /> : <Copy size={12} />}
                  <span>{copiedId === rec.id ? "Copied" : "Copy Code"}</span>
                </button>
              </div>

              <p style={{ fontSize: "0.8rem", color: "var(--text-body)", marginBottom: "12px", lineHeight: "1.4" }}>
                <strong>Fix Recommendation:</strong> {rec.suggestedFix}
              </p>

              <pre style={{
                background: "var(--bg-app)",
                border: "1px solid var(--border-card)",
                borderRadius: "6px",
                padding: "16px",
                fontFamily: "monospace",
                fontSize: "0.8rem",
                color: "var(--text-primary)",
                overflowX: "auto",
                maxHeight: "180px"
              }}>
                {rec.code}
              </pre>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
