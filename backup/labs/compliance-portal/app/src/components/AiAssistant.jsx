import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Sparkles, Send, X, ShieldAlert, Cpu } from "lucide-react";
import { usePrivacySoc } from "../context/PrivacySocContext.jsx";

export default function AiAssistant() {
  const { readinessScores, dpdpCompliance } = usePrivacySoc();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "assistant",
      text: "Hello! I am Sentinel AI, your automated Privacy Auditor. How can I assist with your DPDP compliance posture today?",
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const suggestedPrompts = [
    "Explain my compliance score",
    "Show risky APIs",
    "How do I improve compliance?",
    "Find exposed Aadhaar data"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (text) => {
    if (!text.trim()) return;

    // User Message
    const userMsg = { id: Date.now(), sender: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    // AI Simulated Response
    setTimeout(() => {
      let replyText = "";
      const textLower = text.toLowerCase();

      if (textLower.includes("score") || textLower.includes("compliance")) {
        replyText = `Your overall DPDP Readiness Score is currently ${readinessScores.dpdp}%. This is calculated based on the 10 compliance weights. Notice coverage and consent management contribute most heavily. We noticed minor guardian consent is at 0%, which is a critical gap.`;
      } else if (textLower.includes("risky") || textLower.includes("api")) {
        replyText = "I found 8 sensitive API endpoints. Specifically, `/api/v1/checkout` and `/api/v1/user/profile` are exposing unencrypted Aadhaar numbers and Credit Card details in plain JSON payloads. I suggest applying AES-256 encryption.";
      } else if (textLower.includes("aadhaar") || textLower.includes("exposed")) {
        replyText = "Aadhaar national identifiers were detected in the `consent_records` table column under the user demographics dataset. 8 accounts contain minor status with no valid guardian signatures mapped. These are flagged as Critical risks.";
      } else {
        replyText = "Based on our latest scan, I recommend encrypting customer Aadhaar/PAN fields, enabling grievance redirection channels, and verifying consent timelines to raise compliance by up to 12%.";
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, sender: "assistant", text: replyText }]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="ai-floating-widget">
      {/* Floating Toggle Button */}
      <button className="ai-floating-btn" onClick={() => setIsOpen(!isOpen)} aria-label="Open AI Assistant">
        {isOpen ? <X size={24} /> : <Sparkles size={24} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="ai-chat-window">
          <div className="ai-chat-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Cpu size={18} style={{ color: "#818cf8" }} />
              <div>
                <p style={{ fontWeight: "700", fontSize: "0.85rem", color: "var(--text-primary)" }}>Sentinel AI Assistant</p>
                <p style={{ fontSize: "0.68rem", color: "var(--text-soft)" }}>DPDP Compliance Expert</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: "transparent", border: "none", color: "var(--text-soft)", cursor: "pointer" }}
            >
              <X size={16} />
            </button>
          </div>

          <div className="ai-chat-body">
            {messages.map(msg => (
              <div key={msg.id} className={`ai-chat-bubble ${msg.sender}`}>
                {msg.text}
              </div>
            ))}
            
            {isTyping && (
              <div className="ai-chat-bubble assistant" style={{ color: "var(--text-soft)" }}>
                Sentinel AI is typing...
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested prompts list */}
          <div 
            style={{
              padding: "8px 12px",
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
              background: "rgba(255,255,255,0.01)",
              borderTop: "1px solid var(--border-card)"
            }}
          >
            {suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                style={{
                  fontSize: "0.72rem",
                  padding: "4px 8px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border-card)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = "var(--primary)";
                  e.target.style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = "var(--border-card)";
                  e.target.style.color = "var(--text-muted)";
                }}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="ai-chat-footer">
            <input
              type="text"
              className="ai-chat-input"
              placeholder="Ask anything about compliance..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend(inputValue)}
            />
            <button 
              onClick={() => handleSend(inputValue)}
              style={{
                background: "var(--primary)",
                border: "none",
                color: "#fff",
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer"
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
