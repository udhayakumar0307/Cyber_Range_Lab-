import React, { useState } from "react";
import { Sparkles, Brain, Cpu, Send, ShieldAlert, ArrowRight, ShieldCheck } from "lucide-react";
import { usePrivacySoc } from "../context/PrivacySocContext.jsx";

export default function AiAssistantPage() {
  const { readinessScores } = usePrivacySoc();
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "assistant",
      text: "Welcome to the SentinelAI Full-Scale Assistant. I've parsed your active API endpoint metrics and compliance rule weight mappings. Ask me anything about mitigating risks or generating reports.",
    }
  ]);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const suggestedPrompts = [
    "Explain notice coverage gap and how to fix it",
    "Generate code snippet for encrypted billing endpoints",
    "Tell me about Sec. 9 compliance issues"
  ];

  const handleSend = (text) => {
    if (!text.trim()) return;

    setMessages(prev => [...prev, { id: Date.now(), sender: "user", text }]);
    setInputVal("");
    setIsTyping(true);

    setTimeout(() => {
      let reply = "";
      const query = text.toLowerCase();

      if (query.includes("notice") || query.includes("fix")) {
        reply = "Notice coverage (Rule 2) stands at 64% in your latest scan. Under Sec. 5 of the DPDP Act, every consent request must be preceded by a clear notice detailing the category of personal data collected and the processing purposes. To fix this, update database rows to map non-null strings to the `purpose` parameter on checkout routes.";
      } else if (query.includes("code") || query.includes("encrypt")) {
        reply = "Here is a Node.js Express middleware control to apply AES-256-GCM encryption on incoming payment payloads before DB writes:\n\n```js\nconst crypto = require('crypto');\nfunction encryptField(val, key) {\n  const iv = crypto.randomBytes(12);\n  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);\n  let enc = cipher.update(val, 'utf8', 'hex');\n  enc += cipher.final('hex');\n  return { enc, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex') };\n}\n```";
      } else if (query.includes("sec. 9") || query.includes("child")) {
        reply = "Under Sec. 9 of the DPDP Act, processing data of minors requires verifiable parental/guardian consent. We discovered that your `consent_records` has minor categories but zero guardian validation IDs are mapped. Implement a dual-auth parent OTP sign-off during checkout flows to resolve this critical gap.";
      } else {
        reply = "I suggest generating the DPDP Act Readiness Report in the Reports tab. This maps your exact database schema parameters to sections 5, 6, 8, 9, 12 and 13.";
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, sender: "assistant", text: reply }]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow" style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            <Brain size={12} /> DPDP Cognitive Audits
          </span>
          <h1 className="page-title">Notion AI Assistant console</h1>
          <p className="page-subtitle">Interact with Sentinel AI to query database schemas, compliance gaps, and code remediation steps.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px" }}>
        {/* Chat Console Panel */}
        <div className="glass-panel" style={{ padding: "24px", height: "550px", display: "flex", flexDirection: "column", justify: "space-between" }}>
          {/* Messages list */}
          <div style={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingRight: "10px" }}>
            {messages.map(msg => (
              <div 
                key={msg.id} 
                style={{ 
                  alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background: msg.sender === "user" ? "var(--primary)" : "rgba(255,255,255,0.03)",
                  border: msg.sender === "user" ? "none" : "1px solid var(--border-card)",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  color: msg.sender === "user" ? "var(--primary-contrast)" : "var(--text-body)"
                }}
              >
                <p style={{ fontSize: "0.9rem", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>{msg.text}</p>
              </div>
            ))}

            {isTyping && (
              <div style={{ alignSelf: "flex-start", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-card)", borderRadius: "12px", padding: "12px 18px", color: "var(--text-soft)", fontSize: "0.85rem" }}>
                Sentinel AI is compiling response...
              </div>
            )}
          </div>

          {/* Footer Input */}
          <div style={{ borderTop: "1px solid var(--border-card)", paddingTop: "16px", marginTop: "16px" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder="Ask about compliance scores, endpoints, schema fixes..."
                style={{
                  flexGrow: 1,
                  height: "44px",
                  padding: "0 16px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border-card)",
                  borderRadius: "8px",
                  color: "var(--text-primary)",
                  outline: "none",
                  fontSize: "0.9rem"
                }}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend(inputVal)}
              />
              <button 
                onClick={() => handleSend(inputVal)} 
                className="premium-btn primary"
                style={{ height: "44px", width: "44px", padding: 0, justifyContent: "center" }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Info Column: Suggested Queries & Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Prompt Suggestion Panel */}
          <div className="glass-panel" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "var(--text-primary)", marginBottom: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
              <Cpu size={16} style={{ color: "var(--primary)" }} />
              <span>Suggested Audits</span>
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-card)",
                    borderRadius: "8px",
                    padding: "12px",
                    color: "var(--text-body)",
                    fontSize: "0.82rem",
                    textAlign: "left",
                    cursor: "pointer",
                    lineHeight: "1.4",
                    transition: "all 0.15s"
                  }}
                  onMouseEnter={(e) => { e.target.style.borderColor = "var(--primary)"; e.target.style.background = "rgba(99,102,241,0.03)"; }}
                  onMouseLeave={(e) => { e.target.style.borderColor = "var(--border-card)"; e.target.style.background = "rgba(255,255,255,0.02)"; }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Stats Context Card */}
          <div className="glass-panel" style={{ padding: "24px", background: "radial-gradient(circle at 100% 0%, rgba(99,102,241,0.1) 0%, rgba(17,24,37,0.6) 80%)" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "var(--text-primary)", marginBottom: "12px" }}>
              SOC Compliance Context
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justify: "space-between" }}>
                <span style={{ color: "var(--text-soft)" }}>Current Score</span>
                <strong style={{ color: "var(--text-primary)" }}>{readinessScores.dpdp}%</strong>
              </div>
              <div style={{ display: "flex", justify: "space-between" }}>
                <span style={{ color: "var(--text-soft)" }}>Audited Tables</span>
                <strong style={{ color: "var(--text-primary)" }}>consent_records</strong>
              </div>
              <div style={{ display: "flex", justify: "space-between" }}>
                <span style={{ color: "var(--text-soft)" }}>Identity Vaults</span>
                <strong style={{ color: "var(--text-primary)" }}>Unencrypted Aadhaar</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
