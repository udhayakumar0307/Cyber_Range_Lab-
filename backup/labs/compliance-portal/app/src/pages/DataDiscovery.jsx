import React, { useState, useMemo } from "react";
import { Search, Eye, Filter, AlertTriangle, CheckCircle, Database, HelpCircle, ChevronRight, X, ArrowRight, ShieldCheck, Key } from "lucide-react";
import { usePrivacySoc } from "../context/PrivacySocContext.jsx";
import { getPiiInventoryForApiKey } from "../../data/piiInventory.js";

export default function DataDiscovery() {
  const { activeApiKey } = usePrivacySoc();

  // Load PII Inventory based on active key
  const piiInventory = useMemo(() => {
    return getPiiInventoryForApiKey(activeApiKey);
  }, [activeApiKey]);

  // Combine into visual discovery items
  const discoveryItems = useMemo(() => {
    return piiInventory.map((item, idx) => {
      // Create endpoints & statuses
      let path = "/api/v1/user/profile";
      let status = "Compliant";
      let risk = item.sensitivity;
      
      if (item.field === "name") {
        path = "/api/v1/user/profile";
        status = "Compliant";
      } else if (item.field === "email") {
        path = "/api/v1/user/profile";
        status = item.protection ? "Compliant" : "Non-Compliant";
      } else if (item.field === "phone") {
        path = "/api/v1/user/profile";
        status = item.protection ? "Compliant" : "Non-Compliant";
      } else if (item.field === "address") {
        path = "/api/v1/checkout";
        status = item.protection ? "Compliant" : "Non-Compliant";
      } else if (item.field === "user_id") {
        path = "/api/v1/analytics/track";
        status = "Compliant";
      }

      return {
        id: idx,
        source: item.source || "Consent API",
        path,
        field: `payload.${item.field}`,
        pii: item.label,
        classification: item.category,
        risk,
        status,
        protection: item.protection || "None",
        retention: item.retention,
        purposes: item.purposes,
        owner: item.owner
      };
    });
  }, [piiInventory]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRisk, setSelectedRisk] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedItem, setSelectedItem] = useState(null); // Side drawer drill-down

  const filteredItems = useMemo(() => {
    return discoveryItems.filter(item => {
      const matchesSearch = 
        item.pii.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.field.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRisk = selectedRisk === "All" || item.risk === selectedRisk;
      const matchesStatus = selectedStatus === "All" || item.status === selectedStatus;

      return matchesSearch && matchesRisk && matchesStatus;
    });
  }, [discoveryItems, searchTerm, selectedRisk, selectedStatus]);

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow" style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            <Search size={12} /> Privacy Catalogs
          </span>
          <h1 className="page-title">Personal Data Discovery Catalog</h1>
          <p className="page-subtitle">Track and query personal data discovered across all active database schemas and connected API routers.</p>
        </div>
      </div>

      {/* Filter Row */}
      <div className="glass-panel" style={{ padding: "16px", marginTop: "24px", display: "flex", gap: "16px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexGrow: 1, maxWidth: "500px" }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "12px", color: "var(--text-soft)" }} />
            <input 
              type="text" 
              placeholder="Filter by API path, field parameter, or PII type..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                height: "38px",
                paddingLeft: "36px",
                paddingRight: "16px",
                background: "var(--bg-app)",
                border: "1px solid var(--border-card)",
                borderRadius: "6px",
                color: "var(--text-primary)",
                outline: "none",
                fontSize: "0.85rem"
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>Risk:</span>
            <select 
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              style={{ background: "var(--bg-app)", color: "var(--text-primary)", border: "1px solid var(--border-card)", borderRadius: "6px", padding: "6px 12px", fontSize: "0.8rem" }}
            >
              <option value="All">All Risks</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>Status:</span>
            <select 
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ background: "var(--bg-app)", color: "var(--text-primary)", border: "1px solid var(--border-card)", borderRadius: "6px", padding: "6px 12px", fontSize: "0.8rem" }}
            >
              <option value="All">All Statuses</option>
              <option value="Compliant">Compliant</option>
              <option value="Non-Compliant">Non-Compliant</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid Directory List */}
      <div className="glass-panel" style={{ marginTop: "20px", overflow: "hidden" }}>
        <div className="table-responsive">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Connected API</th>
                <th>Discovered Field</th>
                <th>Detected PII</th>
                <th>Classification</th>
                <th>Risk Level</th>
                <th>Status</th>
                <th style={{ width: "60px" }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", padding: "40px", color: "var(--text-soft)" }}>
                    No discovered data fields match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr 
                    key={item.id} 
                    onClick={() => setSelectedItem(item)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <Database size={14} style={{ color: "var(--primary)" }} />
                        <span>{item.source}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>{item.path}</td>
                    <td style={{ fontFamily: "monospace", color: "var(--text-soft)", fontSize: "0.8rem" }}>{item.field}</td>
                    <td style={{ fontWeight: "600", color: "var(--text-primary)" }}>{item.pii}</td>
                    <td><span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{item.classification}</span></td>
                    <td>
                      <span className={`severity-badge ${item.risk.toLowerCase()}`}>
                        {item.risk}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", color: item.status === "Compliant" ? "var(--success)" : "var(--critical)", fontSize: "0.8rem", fontWeight: "600" }}>
                        {item.status === "Compliant" ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                        <span>{item.status}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <ChevronRight size={16} style={{ color: "var(--text-soft)" }} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Drawer Drill Down Panel */}
      {selectedItem && (
        <div style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "420px",
          height: "100vh",
          background: "var(--bg-card)",
          borderLeft: "1px solid var(--border-card)",
          boxShadow: "-10px 0 30px rgba(0,0,0,0.3)",
          zIndex: 1000,
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          gap: "24px"
        }} className="animate-fade">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "700", color: "var(--text-primary)" }}>Field Details</h3>
            <button 
              onClick={() => setSelectedItem(null)} 
              style={{ background: "transparent", border: "none", color: "var(--text-soft)", cursor: "pointer" }}
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", borderBottom: "1px solid var(--border-card)", paddingBottom: "20px" }}>
            <div>
              <p style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: "700", color: "var(--text-soft)" }}>Field Name</p>
              <p style={{ fontFamily: "monospace", fontSize: "0.95rem", color: "var(--text-primary)", fontWeight: "600", marginTop: "4px" }}>
                {selectedItem.field}
              </p>
            </div>
            <div>
              <p style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: "700", color: "var(--text-soft)" }}>Parent API Path</p>
              <p style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "var(--text-primary)", marginTop: "4px" }}>
                {selectedItem.path}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Classification</span>
              <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-primary)" }}>{selectedItem.classification}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Data Owner Team</span>
              <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-primary)" }}>{selectedItem.owner}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Retention Period</span>
              <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-primary)" }}>{selectedItem.retention}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Encryption Protection</span>
              <span style={{ fontSize: "0.85rem", fontWeight: "600", color: selectedItem.protection === "None" ? "var(--critical)" : "var(--success)" }}>
                {selectedItem.protection}
              </span>
            </div>
          </div>

          <div>
            <p style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: "700", color: "var(--text-soft)", marginBottom: "8px" }}>
              Authorized Purposes ({selectedItem.purposes.length})
            </p>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {selectedItem.purposes.map((p, idx) => (
                <span key={idx} style={{ fontSize: "0.75rem", background: "var(--primary-glow)", color: "var(--text-primary)", padding: "4px 10px", borderRadius: "12px", border: "1px solid var(--border-card)" }}>
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "auto", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-card)", borderRadius: "8px", padding: "16px" }}>
            <h4 style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-primary)", display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
              <Key size={14} style={{ color: "var(--primary)" }} />
              <span>Remediation Advice</span>
            </h4>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: "1.4" }}>
              {selectedItem.status === "Compliant" 
                ? "This data item matches the mapped consent records and security safeguards are active."
                : "Missing encryption. Inject AES field middleware to secure this attribute before database write."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
