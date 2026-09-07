import React, { useEffect, useState } from "react";
import PageContainer from "../layout/PageContainer";
import { getIntegrationData, verifyConnection, disconnectStore, clearSyncHistory, deleteSyncHistory } from "../services/integrationService";
import { API_BASE_URL } from "../config/appConfig";
import { useToast } from "../context/ToastContext";
import { usePrivacySoc } from "../context/PrivacySocContext";
import { 
  Check, 
  Clipboard, 
  RefreshCw, 
  AlertTriangle, 
  ShieldCheck, 
  Cpu, 
  Code, 
  Server, 
  Database, 
  GitMerge, 
  Layers, 
  Key, 
  Link2, 
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Trash2,
  Clock
} from "lucide-react";
import StatusBadge from "../components/common/StatusBadge";

export default function IntegrationPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Tab selector: "overview", "protocols", "catalog", "flow"
  const [activeTab, setActiveTab] = useState("overview");
  
  // Selected sub-protocol spec: "ingest" or "query"
  const [activeProtocol, setActiveProtocol] = useState("ingest");

  const { addToast } = useToast();
  const { checkStatusAndLoad: refreshGlobalStatus } = usePrivacySoc();

  const [formData, setFormData] = useState({
    store_name: "",
    store_url: "",
    platform: "Custom REST",
    api_key: "",
    secret: "•••••••••••••••••••••",
    sector: ""
  });
  const [sectors, setSectors] = useState([]);

  // Sync history persisted to localStorage so it survives page reloads
  const [syncHistory, setSyncHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("integration_sync_history");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [selectedSyncTimes, setSelectedSyncTimes] = useState(new Set());
  const [isSyncDeleteMode, setIsSyncDeleteMode] = useState(false);

  const connectionSteps = [
    "Verifying Credentials...",
    "Connecting to Store...",
    "Retrieve Store Information...",
    "Validate API Access...",
    "Registering Webhooks...",
    "Starting Initial Synchronization...",
    "Running Privacy Analysis...",
    "Generating Dashboard Summary...",
    "Cache Dashboard..."
  ];

  useEffect(() => {
    fetchData();
    fetch(`${API_BASE_URL}/integration/sectors`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setSectors)
      .catch(() => setSectors([]));
  }, []);

  const fetchData = () => {
    getIntegrationData()
      .then((res) => {
        setData(res);
        if (res) {
          setFormData({
            store_name: res.storeName || "",
            store_url: res.storeUrl || "",
            platform: res.platform || "Custom REST",
            api_key: res.apiKeyMasked || "",
            secret: "•••••••••••••••••••••",
            sector: res.sector || ""
          });
          // Merge new backend history into persisted history (avoid duplicates)
          if (res.history && res.history.length > 0) {
            setSyncHistory(prev => {
              const existingTimestamps = new Set(prev.map(h => h.timestamp));
              const newEntries = res.history.filter(h => !existingTimestamps.has(h.timestamp));
              const merged = [...newEntries, ...prev].slice(0, 50); // keep latest 50
              try { localStorage.setItem("integration_sync_history", JSON.stringify(merged)); } catch {}
              return merged;
            });
          }
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleConnect = async (e) => {
    if (e) e.preventDefault();
    setIsConnecting(true);
    setCurrentStep(0);

    // Step through while the request is genuinely in flight, rather than
    // running a fixed animation before it starts. The connect call reads the
    // company's route and analyses it, so it finishes in well under a second
    // for a healthy source — the old fixed sequence added nearly three seconds
    // to every attempt and reported nothing about what was actually happening.
    let step = 0;
    const ticker = setInterval(() => {
      step = Math.min(step + 1, connectionSteps.length - 1);
      setCurrentStep(step);
    }, 220);

    try {
      const response = await verifyConnection(formData);
      addToast(response.message || "Platform connected.", "success");
      if (response.sectorInferred && response.inferenceReason) {
        addToast(`Sector set to ${response.sectorLabel}. ${response.inferenceReason}`, "info");
      }
      fetchData();
      // Immediately refresh the global status so the Dashboard/Overview
      // transitions out of "No Platform Connected" without waiting for the
      // 15-second polling cycle.
      refreshGlobalStatus();
    } catch (error) {
      // Show what actually went wrong. Reporting every failure as a timeout
      // hid genuine causes — a wrong key, an unreachable host, a 401 — behind
      // a message that pointed at the network.
      addToast(error.message || "Could not connect to the platform.", "error");
    } finally {
      clearInterval(ticker);
      setIsConnecting(false);
    }
  };

  const handleVerify = async () => {
    try {
      const res = await verifyConnection(formData);
      addToast(res.message || "Platform is reachable.", "success");
      fetchData();
    } catch (error) {
      addToast(error.message || "Verification failed.", "error");
    }
  };

  const handleDisconnect = async () => {
    const target = data?.sectorLabel || data?.storeName || "this platform";
    if (!window.confirm(`Disconnect ${target}? It will no longer be read or analysed.`)) return;
    try {
      const result = await disconnectStore(data?.sector || formData.sector);
      addToast(result.message || "Platform disconnected.", "success");
      if (result.returnsOnRestart) {
        addToast(
          "This platform is set in the deployment environment, so it will be registered again on restart. Remove its CONSENT_SOURCE_* variable to drop it permanently.",
          "info"
        );
      }
      setFormData({
        store_name: "", store_url: "", platform: "Custom REST",
        api_key: "", secret: "•••••••••••••••••••••", sector: ""
      });
      fetchData();
    } catch (error) {
      addToast(error.message || "Could not disconnect the platform.", "error");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    addToast("Copied specification to clipboard!", "success");
  };

  const handleClearSyncHistory = async () => {
    if (!window.confirm("Clear all recent synchronization records?")) return;
    try {
      await clearSyncHistory();
      setSyncHistory([]);
      setSelectedSyncTimes(new Set());
      setIsSyncDeleteMode(false);
      localStorage.removeItem("integration_sync_history");
      addToast("Synchronization history cleared.", "info");
    } catch (error) {
      addToast(error.message || "Failed to clear synchronization history.", "error");
    }
  };

  const toggleSelectSync = (timestamp) => {
    setSelectedSyncTimes(prev => {
      const next = new Set(prev);
      if (next.has(timestamp)) {
        next.delete(timestamp);
      } else {
        next.add(timestamp);
      }
      return next;
    });
  };

  const handleDeleteIndividualSync = async (timestamp) => {
    try {
      await deleteSyncHistory([timestamp]);
      setSyncHistory(prev => prev.filter(item => item.timestamp !== timestamp));
      setSelectedSyncTimes(prev => {
        const next = new Set(prev);
        next.delete(timestamp);
        return next;
      });
      addToast("Synchronization log entry deleted.", "success");
    } catch (error) {
      addToast(error.message || "Failed to delete log entry.", "error");
    }
  };

  const handleDeleteSelectedSyncs = async () => {
    if (selectedSyncTimes.size === 0) return;
    if (!window.confirm(`Delete the ${selectedSyncTimes.size} selected sync history record(s)?`)) return;
    try {
      const timestamps = Array.from(selectedSyncTimes);
      await deleteSyncHistory(timestamps);
      setSyncHistory(prev => prev.filter(item => !selectedSyncTimes.has(item.timestamp)));
      setSelectedSyncTimes(new Set());
      addToast("Selected synchronization entries deleted.", "success");
    } catch (error) {
      addToast(error.message || "Failed to delete selected log entries.", "error");
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="Platform Integration" subtitle="Loading integration details..." breadcrumbs={["Integration"]}>
        <div className="skeleton-table animate-pulse" style={{ height: "400px" }}></div>
      </PageContainer>
    );
  }

  const isConnected = data && data.connectionStatus === "Connected";

  // API Ingestion specs
  const ingestSpec = {
    method: "POST",
    path: "/api/v1/ingest/pii",
    description: "Streams aggregated customer records containing PII for classification, scanning, and privacy indexing.",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "your_secure_api_key"
    },
    requestBody: JSON.stringify({
      records: [
        {
          id: "cust_98231",
          email: "principal@gmail.com",
          name: "Amit Patel",
          phone: "+91 98765 43210",
          address: "12, MG Road, Bangalore",
          consents: {
            marketing: true,
            analytics: false,
            timestamp: "2026-08-07T12:00:00Z"
          }
        }
      ]
    }, null, 2),
    responseBody: JSON.stringify({
      success: true,
      processedCount: 1,
      piiFieldsDetected: ["email", "name", "phone", "address"],
      complianceRiskLevel: "High"
    }, null, 2)
  };

  // API Query specs
  const querySpec = {
    method: "GET",
    path: "/api/v1/query/pii/{id}",
    description: "Retrieves the classification posture, current masking preferences, and compliance flags for a specific data principal.",
    headers: {
      "Authorization": "Bearer your_bearer_token"
    },
    parameters: [
      { name: "id", in: "path", required: true, type: "string", description: "The unique customer or user ID (e.g. cust_98231)" }
    ],
    responseBody: JSON.stringify({
      userId: "cust_98231",
      piiCatalog: {
        email: { category: "Contact Info", recommendation: "Hash", activeOverride: "None" },
        phone: { category: "Contact Info", recommendation: "Mask", activeOverride: "Exclude" }
      },
      lastAnalyzed: "2026-08-07T07:25:13Z"
    }, null, 2)
  };

  return (
    <PageContainer
      title="Platform Integration & API Hub"
      subtitle="Expose standard API ingestion endpoints, query individual customer postures on-demand, and manage external adapters."
      breadcrumbs={["Integration"]}
    >
      {/* Tab Selectors */}
      <div className="module-tabs" style={{ marginBottom: "24px" }}>
        <button 
          onClick={() => setActiveTab("overview")} 
          className={`module-tab ${activeTab === "overview" ? "active" : ""}`}
        >
          <Server size={15} />
          <span>Connection Setup</span>
        </button>
        <button 
          onClick={() => setActiveTab("protocols")} 
          className={`module-tab ${activeTab === "protocols" ? "active" : ""}`}
        >
          <Code size={15} />
          <span>API Protocols</span>
        </button>
        <button 
          onClick={() => setActiveTab("catalog")} 
          className={`module-tab ${activeTab === "catalog" ? "active" : ""}`}
        >
          <Layers size={15} />
          <span>Integration Catalog</span>
        </button>
        <button 
          onClick={() => setActiveTab("flow")} 
          className={`module-tab ${activeTab === "flow" ? "active" : ""}`}
        >
          <GitMerge size={15} />
          <span>Data Flows</span>
        </button>
      </div>

      {/* 1. Overview Tab */}
      {activeTab === "overview" && (
        <div className="dashboard-layout-row">
          <div className="dashboard-left-col">
            <div className="section-card">
              <h3 className="section-card-title">Configure Platform Connection</h3>
              
              {isConnecting ? (
                <div className="connection-progress-container" style={{ padding: "20px 0" }}>
                  <div className="flex-row items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-slate-700">Connecting platform...</span>
                    <span className="text-xs text-slate-500">{Math.round(((currentStep + 1) / connectionSteps.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mb-6 overflow-hidden">
                    <div 
                      className="bg-green-600 h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${((currentStep + 1) / connectionSteps.length) * 100}%` }}
                    ></div>
                  </div>
                  <ul className="connection-steps-list">
                    {connectionSteps.map((step, idx) => (
                      <li 
                        key={idx} 
                        className={`step-item ${idx === currentStep ? "active" : idx < currentStep ? "completed" : "pending"}`}
                        style={{ padding: "6px 0", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}
                      >
                        {idx < currentStep ? <Check size={14} className="text-green-600" /> : <div className="step-bullet" />}
                        <span className={idx === currentStep ? "font-medium text-slate-800" : "text-slate-500"}>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <form onSubmit={handleConnect} className="integration-form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="input-group">
                    <label>Platform Name</label>
                    <input 
                      type="text" 
                      name="store_name"
                      value={formData.store_name} 
                      onChange={handleInputChange}
                      placeholder="e.g. My Custom E-Commerce"
                      required 
                    />
                  </div>
                  <div className="input-group">
                    <label>Platform Type</label>
                    <select 
                      name="platform"
                      value={formData.platform} 
                      onChange={handleInputChange}
                    >
                      <option value="Custom REST">Custom REST / Generic REST API</option>
                      <option value="EverShop">EverShop REST API</option>
                      <option value="Shopify">Shopify Adapter</option>
                      <option value="WooCommerce">WooCommerce Adapter</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Business Sector</label>
                    <select
                      name="sector"
                      value={formData.sector}
                      onChange={handleInputChange}
                    >
                      <option value="">Detect automatically from the data</option>
                      {sectors.map((entry) => (
                        <option key={entry.sector} value={entry.sector}>{entry.label}</option>
                      ))}
                    </select>
                    <small style={{ display: "block", marginTop: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                      {formData.sector
                        ? sectors.find((entry) => entry.sector === formData.sector)?.regulator
                          ? `Applies the ${sectors.find((entry) => entry.sector === formData.sector).regulator} overlay to PII risk scoring.`
                          : "Applies this sector's rules to PII risk scoring."
                        : "The sector is detected from the identifiers found in the data, and decides which regulator's rules apply."}
                    </small>
                  </div>
                  <div className="input-group">
                    <label>Platform Base URL</label>
                    <input 
                      type="url" 
                      name="store_url"
                      value={formData.store_url} 
                      onChange={handleInputChange}
                      placeholder="e.g. http://localhost:8088"
                      required 
                    />
                  </div>
                  <div className="input-group">
                    <label>REST API Key</label>
                    <input 
                      type="text" 
                      name="api_key"
                      value={formData.api_key} 
                      onChange={handleInputChange}
                      placeholder="e.g. api_key_here"
                      required 
                    />
                  </div>
                  <div className="input-group">
                    <label>API Secret / Token</label>
                    <input 
                      type="password" 
                      name="secret"
                      value={formData.secret} 
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="integration-actions-row" style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                      {isConnected ? "Update Settings" : "Connect Platform"}
                    </button>
                    {isConnected && (
                      <>
                        <button type="button" onClick={handleVerify} className="btn-secondary">
                          Verify API
                        </button>
                        <button type="button" onClick={handleDisconnect} className="btn-danger-outline">
                          Disconnect
                        </button>
                      </>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="dashboard-right-col">
            <div className="section-card">
              {/* Header with LIVE badge + Action buttons */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h3 className="section-card-title" style={{ margin: 0 }}>Recent Synchronization</h3>
                  {isConnected && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "10px", fontWeight: "700", color: "var(--success)", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", padding: "2px 8px", borderRadius: "100px" }}>
                      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--success)", animation: "pulse 1.5s infinite" }} />
                      LIVE
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    onClick={() => {
                      setIsSyncDeleteMode(!isSyncDeleteMode);
                      if (!isSyncDeleteMode) {
                        setSelectedSyncTimes(new Set());
                      }
                    }}
                    style={{ background: "transparent", border: "1px solid var(--border-card)", color: isSyncDeleteMode ? "var(--critical)" : "var(--text-soft)", borderRadius: "6px", padding: "4px 12px", fontSize: "11px", fontWeight: "600", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    <Trash2 size={12} />
                    {isSyncDeleteMode ? "Cancel" : "Select"}
                  </button>
                  {isSyncDeleteMode && selectedSyncTimes.size > 0 && (
                    <button
                      onClick={handleDeleteSelectedSyncs}
                      className="btn-danger-outline btn-sm"
                      style={{ fontSize: "11px", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <Trash2 size={12} />
                      Delete Selected ({selectedSyncTimes.size})
                    </button>
                  )}
                  {syncHistory.length > 0 && (
                    <button
                      onClick={handleClearSyncHistory}
                      style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "var(--critical)", borderRadius: "6px", padding: "4px 12px", fontSize: "11px", fontWeight: "600", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}
                    >
                      <Trash2 size={12} />
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="sync-history-timeline">
                {syncHistory.length > 0 ? (
                  syncHistory.map((item, index) => {
                    const isChecked = selectedSyncTimes.has(item.timestamp);
                    return (
                      <div key={index} className="sync-history-item" style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "12px",
                        borderRadius: "8px",
                        background: isChecked ? "rgba(239,68,68,0.015)" : "transparent",
                        borderBottom: "1px solid var(--border-card)",
                        position: "relative"
                      }}>
                        {isSyncDeleteMode && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectSync(item.timestamp)}
                            style={{ cursor: "pointer", marginTop: "4px" }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div className="sync-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span className="sync-time" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <Clock size={11} style={{ opacity: 0.6 }} />
                              {item.timestamp ? new Date(item.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Just now"}
                            </span>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <StatusBadge status={item.status || "Success"} />
                              {isSyncDeleteMode && (
                                <button
                                  onClick={() => handleDeleteIndividualSync(item.timestamp)}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "var(--text-muted)",
                                    cursor: "pointer",
                                    padding: "2px",
                                    display: "inline-flex",
                                    alignItems: "center"
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--critical)"}
                                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="sync-event" style={{ margin: "6px 0 0 0" }}>{item.event}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-muted" style={{ padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                    <RefreshCw size={28} style={{ opacity: 0.2 }} />
                    <span style={{ fontSize: "13px" }}>No synchronization runs performed yet.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. API Protocols Tab */}
      {activeTab === "protocols" && (
        <div className="section-card animate-fade-in" style={{ padding: "24px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
          <div style={{ borderBottom: "1px solid var(--border-card)", paddingBottom: "16px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--text-primary)" }}>Integration Protocol & Endpoints Specs</h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>Developer-ready OpenAPI compliant schema configurations.</p>
            </div>
            
            {/* Protocol Switcher */}
            <div style={{ display: "flex", background: "var(--bg-app)", padding: "4px", borderRadius: "8px", border: "1px solid var(--border-card)" }}>
              <button 
                onClick={() => setActiveProtocol("ingest")} 
                style={{ border: "none", background: activeProtocol === "ingest" ? "var(--bg-card)" : "transparent", color: activeProtocol === "ingest" ? "var(--text-primary)" : "var(--text-muted)", padding: "6px 12px", fontSize: "12px", fontWeight: "600", borderRadius: "6px", cursor: "pointer" }}
              >
                1. Ingestion API
              </button>
              <button 
                onClick={() => setActiveProtocol("query")} 
                style={{ border: "none", background: activeProtocol === "query" ? "var(--bg-card)" : "transparent", color: activeProtocol === "query" ? "var(--text-primary)" : "var(--text-muted)", padding: "6px 12px", fontSize: "12px", fontWeight: "600", borderRadius: "6px", cursor: "pointer" }}
              >
                2. Query API
              </button>
            </div>
          </div>

          {activeProtocol === "ingest" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", flexWrap: "wrap" }}>
              {/* Left detail */}
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(16,185,129,0.1)", color: "var(--success)", fontWeight: "700", fontSize: "12px", padding: "4px 8px", borderRadius: "4px", marginBottom: "12px" }}>
                  <span>{ingestSpec.method}</span>
                </div>
                <strong style={{ fontSize: "15px", display: "block", color: "var(--text-primary)", fontFamily: "monospace" }}>{ingestSpec.path}</strong>
                <p style={{ fontSize: "13px", color: "var(--text-body)", marginTop: "8px", lineHeight: "1.6" }}>{ingestSpec.description}</p>
                
                <h4 style={{ fontSize: "12px", textTransform: "uppercase", color: "var(--text-muted)", marginTop: "20px", marginBottom: "8px" }}>Required Headers</h4>
                <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                  <tbody>
                    {Object.entries(ingestSpec.headers).map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: "1px solid var(--border-card)" }}>
                        <td style={{ padding: "8px 0", fontFamily: "monospace", fontWeight: "600", color: "var(--text-primary)" }}>{k}</td>
                        <td style={{ padding: "8px 0", fontFamily: "monospace", color: "var(--text-muted)" }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Right payload blocks */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)" }}>REQUEST BODY (JSON)</span>
                    <button onClick={() => copyToClipboard(ingestSpec.requestBody)} style={{ border: "none", background: "transparent", color: "var(--info)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px" }}>
                      <Clipboard size={12} /> Copy
                    </button>
                  </div>
                  <pre style={{ margin: 0, padding: "12px", background: "var(--bg-app)", border: "1px solid var(--border-card)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "11px", fontFamily: "monospace", overflowX: "auto" }}>
                    {ingestSpec.requestBody}
                  </pre>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)" }}>RESPONSE BODY (JSON)</span>
                    <button onClick={() => copyToClipboard(ingestSpec.responseBody)} style={{ border: "none", background: "transparent", color: "var(--info)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px" }}>
                      <Clipboard size={12} /> Copy
                    </button>
                  </div>
                  <pre style={{ margin: 0, padding: "12px", background: "var(--bg-app)", border: "1px solid var(--border-card)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "11px", fontFamily: "monospace", overflowX: "auto" }}>
                    {ingestSpec.responseBody}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", flexWrap: "wrap" }}>
              {/* Left detail */}
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(37,99,235,0.1)", color: "var(--info)", fontWeight: "700", fontSize: "12px", padding: "4px 8px", borderRadius: "4px", marginBottom: "12px" }}>
                  <span>{querySpec.method}</span>
                </div>
                <strong style={{ fontSize: "15px", display: "block", color: "var(--text-primary)", fontFamily: "monospace" }}>{querySpec.path}</strong>
                <p style={{ fontSize: "13px", color: "var(--text-body)", marginTop: "8px", lineHeight: "1.6" }}>{querySpec.description}</p>
                
                <h4 style={{ fontSize: "12px", textTransform: "uppercase", color: "var(--text-muted)", marginTop: "20px", marginBottom: "8px" }}>Path Parameters</h4>
                <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-card)", textAlign: "left", color: "var(--text-muted)" }}>
                      <th style={{ padding: "6px 0" }}>Name</th>
                      <th style={{ padding: "6px 0" }}>Type</th>
                      <th style={{ padding: "6px 0" }}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {querySpec.parameters.map((p) => (
                      <tr key={p.name} style={{ borderBottom: "1px solid var(--border-card)" }}>
                        <td style={{ padding: "8px 0", fontFamily: "monospace", fontWeight: "600", color: "var(--text-primary)" }}>{p.name}</td>
                        <td style={{ padding: "8px 0", color: "var(--text-body)" }}>{p.type}</td>
                        <td style={{ padding: "8px 0", color: "var(--text-muted)" }}>{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Right payload block */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)" }}>RESPONSE BODY (JSON)</span>
                  <button onClick={() => copyToClipboard(querySpec.responseBody)} style={{ border: "none", background: "transparent", color: "var(--info)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px" }}>
                    <Clipboard size={12} /> Copy
                  </button>
                </div>
                <pre style={{ margin: 0, padding: "12px", background: "var(--bg-app)", border: "1px solid var(--border-card)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "11px", fontFamily: "monospace", overflowX: "auto" }}>
                  {querySpec.responseBody}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Integration Catalog Tab */}
      {activeTab === "catalog" && (
        <div className="animate-fade-in" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
          
          {/* EverShop Adapter */}
          <div className="section-card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Server style={{ color: "var(--success)" }} />
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>EverShop API Adapter</h3>
                </div>
                <span style={{ background: "rgba(34,197,94,0.1)", color: "var(--success)", fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "100px" }}>Active</span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.6" }}>
                Standard active adapter linking the main storefront database with our scanner engine. Real-time webhooks dispatch consent and customer entries.
              </p>
              
              <div style={{ marginTop: "16px" }}>
                <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>Mapped API Endpoints:</span>
                <ul style={{ padding: 0, margin: 0, listStyle: "none", fontSize: "12px", color: "var(--text-body)" }}>
                  <li style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}><ChevronRight size={12} /> Ingestion: `POST /api/v1/ingest/pii`</li>
                  <li style={{ display: "flex", alignItems: "center", gap: "6px" }}><ChevronRight size={12} /> {"Query: GET /api/customers/{id}"}</li>
                </ul>
              </div>
            </div>
            <button 
              onClick={() => {
                setActiveTab("overview");
                setFormData(prev => ({ ...prev, platform: "EverShop" }));
              }}
              className="btn-secondary" 
              style={{ width: "100%", marginTop: "20px", fontSize: "12px", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
            >
              <span>Configure Connection</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Salesforce Connector */}
          <div className="section-card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Layers style={{ color: "var(--info)" }} />
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>Salesforce CRM Connector</h3>
                </div>
                <span style={{ background: "rgba(148,163,184,0.1)", color: "var(--text-muted)", fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "100px" }}>Inactive</span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.6" }}>
                Integrates corporate contact directories, active mailing subscriptions, and custom marketing consent logs into the compliance audit dashboard.
              </p>
              
              <div style={{ marginTop: "16px" }}>
                <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>Mapped API Endpoints:</span>
                <ul style={{ padding: 0, margin: 0, listStyle: "none", fontSize: "12px", color: "var(--text-body)" }}>
                  <li style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}><ChevronRight size={12} /> Ingestion: `/services/data/v58.0/Contact`</li>
                  <li style={{ display: "flex", alignItems: "center", gap: "6px" }}><ChevronRight size={12} /> {"Query: /services/data/v58.0/Contact/{id}"}</li>
                </ul>
              </div>
            </div>
            <button 
              onClick={() => {
                setActiveTab("overview");
                setFormData(prev => ({ ...prev, platform: "Custom REST", store_name: "Salesforce CRM" }));
              }}
              className="btn-secondary" 
              style={{ width: "100%", marginTop: "20px", fontSize: "12px", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
            >
              <span>Configure Connection</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Shopify Connector */}
          <div className="section-card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Database style={{ color: "var(--warning)" }} />
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>Shopify Stores Adapter</h3>
                </div>
                <span style={{ background: "rgba(148,163,184,0.1)", color: "var(--text-muted)", fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "100px" }}>Inactive</span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.6" }}>
                Synchronizes retail orders, delivery details, and customer billing address registries. Handles compliance flags during checkout consent checkmarks.
              </p>
              
              <div style={{ marginTop: "16px" }}>
                <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>Mapped API Endpoints:</span>
                <ul style={{ padding: 0, margin: 0, listStyle: "none", fontSize: "12px", color: "var(--text-body)" }}>
                  <li style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}><ChevronRight size={12} /> Ingestion: `/admin/api/2026-07/customers.json`</li>
                  <li style={{ display: "flex", alignItems: "center", gap: "6px" }}><ChevronRight size={12} /> {"Query: /admin/api/2026-07/customers/{id}.json"}</li>
                </ul>
              </div>
            </div>
            <button 
              onClick={() => {
                setActiveTab("overview");
                setFormData(prev => ({ ...prev, platform: "Shopify", store_name: "Shopify Store" }));
              }}
              className="btn-secondary" 
              style={{ width: "100%", marginTop: "20px", fontSize: "12px", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
            >
              <span>Configure Connection</span>
              <ArrowRight size={12} />
            </button>
          </div>

        </div>
      )}

      {/* 4. Data Flow Architectures Tab */}
      {activeTab === "flow" && (
        <div className="section-card animate-fade-in" style={{ padding: "24px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "var(--text-primary)" }}>API Integration & Data Flow Architecture</h3>
          <p style={{ margin: "0 0 24px 0", fontSize: "13px", color: "var(--text-muted)" }}>
            Below are sequence layouts describing how customer transactions ingest data and how the platform queries external adapters to assess privacy.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", flexWrap: "wrap" }}>
            
            {/* Flow 1: Ingestion */}
            <div style={{ background: "var(--bg-app)", border: "1px solid var(--border-card)", borderRadius: "12px", padding: "20px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--success)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <ChevronRight size={16} />
                <span>1. Real-Time Ingestion Architecture</span>
              </h4>
              
              {/* Stylized visual block diagram */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", color: "var(--text-primary)", fontSize: "12px" }}>
                
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", padding: "10px 14px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>External Store (Evershop)</strong>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Source</span>
                </div>
                
                <div style={{ display: "flex", justifyContent: "center", color: "var(--info)" }}>
                  <ArrowRight size={16} style={{ transform: "rotate(90deg)" }} />
                </div>
                
                <div style={{ background: "var(--bg-card)", border: "1px dashed var(--info)", padding: "10px 14px", borderRadius: "8px" }}>
                  <strong style={{ display: "block" }}>Ingestion Protocol</strong>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>`POST /api/v1/ingest/pii`</span>
                  <span style={{ display: "block", fontSize: "10px", color: "var(--info)", marginTop: "4px" }}>Aggregates fields & verifies active consent markers</span>
                </div>

                <div style={{ display: "flex", justifyContent: "center", color: "var(--info)" }}>
                  <ArrowRight size={16} style={{ transform: "rotate(90deg)" }} />
                </div>

                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", padding: "10px 14px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Command Center Database</strong>
                  <span style={{ fontSize: "10px", color: "var(--success)" }}>SQLite / PostgreSQL</span>
                </div>

              </div>
            </div>

            {/* Flow 2: Query */}
            <div style={{ background: "var(--bg-app)", border: "1px solid var(--border-card)", borderRadius: "12px", padding: "20px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--info)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <ChevronRight size={16} />
                <span>2. On-Demand Query Protocol</span>
              </h4>
              
              {/* Stylized visual block diagram */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", color: "var(--text-primary)", fontSize: "12px" }}>
                
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", padding: "10px 14px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Security Officer Dashboard</strong>
                  <span style={{ fontSize: "10px", color: "var(--info)" }}>Initiator</span>
                </div>
                
                <div style={{ display: "flex", justifyContent: "center", color: "var(--info)" }}>
                  <ArrowRight size={16} style={{ transform: "rotate(90deg)" }} />
                </div>
                
                <div style={{ background: "var(--bg-card)", border: "1px dashed var(--info)", padding: "10px 14px", borderRadius: "8px" }}>
                  <strong style={{ display: "block" }}>Query Protocol</strong>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{"GET /api/v1/query/pii/{id}"}</span>
                  <span style={{ display: "block", fontSize: "10px", color: "var(--info)", marginTop: "4px" }}>Fetches live masking config and active overrides</span>
                </div>

                <div style={{ display: "flex", justifyContent: "center", color: "var(--info)" }}>
                  <ArrowRight size={16} style={{ transform: "rotate(90deg)" }} />
                </div>

                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", padding: "10px 14px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>External Platform APIs</strong>
                  <span style={{ fontSize: "10px", color: "var(--warning)" }}>EverShop / Salesforce</span>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

    </PageContainer>
  );
}
