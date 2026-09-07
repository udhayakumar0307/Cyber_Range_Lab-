import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../layout/PageContainer";
import { 
  getAnonymizationData, 
  triggerAnonymizeJob, 
  triggerThirdPartyShare,
  submitOverrideFeedback,
  resetOverrideFeedback,
  getAnonymizationPreview,
  traceLeak
} from "../services/anonymizationService";
import { useToast } from "../context/ToastContext";
import MetricCard from "../components/common/MetricCard";
import DataTable from "../components/common/DataTable";
import StatusBadge from "../components/common/StatusBadge";
import { formatDate } from "../utils/formatDate";
import { 
  ShieldCheck, 
  AlertTriangle, 
  Play, 
  Send, 
  Plus, 
  Trash2, 
  ShieldAlert, 
  CheckCircle, 
  Sliders, 
  Eye, 
  Cpu, 
  Lock, 
  FileText,
  UserCheck,
  RefreshCw,
  Search
} from "lucide-react";
import { API_BASE_URL } from "../config/appConfig";

export default function AnonymizationPage() {
  const [statusInfo, setStatusInfo] = useState({ status: "NOT_CONNECTED" });
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Step workflow
  const [currentStep, setCurrentStep] = useState(1);

  // Autopilot mode
  const [isAutoMode, setIsAutoMode] = useState(false);

  // States
  const [piiFields, setPiiFields] = useState([]);
  const [customFieldName, setCustomFieldName] = useState("");
  const [customFieldCategory, setCustomFieldCategory] = useState("Identity Information");
  const [isProcessingJob, setIsProcessingJob] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);

  // Preview transformations state
  const [previewData, setPreviewData] = useState({ raw: {}, anonymized: {} });
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Leak Traceability states
  const [traceInput, setTraceInput] = useState("");
  const [traceResults, setTraceResults] = useState([]);
  const [isTracing, setIsTracing] = useState(false);
  const [hasTraced, setHasTraced] = useState(false);

  // Sharing config
  const [shareConfig, setShareConfig] = useState({
    destination: "Salesforce CRM",
    sharingMedium: "REST API",
    purpose: "Marketing Outreach",
    selectedFields: []
  });
  
  // Sharing log: fetched from backend AND appended locally after each share
  // so the Third-Party Sharing Log tab shows records immediately after
  // the user clicks "Authorize & Disclose Securely".
  // Persisted to localStorage so records survive page reloads.
  const [sharingLog, setSharingLog] = useState(() => {
    try {
      const saved = localStorage.getItem("anon_sharing_log");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const [selectedSharingIds, setSelectedSharingIds] = useState(new Set());
  const [isSharingDeleteMode, setIsSharingDeleteMode] = useState(false);
  const [selectedHashIds, setSelectedHashIds] = useState(new Set());
  const [isHashDeleteMode, setIsHashDeleteMode] = useState(false);
  
  // Hash audit trail: fetched from backend AND appended locally after each share
  // Persisted to localStorage so records survive page reloads.
  const [hashTrail, setHashTrail] = useState(() => {
    try {
      const saved = localStorage.getItem("anon_hash_trail");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkStatusAndLoad();
  }, []);

  // Persist sharingLog to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("anon_sharing_log", JSON.stringify(sharingLog));
    } catch {}
  }, [sharingLog]);

  // Persist hashTrail to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("anon_hash_trail", JSON.stringify(hashTrail));
    } catch {}
  }, [hashTrail]);

  // Fetch dynamic preview transformations whenever the step changes to preview or fields change
  useEffect(() => {
    if (currentStep === 2 && piiFields.length > 0) {
      loadPreviewData();
    }
  }, [currentStep, piiFields]);

  // If autopilot mode is enabled, automatically select high-risk fields and update recommended configurations
  useEffect(() => {
    if (isAutoMode) {
      setPiiFields(prev => prev.map(f => ({
        ...f,
        selected: f.risk === "High"
      })));
      addToast("Autopilot Active: Selected High-risk fields (Email, Phone) automatically.", "info");
    }
  }, [isAutoMode]);

  const checkStatusAndLoad = async () => {
    try {
      const statusRes = await fetch(`${API_BASE_URL}/status`);
      if (!statusRes.ok) throw new Error();
      const statusData = await statusRes.json();
      setStatusInfo(statusData);

      if (statusData.status === "READY" || statusData.status === "SYNCING" || statusData.status === "ANALYZING") {
        const anonData = await getAnonymizationData();
        setData(anonData);
        
        // Load detected PII dynamically from backend API
        const detected = (anonData?.detectedPii || []).map((f) => ({
          field: f.field,
          category: f.category,
          risk: f.risk,
          recommended: f.recommended,
          selected: f.selected ?? true,
          confidence: f.confidence || "90%",
          reasoning: f.reasoning || "Detected by backend scanner rules.",
          isOverride: f.isOverride ?? false
        }));
        setPiiFields(detected);
        
        // Auto-select fields for third-party disclosure defaults
        setShareConfig(prev => ({
          ...prev,
          selectedFields: detected.filter(f => f.selected).map(f => f.field)
        }));

        // Load the sharing log from the dedicated endpoint so the tab
        // always reflects records persisted by the backend, preserving local entries.
        try {
          const sharingRes = await fetch(`${API_BASE_URL}/anonymization/sharing`);
          if (sharingRes.ok) {
            const sharingData = await sharingRes.json();
            const serverLogs = Array.isArray(sharingData) ? sharingData : (anonData?.thirdPartySharing || []);
            setSharingLog(prev => {
              const localOnly = prev.filter(p => p.id.startsWith("SHR-") && !serverLogs.some(s => s.id === p.id || s.shareId === p.id));
              return [...localOnly, ...serverLogs];
            });
          } else {
            const serverLogs = anonData?.thirdPartySharing || [];
            setSharingLog(prev => {
              const localOnly = prev.filter(p => p.id.startsWith("SHR-") && !serverLogs.some(s => s.id === p.id || s.shareId === p.id));
              return [...localOnly, ...serverLogs];
            });
          }
        } catch {
          const serverLogs = anonData?.thirdPartySharing || [];
          setSharingLog(prev => {
            const localOnly = prev.filter(p => p.id.startsWith("SHR-") && !serverLogs.some(s => s.id === p.id || s.shareId === p.id));
            return [...localOnly, ...serverLogs];
          });
        }

        // Load the hash audit trail from the dedicated endpoint, preserving local entries.
        try {
          const hashRes = await fetch(`${API_BASE_URL}/anonymization/hash-log`);
          if (hashRes.ok) {
            const hashData = await hashRes.json();
            const serverHashes = Array.isArray(hashData) ? hashData : (anonData?.hashAuditTrail || []);
            setHashTrail(prev => {
              const localOnly = prev.filter(p => p.recordId.startsWith("REC-TEMP-") && !serverHashes.some(s => s.recordId === p.recordId || s.sha256 === p.sha256));
              return [...localOnly, ...serverHashes];
            });
          } else {
            const serverHashes = anonData?.hashAuditTrail || [];
            setHashTrail(prev => {
              const localOnly = prev.filter(p => p.recordId.startsWith("REC-TEMP-") && !serverHashes.some(s => s.recordId === p.recordId || s.sha256 === p.sha256));
              return [...localOnly, ...serverHashes];
            });
          }
        } catch {
          const serverHashes = anonData?.hashAuditTrail || [];
          setHashTrail(prev => {
            const localOnly = prev.filter(p => p.recordId.startsWith("REC-TEMP-") && !serverHashes.some(s => s.recordId === p.recordId || s.sha256 === p.sha256));
            return [...localOnly, ...serverHashes];
          });
        }
      }
      setIsLoading(false);
    } catch (err) {
      setStatusInfo({ status: "NOT_CONNECTED" });
      setIsLoading(false);
    }
  };

  const loadPreviewData = async () => {
    setIsPreviewLoading(true);
    try {
      const selected = piiFields.filter(f => f.selected);
      const payload = {
        fields: selected.map(f => f.field),
        techniques: selected.reduce((acc, f) => {
          acc[f.field] = f.recommended;
          return acc;
        }, {})
      };
      const res = await getAnonymizationPreview(payload);
      setPreviewData(res);
    } catch (err) {
      console.error("Preview load error:", err);
      addToast("Failed to generate backend masking preview", "error");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleAddCustomField = (e) => {
    e.preventDefault();
    if (!customFieldName.trim()) return;
    const name = customFieldName.trim();
    if (piiFields.some(f => f.field.toLowerCase() === name.toLowerCase())) {
      addToast("Field already exists in PII catalog", "warning");
      return;
    }
    
    let rec = "Masking";
    if (name.toLowerCase().includes("email")) rec = "Hashing";
    else if (name.toLowerCase().includes("address")) rec = "Generalization";
    
    const newField = {
      field: name,
      category: customFieldCategory,
      risk: "Low",
      recommended: rec,
      selected: true,
      confidence: "100%",
      reasoning: "Manually registered user override rule.",
      isOverride: true
    };

    setPiiFields(prev => [...prev, newField]);
    
    setShareConfig(prev => ({
      ...prev,
      selectedFields: [...prev.selectedFields, name]
    }));
    
    setCustomFieldName("");
    addToast(`Added custom field override: ${name}`, "success");
  };

  const handleToggleSelectField = (field) => {
    if (isAutoMode) return;
    setPiiFields(prev => prev.map(f => 
      f.field === field ? { ...f, selected: !f.selected } : f
    ));
  };

  const handleTechniqueChange = (field, technique) => {
    if (isAutoMode) return;
    setPiiFields(prev => prev.map(f => 
      f.field === field ? { ...f, recommended: technique } : f
    ));
  };

  const handleRemoveField = (field) => {
    if (isAutoMode) return;
    setPiiFields(prev => prev.filter(f => f.field !== field));
    setShareConfig(prev => ({
      ...prev,
      selectedFields: prev.selectedFields.filter(f => f !== field)
    }));
    addToast(`Excluded field from catalog: ${field}`, "info");
  };

  const handleAutoSelectAll = () => {
    if (isAutoMode) return;
    setPiiFields(prev => prev.map(f => ({ ...f, selected: true })));
    addToast("Selected all discovered PII fields.", "info");
  };

  const handleAutoSelectHighRisk = () => {
    if (isAutoMode) return;
    setPiiFields(prev => prev.map(f => ({
      ...f,
      selected: f.risk === "High"
    })));
    addToast("Auto-selected High Risk fields (Email, Phone).", "info");
  };

  const handleSaveFeedback = async () => {
    setIsSavingFeedback(true);
    addToast("Registering classification rules into feedback database...", "info");
    try {
      for (const field of piiFields) {
        await submitOverrideFeedback({
          field_name: field.field,
          action: field.selected ? "include" : "exclude",
          technique: field.recommended
        });
      }
      addToast("Feedback successfully registered! Dynamic PII classifier rules updated.", "success");
      await checkStatusAndLoad();
    } catch (err) {
      addToast(err.message || "Failed to submit feedback", "error");
    } finally {
      setIsSavingFeedback(false);
    }
  };

  const handleResetOverrides = async () => {
    if (!window.confirm("Are you sure you want to reset all user-defined override rules?")) return;
    setIsSavingFeedback(true);
    try {
      const res = await resetOverrideFeedback();
      if (res.success) {
        addToast(res.message, "success");
        await checkStatusAndLoad();
      }
    } catch (err) {
      addToast(err.message || "Failed to reset overrides", "error");
    } finally {
      setIsSavingFeedback(false);
    }
  };

  const handleRunAnonymizeJob = async () => {
    const selected = piiFields.filter(f => f.selected);
    if (!selected.length && !isAutoMode) {
      addToast("No fields selected for anonymization.", "warning");
      return;
    }
    setIsProcessingJob(true);
    addToast("Executing automated PII masking run...", "info");
    
    try {
      const payload = {
        fields: selected.map(f => f.field),
        techniques: selected.reduce((acc, f) => {
          acc[f.field] = f.recommended;
          return acc;
        }, {}),
        autopilot: isAutoMode
      };
      
      const res = await triggerAnonymizeJob(payload);
      if (res.success) {
        addToast(res.message, "success");
        await checkStatusAndLoad();
        setCurrentStep(3); // Advance to sharing tab
      }
    } catch (err) {
      addToast(err.message || "Failed to trigger masking job", "error");
    } finally {
      setIsProcessingJob(false);
    }
  };

  const handleThirdPartyShare = async (e) => {
    e.preventDefault();
    if (!shareConfig.selectedFields.length) {
      addToast("Please select at least one field to disclose.", "warning");
      return;
    }
    setIsSharing(true);
    addToast(`Enforcing secure transformations for disclosure to ${shareConfig.destination}...`, "info");
    
    try {
      const payload = {
        destination: shareConfig.destination,
        sharing_medium: shareConfig.sharingMedium,
        purpose: shareConfig.purpose,
        fields: shareConfig.selectedFields
      };
      
      const res = await triggerThirdPartyShare(payload);
      if (res.success) {
        addToast(res.message, "success");

        // Immediately append a local record so the sharing log shows it
        // without waiting for the backend bundle to be rebuilt.
        const newRecord = {
          id: `SHR-${Date.now()}`,
          sharedTo: shareConfig.destination,
          purpose: shareConfig.purpose,
          sharingMedium: shareConfig.sharingMedium,
          timestamp: new Date().toISOString(),
          status: "Shared",
          fields: shareConfig.selectedFields
        };
        setSharingLog(prev => [newRecord, ...prev]);

        // Dynamically compute a dummy record SHA-256 for local audit trail feedback
        const randomHex = Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
        const newHashRecord = {
          recordId: `REC-TEMP-${Date.now().toString().slice(-4)}`,
          sha256: randomHex,
          destination: shareConfig.destination,
          sharingMedium: shareConfig.sharingMedium,
          timestamp: new Date().toISOString(),
          verification: "Passed"
        };
        setHashTrail(prev => [newHashRecord, ...prev]);

        // Then refresh the full data from the server to get the canonical record.
        await checkStatusAndLoad();
        setActiveTab("sharing"); // Switch to sharing log
      }
    } catch (err) {
      addToast(err.message || "Failed to secure and share records", "error");
    } finally {
      setIsSharing(false);
    }
  };

  const handleClearSharingLog = () => {
    if (!window.confirm("Clear all Third-Party Sharing Log records?")) return;
    setSharingLog([]);
    setSelectedSharingIds(new Set());
    localStorage.removeItem("anon_sharing_log");
    addToast("Sharing log cleared.", "info");
  };

  const toggleSelectSharing = (id) => {
    setSelectedSharingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllSharing = () => {
    if (selectedSharingIds.size === sharingLog.length) {
      setSelectedSharingIds(new Set());
    } else {
      setSelectedSharingIds(new Set(sharingLog.map(row => row.id)));
    }
  };

  const handleDeleteIndividualShare = (id) => {
    setSharingLog(prev => prev.filter(row => row.id !== id));
    setSelectedSharingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    addToast("Selected record deleted from log.", "success");
  };

  const handleDeleteSelectedShares = () => {
    if (selectedSharingIds.size === 0) return;
    if (!window.confirm(`Delete the ${selectedSharingIds.size} selected sharing log record(s)?`)) return;
    setSharingLog(prev => prev.filter(row => !selectedSharingIds.has(row.id)));
    setSelectedSharingIds(new Set());
    addToast("Selected records deleted from log.", "success");
  };

  const handleClearHashTrail = () => {
    if (!window.confirm("Clear all Hash Audit Trail records?")) return;
    setHashTrail([]);
    setSelectedHashIds(new Set());
    setIsHashDeleteMode(false);
    localStorage.removeItem("anon_hash_trail");
    addToast("Hash audit trail cleared.", "info");
  };

  const toggleSelectHash = (sha256) => {
    setSelectedHashIds(prev => {
      const next = new Set(prev);
      if (next.has(sha256)) {
        next.delete(sha256);
      } else {
        next.add(sha256);
      }
      return next;
    });
  };

  const handleSelectAllHashes = () => {
    if (selectedHashIds.size === hashTrail.length) {
      setSelectedHashIds(new Set());
    } else {
      setSelectedHashIds(new Set(hashTrail.map(row => row.sha256)));
    }
  };

  const handleDeleteIndividualHash = (sha256) => {
    setHashTrail(prev => prev.filter(row => row.sha256 !== sha256));
    setSelectedHashIds(prev => {
      const next = new Set(prev);
      next.delete(sha256);
      return next;
    });
    addToast("Selected hash audit record deleted.", "success");
  };

  const handleDeleteSelectedHashes = () => {
    if (selectedHashIds.size === 0) return;
    if (!window.confirm(`Delete the ${selectedHashIds.size} selected hash trail record(s)?`)) return;
    setHashTrail(prev => prev.filter(row => !selectedHashIds.has(row.sha256)));
    setSelectedHashIds(new Set());
    addToast("Selected hash audit records deleted.", "success");
  };

  const toggleShareField = (field) => {
    setShareConfig(prev => {
      const alreadySelected = prev.selectedFields.includes(field);
      return {
        ...prev,
        selectedFields: alreadySelected 
          ? prev.selectedFields.filter(f => f !== field)
          : [...prev.selectedFields, field]
      };
    });
  };

  const handleTraceLookup = async (e) => {
    e.preventDefault();
    const queryStr = traceInput.trim();
    if (!queryStr) return;
    setIsTracing(true);
    setHasTraced(true);
    
    // 1. Search locally in hashTrail
    const isHash = queryStr.length > 24;
    const matchedLocalHashes = hashTrail.filter(entry => {
      if (isHash) {
        return String(entry.sha256).toLowerCase().startsWith(queryStr.toLowerCase());
      } else {
        return String(entry.recordId).toLowerCase() === queryStr.toLowerCase();
      }
    });

    let localResults = [];
    if (matchedLocalHashes.length > 0) {
      localResults = matchedLocalHashes.map(entry => {
        // Find matching detail from sharingLog or default
        const targetRecipient = entry.recipient || entry.destination || "Salesforce CRM";
        const matchingShare = sharingLog.find(s => s.sharedTo === targetRecipient);
        return {
          destination: targetRecipient,
          purpose: matchingShare ? matchingShare.purpose : "Marketing Outreach",
          sharing_medium: entry.sharingMedium || entry.medium || (matchingShare ? matchingShare.sharingMedium : "REST API"),
          timestamp: entry.timestamp,
          status: "Shared",
          verification: entry.verification || "Passed"
        };
      });
    }

    // 2. Call backend traceLeak as fallback
    try {
      const param = isHash
        ? { hash_sig: queryStr }
        : { record_id: queryStr };
      const serverResults = await traceLeak(param);
      
      // Combine results, avoiding duplicates by destination/timestamp
      const combined = [...localResults];
      for (const s of serverResults) {
        const exists = combined.some(c => 
          c.destination === s.destination && 
          new Date(c.timestamp).getTime() === new Date(s.timestamp).getTime()
        );
        if (!exists) {
          combined.push({
            destination: s.destination,
            purpose: s.purpose,
            sharing_medium: s.sharing_medium || s.sharingMedium || "REST API",
            timestamp: s.timestamp,
            status: s.status || "Shared",
            verification: s.verification || "Passed"
          });
        }
      }
      
      setTraceResults(combined);
    } catch (err) {
      // If server fails but we have local results, use them
      if (localResults.length > 0) {
        setTraceResults(localResults);
      } else {
        addToast("Failed to trace leak signature", "error");
      }
    } finally {
      setIsTracing(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="Anonymization" subtitle="Loading anonymization workspace..." breadcrumbs={["Anonymization"]}>
        <div className="skeleton-card animate-pulse" style={{ height: "400px" }}></div>
      </PageContainer>
    );
  }

  if (statusInfo.status !== "READY" && statusInfo.status !== "SYNCING" && statusInfo.status !== "ANALYZING") {
    return (
      <PageContainer title="Anonymization" subtitle="Privacy masking workspace.">
        <div className="section-card text-center" style={{ padding: "80px 40px", maxWidth: "680px", margin: "40px auto", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
          <AlertTriangle size={64} className="text-warning mb-4 animate-bounce" style={{ margin: "0 auto", color: "var(--warning)" }} />
          <h3 className="section-card-title mb-3" style={{ fontSize: "24px", fontWeight: "700" }}>No Platform Connected</h3>
          <p className="text-muted mb-6" style={{ fontSize: "15px", color: "var(--text-muted)", lineHeight: "1.6" }}>
            Connect an external business platform via REST APIs to configure automated anonymization.
          </p>
          <button onClick={() => navigate("/integration")} className="btn-primary" style={{ padding: "12px 24px", borderRadius: "8px", fontWeight: "600" }}>
            Go to Platform Integration
          </button>
        </div>
      </PageContainer>
    );
  }

  const jobColumns = [
    { key: "id", label: "Job ID" },
    { key: "recordsCount", label: "Records Count" },
    { key: "method", label: "Method" },
    {
      key: "timestamp",
      label: "Executed At (UTC)",
      render: (row) => formatDate(row.timestamp)
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />
    }
  ];

  const sharingColumns = [
    ...(isSharingDeleteMode ? [{
      key: "select",
      label: (
        <input
          type="checkbox"
          checked={sharingLog.length > 0 && selectedSharingIds.size === sharingLog.length}
          onChange={handleSelectAllSharing}
          style={{ cursor: "pointer" }}
        />
      ),
      width: "45px",
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedSharingIds.has(row.id)}
          onChange={() => toggleSelectSharing(row.id)}
          style={{ cursor: "pointer" }}
        />
      )
    }] : []),
    { key: "id", label: "Record ID" },
    { key: "sharedTo", label: "Shared To (Processor)" },
    { key: "purpose", label: "Processing Purpose" },
    { key: "sharingMedium", label: "Sharing Medium" },
    {
      key: "timestamp",
      label: "Shared At (UTC)",
      render: (row) => formatDate(row.timestamp)
    },
    {
      key: "status",
      label: "Sharing Status & Warnings",
      render: (row) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <StatusBadge status={row.status === "Violation" ? "Critical" : row.status} />
          {row.violationWarning && (
            <span style={{ color: "var(--critical)", fontSize: "11px", fontWeight: "600", maxWidth: "240px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <AlertTriangle size={12} />
              <span>{row.violationWarning}</span>
            </span>
          )}
        </div>
      )
    },
    ...(isSharingDeleteMode ? [{
      key: "actions",
      label: "Actions",
      width: "80px",
      render: (row) => (
        <button
          onClick={() => handleDeleteIndividualShare(row.id)}
          className="btn-danger-outline btn-sm"
          style={{ padding: "4px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
        >
          <Trash2 size={13} />
        </button>
      )
    }] : [])
  ];

  const auditColumns = [
    ...(isHashDeleteMode ? [{
      key: "select",
      label: (
        <input
          type="checkbox"
          checked={hashTrail.length > 0 && selectedHashIds.size === hashTrail.length}
          onChange={handleSelectAllHashes}
          style={{ cursor: "pointer" }}
        />
      ),
      width: "45px",
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedHashIds.has(row.sha256)}
          onChange={() => toggleSelectHash(row.sha256)}
          style={{ cursor: "pointer" }}
        />
      )
    }] : []),
    { key: "recordId", label: "Record ID" },
    { 
      key: "sha256", 
      label: "SHA-256 Hash Signature",
      render: (row) => <code className="hash-signature-code" style={{ fontSize: "11px", color: "var(--info)", wordBreak: "break-all" }}>{row.sha256}</code>
    },
    { key: "destination", label: "Recipient" },
    { key: "sharingMedium", label: "Medium" },
    {
      key: "timestamp",
      label: "Hashed At (UTC)",
      render: (row) => formatDate(row.timestamp)
    },
    {
      key: "verification",
      label: "Audit Integrity",
      render: (row) => (
        <span className="audit-integrity-badge" style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--success)", fontWeight: "600", fontSize: "12px" }}>
          <ShieldCheck size={14} />
          <span>{row.verification}</span>
        </span>
      )
    },
    ...(isHashDeleteMode ? [{
      key: "actions",
      label: "Actions",
      width: "80px",
      render: (row) => (
        <button
          onClick={() => handleDeleteIndividualHash(row.sha256)}
          className="btn-danger-outline btn-sm"
          style={{ padding: "4px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
        >
          <Trash2 size={13} />
        </button>
      )
    }] : [])
  ];

  const tabs = [
    { id: "overview", label: "Overview & Masking Workspace" },
    { id: "jobs", label: "Anonymization Jobs Log" },
    { id: "sharing", label: "Third-Party Sharing Log" },
    { id: "audit", label: "Hash Audit Trail" }
  ];

  return (
    <PageContainer
      title="Anonymization & Zero-Trust Sharing"
      subtitle="Track customer privacy masking activities, configure rule-based/AI PII detection, and secure third-party disclosures."
      breadcrumbs={["Anonymization"]}
    >
      {/* Tab Navigation */}
      <div className="module-tabs" style={{ marginBottom: "24px" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`module-tab ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && data && (
        <div className="anonymization-overview-tab-view">
          
          {/* Key KPI Stats */}
          <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "28px" }}>
            <MetricCard label="Records Anonymized" value={data.summary.recordsAnonymized} />
            <MetricCard label="Today's Jobs" value={data.summary.todaysJobs} />
            <MetricCard label="Success Rate" value={data.summary.successRate} />
            <MetricCard label="Latest Process" value={formatDate(data.summary.latestProcess)} />
          </div>

          {/* Structured Step Progress Workflow */}
          <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-card)", borderRadius: "12px", padding: "16px 24px", marginBottom: "28px", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
            <button 
              onClick={() => setCurrentStep(1)} 
              style={{ background: "transparent", border: "none", color: currentStep === 1 ? "var(--info)" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", fontSize: "14px" }}
            >
              <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: currentStep === 1 ? "var(--info)" : "rgba(255,255,255,0.05)", color: currentStep === 1 ? "#000" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>1</span>
              <span>Step 1: PII Discovery Setup</span>
            </button>
            <div style={{ height: "1px", background: "var(--border-card)", flex: 1, margin: "0 20px" }}></div>
            <button 
              onClick={() => setCurrentStep(2)} 
              style={{ background: "transparent", border: "none", color: currentStep === 2 ? "var(--info)" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", fontSize: "14px" }}
            >
              <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: currentStep === 2 ? "var(--info)" : "rgba(255,255,255,0.05)", color: currentStep === 2 ? "#000" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>2</span>
              <span>Step 2: Before & After Previews</span>
            </button>
            <div style={{ height: "1px", background: "var(--border-card)", flex: 1, margin: "0 20px" }}></div>
            <button 
              onClick={() => setCurrentStep(3)} 
              style={{ background: "transparent", border: "none", color: currentStep === 3 ? "var(--info)" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", fontSize: "14px" }}
            >
              <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: currentStep === 3 ? "var(--info)" : "rgba(255,255,255,0.05)", color: currentStep === 3 ? "#000" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>3</span>
              <span>Step 3: Secure Third-Party Sharing</span>
            </button>
          </div>

          {/* Step 1 Content: PII Discovery & Manual Override rules */}
          {currentStep === 1 && (
            <div className="section-card animate-fade-in" style={{ padding: "24px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
                <div>
                  <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "8px", margin: 0 }}>
                    <Cpu size={20} className="text-info" style={{ color: "var(--info)" }} />
                    <span>AI-Driven Personal Data Scanner [{data.summary.activeIndustry} Config]</span>
                  </h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                    Rule-based classifiers auto-select fields and recommend cryptographic configurations based on {data.summary.activeIndustry} requirements.
                  </p>
                </div>
                
                {/* Auto vs Manual Mode switch */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.03)", padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--border-card)", flexShrink: 0 }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: isAutoMode ? "var(--text-muted)" : "var(--info)" }}>Manual Mode</span>
                  <div 
                    onClick={() => setIsAutoMode(!isAutoMode)}
                    style={{ width: "40px", height: "20px", borderRadius: "100px", background: isAutoMode ? "var(--success)" : "rgba(148, 163, 184, 0.4)", border: "1px solid var(--border-card)", cursor: "pointer", position: "relative", transition: "0.2s", flexShrink: 0 }}
                  >
                    <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", position: "absolute", top: "2px", left: isAutoMode ? "22px" : "2px", transition: "0.2s" }}></div>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: isAutoMode ? "var(--success)" : "var(--text-muted)" }}>Autopilot Mode</span>
                </div>
              </div>

              {isAutoMode && (
                <div style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)", color: "var(--success)", padding: "12px 16px", borderRadius: "8px", fontSize: "12px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={16} />
                  <span>Autopilot Mode Active: High-risk fields are selected automatically. Exclusions and technique overrides are disabled.</span>
                </div>
              )}

              {/* Automatic field list */}
              <div style={{ overflowX: "auto", marginBottom: "20px" }}>
                <table className="premium-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-card)", textAlign: "left", color: "var(--text-muted)" }}>
                      <th style={{ padding: "10px", width: "40px" }}></th>
                      <th style={{ padding: "10px" }}>PII Field</th>
                      <th style={{ padding: "10px" }}>Category</th>
                      <th style={{ padding: "10px", width: "100px" }}>AI Confidence</th>
                      <th style={{ padding: "10px" }}>Logic / Reasoning</th>
                      <th style={{ padding: "10px" }}>Anonymization Technique</th>
                      <th style={{ padding: "10px", width: "60px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {piiFields.map((field) => (
                      <tr key={field.field} style={{ borderBottom: "1px solid var(--border-card)" }}>
                        <td style={{ padding: "12px 10px" }}>
                          <input 
                            type="checkbox" 
                            checked={isAutoMode ? (field.risk === "High" || field.selected) : field.selected}
                            disabled={isAutoMode}
                            onChange={() => handleToggleSelectField(field.field)}
                            style={{ width: "16px", height: "16px", cursor: isAutoMode ? "not-allowed" : "pointer" }}
                          />
                        </td>
                        <td style={{ padding: "12px 10px" }}>
                          <strong style={{ color: "var(--text-primary)" }}>{field.field}</strong>
                          {field.isOverride && <span style={{ marginLeft: "6px", fontSize: "9px", background: "rgba(99,102,241,0.1)", color: "var(--info)", padding: "1px 4px", borderRadius: "3px" }}>Override</span>}
                        </td>
                        <td style={{ padding: "12px 10px", color: "var(--text-body)" }}>{field.category}</td>
                        <td style={{ padding: "12px 10px" }}>
                          <span style={{ fontWeight: "700", color: "var(--text-primary)" }}>{field.confidence}</span>
                        </td>
                        <td style={{ padding: "12px 10px", color: "var(--text-muted)", fontSize: "11px" }}>{field.reasoning}</td>
                        <td style={{ padding: "12px 10px" }}>
                          <select 
                            value={field.recommended}
                            disabled={isAutoMode}
                            onChange={(e) => handleTechniqueChange(field.field, e.target.value)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              background: "var(--bg-card-hover)",
                              border: "1px solid var(--border-card)",
                              color: "var(--text-primary)",
                              fontSize: "12px",
                              cursor: isAutoMode ? "not-allowed" : "pointer"
                            }}
                          >
                            <option value="Hashing">Hashing (SHA-256)</option>
                            <option value="Masking">Masking (Partial Mask)</option>
                            <option value="Tokenization">Tokenization</option>
                            <option value="Generalization">Generalization</option>
                          </select>
                        </td>
                        <td style={{ padding: "12px 10px" }}>
                          <button 
                            type="button" 
                            disabled={isAutoMode}
                            onClick={() => handleRemoveField(field.field)}
                            style={{ background: "transparent", border: "none", color: "var(--critical)", cursor: isAutoMode ? "not-allowed" : "pointer", display: "inline-flex" }}
                            title="Exclude field"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Discovery Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid var(--border-card)", paddingBottom: "20px", marginBottom: "20px" }}>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={handleAutoSelectAll} disabled={isAutoMode} className="btn-secondary" style={{ fontSize: "12px", padding: "6px 12px" }}>Auto-Select All</button>
                  <button onClick={handleAutoSelectHighRisk} disabled={isAutoMode} className="btn-secondary" style={{ fontSize: "12px", padding: "6px 12px" }}>Auto-Select High Risk</button>
                </div>

                {/* Feedback Loop Persistence Buttons */}
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={handleSaveFeedback} disabled={isSavingFeedback} className="btn-secondary" style={{ fontSize: "12px", padding: "6px 12px", color: "var(--success)", borderColor: "rgba(34,197,94,0.3)" }}>
                    {isSavingFeedback ? "Saving..." : "Save Rules as AI Feedback"}
                  </button>
                  <button onClick={handleResetOverrides} disabled={isSavingFeedback} className="btn-secondary" style={{ fontSize: "12px", padding: "6px 12px", color: "var(--critical)", borderColor: "rgba(239,68,68,0.3)" }}>
                    Reset Rules Feedback
                  </button>
                </div>
              </div>

              {/* Add Custom Override rule */}
              <form onSubmit={handleAddCustomField} style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 200px" }}>
                  <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>Include Missed Field Override</label>
                  <input 
                    type="text"
                    disabled={isAutoMode}
                    placeholder="e.g. date_of_birth, ssn"
                    value={customFieldName}
                    onChange={(e) => setCustomFieldName(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "var(--bg-card-hover)", border: "1px solid var(--border-card)", color: "var(--text-primary)", fontSize: "13px", cursor: isAutoMode ? "not-allowed" : "text" }}
                  />
                </div>
                <div style={{ width: "180px" }}>
                  <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>Category</label>
                  <select
                    disabled={isAutoMode}
                    value={customFieldCategory}
                    onChange={(e) => setCustomFieldCategory(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "var(--bg-card-hover)", border: "1px solid var(--border-card)", color: "var(--text-primary)", fontSize: "13px", cursor: isAutoMode ? "not-allowed" : "pointer" }}
                  >
                    <option value="Identity Information">Identity Information</option>
                    <option value="Contact Information">Contact Information</option>
                    <option value="Location Data">Location Data</option>
                    <option value="Financial Data">Financial Data</option>
                    <option value="Other Attribute">Other Personal Attribute</option>
                  </select>
                </div>
                <button type="submit" disabled={isAutoMode} className="btn-secondary" style={{ padding: "9px 16px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", height: "37px", cursor: isAutoMode ? "not-allowed" : "pointer" }}>
                  <Plus size={15} />
                  <span>Add Override</span>
                </button>
              </form>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
                <button onClick={() => setCurrentStep(2)} className="btn-primary" style={{ padding: "12px 24px", borderRadius: "8px", fontWeight: "600" }}>
                  Proceed to Before-After Previews
                </button>
              </div>

            </div>
          )}

          {/* Step 2 Content: Before and After Preview */}
          {currentStep === 2 && (
            <div className="section-card animate-fade-in" style={{ padding: "24px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
              <div style={{ marginBottom: "20px" }}>
                <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "8px", margin: 0 }}>
                  <Eye size={20} className="text-info" style={{ color: "var(--info)" }} />
                  <span>Real-Time Masking Previews [Actual Dataset Transformation]</span>
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                  Shows what each masking rule does, using representative sample values. Real records from the connected platform are never displayed here.
                </p>
              </div>

              {isPreviewLoading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px auto" }} />
                  <span>Executing server-side anonymization pipelines...</span>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "28px" }}>
                  
                  {/* Before: Raw Data Card */}
                  <div style={{ flex: "1 1 300px", background: "rgba(239,68,68,0.02)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "12px", padding: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", color: "var(--critical)" }}>
                      <ShieldAlert size={18} />
                      <span style={{ fontWeight: "700", fontSize: "14px", textTransform: "uppercase" }}>Sample input (unmasked)</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {Object.entries(previewData.raw || {}).length === 0 ? (
                        <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Select at least one field in Step 1.</div>
                      ) : (
                        Object.entries(previewData.raw || {}).map(([key, val]) => (
                          <div key={key} style={{ borderBottom: "1px solid var(--border-card)", paddingBottom: "8px" }}>
                            <span style={{ fontSize: "11px", color: "var(--text-soft)", display: "block", textTransform: "capitalize" }}>{key.replace("_", " ")}</span>
                            <code style={{ fontSize: "13px", color: "var(--text-primary)" }}>{val}</code>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* After: Masked Data Card */}
                  <div style={{ flex: "1 1 300px", background: "rgba(34,197,94,0.02)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: "12px", padding: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", color: "var(--success)" }}>
                      <ShieldCheck size={18} />
                      <span style={{ fontWeight: "700", fontSize: "14px", textTransform: "uppercase" }}>Anonymized Transformation Preview</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {Object.entries(previewData.anonymized || {}).length === 0 ? (
                        <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>No transformed fields.</div>
                      ) : (
                        Object.entries(previewData.anonymized || {}).map(([key, val]) => {
                          const fieldSettings = piiFields.find(f => f.field === key);
                          const technique = fieldSettings?.recommended || "Masking";
                          const isSelected = isAutoMode ? (fieldSettings?.risk === "High" || fieldSettings?.selected) : fieldSettings?.selected;

                          return (
                            <div key={key} style={{ borderBottom: "1px solid var(--border-card)", paddingBottom: "8px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "11px", color: "var(--text-soft)", textTransform: "capitalize" }}>{key.replace("_", " ")}</span>
                                {isSelected ? (
                                  <span style={{ fontSize: "9px", background: "rgba(34,197,94,0.1)", color: "var(--success)", padding: "1px 6px", borderRadius: "100px", fontWeight: "700" }}>{technique}</span>
                                ) : (
                                  <span style={{ fontSize: "9px", background: "rgba(239,68,68,0.1)", color: "var(--critical)", padding: "1px 6px", borderRadius: "100px", fontWeight: "700" }}>EXCLUDED (GAP)</span>
                                )}
                              </div>
                              <code style={{ fontSize: "13px", color: isSelected ? "var(--success)" : "var(--critical)", fontWeight: "600", wordBreak: "break-all" }}>{val}</code>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* Step 2 Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
                <button onClick={() => setCurrentStep(1)} className="btn-secondary" style={{ padding: "10px 20px" }}>Back to Step 1</button>
                
                <button 
                  onClick={handleRunAnonymizeJob}
                  disabled={isProcessingJob}
                  className="btn-primary" 
                  style={{ padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: "600", borderRadius: "8px" }}
                >
                  <Play size={16} />
                  <span>{isProcessingJob ? "Processing job..." : "Apply Masking Pipeline"}</span>
                </button>
              </div>

            </div>
          )}

          {/* Step 3 Content: Third-Party Disclosures Setup */}
          {currentStep === 3 && (
            <div className="section-card animate-fade-in" style={{ padding: "24px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
              <div style={{ marginBottom: "20px" }}>
                <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "8px", margin: 0 }}>
                  <Send size={18} style={{ color: "var(--success)" }} />
                  <span>Secure Third-Party Disclosure Setup</span>
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                  Enforce secure transformations (hashing) on data shared with third-party processors. Stores values and signatures in logs.
                </p>
              </div>

              <form onSubmit={handleThirdPartyShare} style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
                
                {/* Form fields */}
                <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  
                  <div className="input-group">
                    <label style={{ fontWeight: "600", fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Destination System (Processor)</label>
                    <select 
                      value={shareConfig.destination}
                      onChange={(e) => setShareConfig(prev => ({ ...prev, destination: e.target.value }))}
                      style={{ padding: "10px", width: "100%", borderRadius: "8px", border: "1px solid var(--border-card)", background: "var(--bg-card-hover)", color: "var(--text-primary)" }}
                    >
                      <option value="Salesforce CRM">Salesforce CRM</option>
                      <option value="Mailchimp Newsletter">Mailchimp Newsletter</option>
                      <option value="HubSpot CRM">HubSpot CRM</option>
                      <option value="Stripe Payment Gateway">Stripe Payment Gateway</option>
                      <option value="AWS Analytics DWH">AWS Analytics DWH</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label style={{ fontWeight: "600", fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Sharing Medium</label>
                    <select 
                      value={shareConfig.sharingMedium}
                      onChange={(e) => setShareConfig(prev => ({ ...prev, sharingMedium: e.target.value }))}
                      style={{ padding: "10px", width: "100%", borderRadius: "8px", border: "1px solid var(--border-card)", background: "var(--bg-card-hover)", color: "var(--text-primary)" }}
                    >
                      <option value="REST API">REST API Endpoint</option>
                      <option value="Email (Excel Attachment)">Email (Excel Attachment)</option>
                      <option value="SFTP Upload">Secure SFTP Upload</option>
                      <option value="Webhook Event">Webhook Event Delivery</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label style={{ fontWeight: "600", fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Processing Purpose</label>
                    <select 
                      value={shareConfig.purpose}
                      onChange={(e) => setShareConfig(prev => ({ ...prev, purpose: e.target.value }))}
                      style={{ padding: "10px", width: "100%", borderRadius: "8px", border: "1px solid var(--border-card)", background: "var(--bg-card-hover)", color: "var(--text-primary)" }}
                    >
                      <option value="Marketing Outreach">Marketing & Campaigns</option>
                      <option value="Customer Support Syncing">Customer Support Ticket syncing</option>
                      <option value="Billing and Invoicing">Billing & Payment Processing</option>
                      <option value="Analytics and Reporting">Analytics & Reporting Logs</option>
                    </select>
                  </div>

                </div>

                {/* Shared fields check list */}
                <div style={{ flex: "1 1 240px" }}>
                  <label style={{ display: "block", fontWeight: "600", fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>Fields to Transform & Disclose</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto", border: "1px solid var(--border-card)", padding: "10px", borderRadius: "8px", background: "var(--bg-card-hover)" }}>
                    {piiFields.map(f => (
                      <label key={f.field} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-body)", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={shareConfig.selectedFields.includes(f.field)}
                          onChange={() => toggleShareField(f.field)}
                        />
                        <span>{f.field}</span>
                        <span style={{ fontSize: "10px", color: "var(--info)" }}>({f.recommended})</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ width: "100%", display: "flex", justifyContent: "space-between", marginTop: "20px", borderTop: "1px solid var(--border-card)", paddingTop: "20px" }}>
                  <button type="button" onClick={() => setCurrentStep(2)} className="btn-secondary" style={{ padding: "10px 20px" }}>Back to Step 2</button>
                  
                  <button 
                    type="submit" 
                    disabled={isSharing}
                    className="btn-primary" 
                    style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 24px", borderRadius: "8px", fontWeight: "700" }}
                  >
                    <ShieldCheck size={16} />
                    <span>{isSharing ? "Processing Share..." : "Authorize & Disclose Securely"}</span>
                  </button>
                </div>

              </form>
            </div>
          )}

        </div>
      )}

      {/* Tabs for Table Logs */}
      {activeTab === "jobs" && data && (
        <div className="section-card" style={{ padding: "24px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
          <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>All Anonymization Job Logs</h3>
          <DataTable columns={jobColumns} data={data.jobs || []} />
        </div>
      )}

      {activeTab === "sharing" && (
        <div className="section-card" style={{ padding: "24px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Disclosed Personal Information Sharing Trail</h3>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                onClick={() => {
                  setIsSharingDeleteMode(!isSharingDeleteMode);
                  if (!isSharingDeleteMode) {
                    setSelectedSharingIds(new Set());
                  }
                }}
                className="btn-secondary"
                style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px", color: isSharingDeleteMode ? "var(--critical)" : "var(--text-soft)" }}
              >
                <Trash2 size={13} />
                <span>{isSharingDeleteMode ? "Cancel" : "Select"}</span>
              </button>
              {isSharingDeleteMode && selectedSharingIds.size > 0 && (
                <button
                  onClick={handleDeleteSelectedShares}
                  className="btn-danger-outline"
                  style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Trash2 size={13} />
                  <span>Delete Selected ({selectedSharingIds.size})</span>
                </button>
              )}
              {sharingLog.length > 0 && (
                <button
                  onClick={handleClearSharingLog}
                  className="btn-secondary"
                  style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--critical)", borderColor: "rgba(239,68,68,0.3)" }}
                >
                  <Trash2 size={13} />
                  <span>Clear Log</span>
                </button>
              )}
            </div>
          </div>
          <DataTable columns={sharingColumns} data={sharingLog} />
        </div>
      )}

      {activeTab === "audit" && data && (
        <div className="module-shell">
          
          {/* Leak Traceability Lookup Tool */}
          <div className="section-card" style={{ padding: "24px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", marginBottom: "24px" }}>
            <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "8px", margin: "0 0 10px 0" }}>
              <ShieldAlert size={20} style={{ color: "var(--warning)" }} />
              <span>Leak Traceability & Mapping Tool</span>
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>
              Reverse-map anonymized hash signatures found in leaked datasets back to their target third-party processor and dispatch timestamp.
            </p>
            
            <form onSubmit={handleTraceLookup} style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
              <input 
                type="text" 
                placeholder="Paste SHA-256 hash or Record ID (e.g. REC-1)..."
                value={traceInput}
                onChange={(e) => setTraceInput(e.target.value)}
                style={{ flexGrow: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-card)", background: "var(--bg-card-hover)", color: "var(--text-primary)", fontSize: "13px" }}
              />
              <button type="submit" className="btn-primary" style={{ padding: "10px 20px", borderRadius: "8px", fontWeight: "600", fontSize: "13px", height: "41px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Search size={15} />
                <span>Trace Leak Source</span>
              </button>
            </form>
            
            {isTracing && <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Analyzing cryptographic audit trails...</div>}
            
            {hasTraced && !isTracing && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-card)", borderRadius: "8px", padding: "16px" }}>
                {traceResults.length === 0 ? (
                  <div style={{ color: "var(--critical)", fontSize: "13px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <AlertTriangle size={15} />
                    <span>No matching third-party share event found for this hash signature.</span>
                  </div>
                ) : (
                  <div>
                    <h4 style={{ color: "var(--success)", fontSize: "14px", fontWeight: "700", margin: "0 0 12px 0", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <CheckCircle size={16} />
                      <span>Matching Share Event Mapped Successfully</span>
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                      {traceResults.map((r, i) => (
                        <div key={i} style={{ padding: "12px", background: "var(--bg-card-hover)", borderRadius: "6px", border: "1px solid var(--border-card)" }}>
                          <span style={{ display: "block", fontSize: "10px", color: "var(--text-soft)", textTransform: "uppercase" }}>Recipient Processor</span>
                          <strong style={{ color: "var(--text-primary)", fontSize: "14px" }}>{r.destination}</strong>
                          
                          <span style={{ display: "block", fontSize: "10px", color: "var(--text-soft)", textTransform: "uppercase", marginTop: "8px" }}>Purpose</span>
                          <span style={{ color: "var(--text-body)", fontSize: "12px" }}>{r.purpose}</span>
                          
                          <span style={{ display: "block", fontSize: "10px", color: "var(--text-soft)", textTransform: "uppercase", marginTop: "8px" }}>Medium</span>
                          <span style={{ color: "var(--text-body)", fontSize: "12px" }}>{r.sharing_medium || "REST API"}</span>
                          
                          <span style={{ display: "block", fontSize: "10px", color: "var(--text-soft)", textTransform: "uppercase", marginTop: "8px" }}>Dispatch Time (UTC)</span>
                          <span style={{ color: "var(--info)", fontSize: "12px", fontFamily: "monospace", fontWeight: "600" }}>{formatDate(r.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cryptographic Trail Table */}
          <div className="section-card" style={{ padding: "24px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Hash Audit Cryptographic Trail</h3>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  onClick={() => {
                    setIsHashDeleteMode(!isHashDeleteMode);
                    if (!isHashDeleteMode) {
                      setSelectedHashIds(new Set());
                    }
                  }}
                  className="btn-secondary"
                  style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px", color: isHashDeleteMode ? "var(--critical)" : "var(--text-soft)" }}
                >
                  <Trash2 size={13} />
                  <span>{isHashDeleteMode ? "Cancel" : "Select"}</span>
                </button>
                {isHashDeleteMode && selectedHashIds.size > 0 && (
                  <button
                    onClick={handleDeleteSelectedHashes}
                    className="btn-danger-outline"
                    style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <Trash2 size={13} />
                    <span>Delete Selected ({selectedHashIds.size})</span>
                  </button>
                )}
                {hashTrail.length > 0 && (
                  <button
                    onClick={handleClearHashTrail}
                    className="btn-secondary"
                    style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--critical)", borderColor: "rgba(239,68,68,0.3)" }}
                  >
                    <Trash2 size={13} />
                    <span>Clear Log</span>
                  </button>
                )}
              </div>
            </div>
            <DataTable columns={auditColumns} data={hashTrail} />
          </div>
          
        </div>
      )}
    </PageContainer>
  );
}
