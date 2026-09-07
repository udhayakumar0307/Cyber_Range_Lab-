import React, { useState } from "react";
import { Server, ShieldAlert, ArrowRight, Activity, Terminal, Shield } from "lucide-react";

export default function ApiArchitecture() {
  const [selectedNode, setSelectedNode] = useState(null);

  // Mapped nodes representing enterprise gateway flow
  const nodes = [
    { id: "gateway", label: "Gateway", x: 60, y: 80, type: "normal", glow: "api-node-glow-emerald", status: "Protected", path: "/v1/*" },
    { id: "auth", label: "Auth API", x: 190, y: 80, type: "normal", glow: "api-node-glow-emerald", status: "Protected", path: "/v1/auth/*" },
    { id: "user", label: "User API", x: 320, y: 80, type: "medium", glow: "api-node-glow-amber", status: "Moderate", path: "/v1/user/*" },
    { id: "payment", label: "Payment API", x: 450, y: 130, type: "sensitive", glow: "api-node-glow", status: "CRITICAL", path: "/v1/checkout" },
    { id: "analytics", label: "Analytics API", x: 450, y: 30, type: "normal", glow: "api-node-glow-emerald", status: "Protected", path: "/v1/analytics/*" },
    { id: "thirdparty", label: "3rd-Party APIs", x: 580, y: 80, type: "sensitive", glow: "api-node-glow", status: "CRITICAL", path: "https://stripe.com/*" }
  ];

  // Map links between nodes
  const links = [
    { from: "gateway", to: "auth" },
    { from: "auth", to: "user" },
    { from: "user", to: "payment" },
    { from: "user", to: "analytics" },
    { from: "payment", to: "thirdparty" },
    { from: "analytics", to: "thirdparty" }
  ];

  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="glass-panel" style={{ padding: "20px", position: "relative" }}>
        <h4 style={{ fontSize: "0.85rem", fontWeight: "800", textTransform: "uppercase", color: "var(--text-soft)", marginBottom: "16px" }}>
          Digital Twin - API Attack Surface
        </h4>

        {/* SVG Node Graph */}
        <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
          <svg viewBox="0 0 650 160" className="api-graph-canvas" style={{ minWidth: "600px" }}>
            {/* Draw Links/Paths */}
            {links.map((link, idx) => {
              const fromNode = nodes.find(n => n.id === link.from);
              const toNode = nodes.find(n => n.id === link.to);
              return (
                <line
                  key={idx}
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              );
            })}

            {/* Draw Nodes */}
            {nodes.map(node => (
              <g 
                key={node.id} 
                transform={`translate(${node.x - 20}, ${node.y - 20})`}
                onClick={() => handleNodeClick(node)}
                style={{ cursor: "pointer" }}
              >
                {/* Glow Ring for Critical nodes */}
                <circle
                  cx="20"
                  cy="20"
                  r="18"
                  fill="transparent"
                  stroke={node.type === "sensitive" ? "var(--critical)" : node.type === "medium" ? "var(--warning)" : "var(--success)"}
                  strokeWidth="2"
                  className={node.glow}
                />
                {/* Node Solid Circle */}
                <circle
                  cx="20"
                  cy="20"
                  r="14"
                  fill="#111827"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1"
                />
                {/* Icons inside nodes */}
                <foreignObject x="11" y="11" width="18" height="18">
                  <div style={{ color: node.type === "sensitive" ? "var(--critical)" : node.type === "medium" ? "var(--warning)" : "var(--success)", display: "flex" }}>
                    {node.type === "sensitive" ? <ShieldAlert size={14} style={{ margin: "auto" }} /> : <Server size={14} style={{ margin: "auto" }} />}
                  </div>
                </foreignObject>
                {/* Node text labels */}
                <text
                  x="20"
                  y="46"
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  style={{ fontSize: "10px", fontWeight: "600" }}
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Selected Node Details Bar */}
      {selectedNode && (
        <div 
          className="glass-panel" 
          style={{ 
            padding: "16px 20px", 
            borderLeft: `4px solid ${selectedNode.type === "sensitive" ? "var(--critical)" : selectedNode.type === "medium" ? "var(--warning)" : "var(--success)"}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <div style={{ color: selectedNode.type === "sensitive" ? "var(--critical)" : "var(--warning)" }}>
              <Activity size={20} className={selectedNode.type === "sensitive" ? "animate-pulse" : ""} />
            </div>
            <div>
              <p style={{ fontWeight: "700", color: "var(--text-primary)", fontSize: "0.92rem" }}>
                {selectedNode.label} Topology Details
              </p>
              <p style={{ fontSize: "0.78rem", color: "var(--text-soft)" }}>
                Mapped Route: <code style={{ color: "var(--primary)" }}>{selectedNode.path}</code> | Status: <strong>{selectedNode.status}</strong>
              </p>
            </div>
          </div>
          <div>
            {selectedNode.type === "sensitive" ? (
              <span className="severity-badge critical" style={{ fontSize: "0.75rem" }}>
                PII Leak Potential (High Vector)
              </span>
            ) : (
              <span className="severity-badge low" style={{ fontSize: "0.75rem" }}>
                Secure payload filter
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
