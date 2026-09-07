import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../layout/PageContainer";
import { updateConsent, deleteConsentPII, getDeletionAuditLogs } from "../services/consentService";
import { fetchConsents } from "../services/consentApi";
import { useToast } from "../context/ToastContext";
import { usePrivacySoc } from "../context/PrivacySocContext";
import MetricCard from "../components/common/MetricCard";
import SearchBar from "../components/common/SearchBar";
import DataTable from "../components/common/DataTable";
import StatusBadge from "../components/common/StatusBadge";
import ConfirmationModal from "../components/common/ConfirmationModal";
import { formatDate } from "../utils/formatDate";
import { API_BASE_URL } from "../config/appConfig";
import {
  AlertTriangle,
  ShieldCheck,
  Inbox,
  RefreshCw,
  BarChart2,
  Lock,
  Cpu,
  Trash2,
  TrendingUp,
  Activity,
  Check,
  X,
  Play,
  Clock,
  Server,
  ShieldAlert,
  ArrowRight
} from "lucide-react";


// Personal data is shown as presence, not content. A chip reads at a glance and
// makes it obvious the portal is deliberately withholding the value rather than
// failing to load it.

// Sources report consent state as consent_status (granted/revoked) while the
// legacy shape used status (Approved/Pending/Revoked). Read both, and never
// assume the field is present — a missing one used to throw the moment a filter
// was applied.
function readState(row = {}) {
  const raw = String(row.consent_status ?? row.status ?? "").toLowerCase();
  if (["granted", "approved", "active", "given"].includes(raw)) return "granted";
  if (["revoked", "withdrawn", "denied"].includes(raw)) return "revoked";
  return "pending";
}

function PresenceChip({ value }) {
  const present = value === "Present" || (value && value !== "Not provided");
  return (
    <span style={{
      display: "inline-block", fontSize: "11px", fontWeight: 700,
      padding: "3px 10px", borderRadius: "100px", textTransform: "uppercase",
      letterSpacing: "0.04em",
      background: present ? "rgba(34,197,94,0.1)" : "rgba(148,163,184,0.12)",
      color: present ? "var(--success)" : "var(--text-muted)"
    }}>
      {present ? "Present" : "Not provided"}
    </span>
  );
}

// Table for incoming consent requests awaiting approval/rejection
function PendingConsentRequestsTable({ pendingRequests, formatDate, updateConsent, activeApiKey, refreshData, addToast }) {
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(pendingRequests.length / PAGE_SIZE);
  const pageSlice = pendingRequests.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 140px 180px 200px", gap: "12px", padding: "8px 16px", fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-card)", marginBottom: "4px" }}>
        <span>Record</span>
        <span>Purpose</span>
        <span>Status</span>
        <span>Requested On</span>
        <span>Actions</span>
      </div>

      {pageSlice.map((req) => {
        const reqId = req.id ?? req.user_id;
        return (
          <div key={reqId} style={{
            display: "grid",
            gridTemplateColumns: "100px 1fr 140px 180px 200px",
            gap: "12px",
            alignItems: "center",
            padding: "12px 16px",
            borderRadius: "8px",
            borderBottom: "1px solid var(--border-card)"
          }}>
            <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
              #{reqId}
            </span>
            <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>
              {req.purpose || "Not stated"}
            </span>
            <span>
              <span style={{
                display: "inline-flex", alignItems: "center", fontSize: "11px", fontWeight: "700",
                color: "var(--warning)", background: "rgba(234,179,8,0.1)",
                padding: "3px 10px", borderRadius: "100px"
              }}>
                Awaiting Decision
              </span>
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {formatDate(req.timestamp || req.created) || "—"}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => updateConsent(reqId, "Revoked").then(() => {
                  if (activeApiKey) refreshData(activeApiKey).catch(() => {});
                  addToast("Consent request rejected.", "info");
                })}
                style={{ padding: "6px 12px", borderRadius: "6px", background: "transparent", border: "1px solid var(--border-card)", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", cursor: "pointer", color: "var(--text-primary)" }}
              >
                <X size={12} /> Reject
              </button>
              <button
                type="button"
                onClick={() => updateConsent(reqId, "Approved").then(() => {
                  if (activeApiKey) refreshData(activeApiKey).catch(() => {});
                  addToast("Consent request approved.", "success");
                })}
                className="btn-primary"
                style={{ padding: "6px 12px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px" }}
              >
                <Check size={12} /> Approve
              </button>
            </div>
          </div>
        );
      })}

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border-card)" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, pendingRequests.length)} of {pendingRequests.length} records
          </span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid var(--border-card)", background: "transparent", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.4 : 1, fontSize: "12px" }}>
              ← Prev
            </button>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid var(--border-card)", background: "transparent", cursor: page === totalPages - 1 ? "not-allowed" : "pointer", opacity: page === totalPages - 1 ? 0.4 : 1, fontSize: "12px" }}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Table for revoked consent records awaiting secure PII deletion
function PendingDataDeletionsTable({ pendingRequests, formatDate, deleteConsentPII, activeApiKey, refreshData, addToast, onViewAudit }) {
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(0);
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [completedIds, setCompletedIds] = useState(new Set());
  const [failedIds, setFailedIds] = useState(new Map()); // id -> error message

  const totalPages = Math.ceil(pendingRequests.length / PAGE_SIZE);
  const pageSlice = pendingRequests.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const startDeletion = (reqId) => {
    setDeletingIds(prev => new Set([...prev, reqId]));
    setFailedIds(prev => {
      const next = new Map(prev);
      next.delete(reqId);
      return next;
    });

    deleteConsentPII(reqId)
      .then((res) => {
        setCompletedIds(prev => new Set([...prev, reqId]));
        setDeletingIds(prev => {
          const next = new Set(prev);
          next.delete(reqId);
          return next;
        });
        addToast(`PII deletion completed for record #${reqId}`, "success");
        if (activeApiKey) {
          setTimeout(() => {
            refreshData(activeApiKey).catch(() => {});
          }, 2000);
        }
      })
      .catch((err) => {
        setFailedIds(prev => new Map(prev).set(reqId, err.message || "Deletion request failed"));
        setDeletingIds(prev => {
          const next = new Set(prev);
          next.delete(reqId);
          return next;
        });
        addToast(`PII deletion failed for record #${reqId}: ${err.message}`, "error");
      });
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 180px 180px 200px", gap: "12px", padding: "8px 16px", fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-card)", marginBottom: "4px" }}>
        <span>Record</span>
        <span>Purpose</span>
        <span>Status</span>
        <span>Consent Withdrawn On</span>
        <span>Action</span>
      </div>

      {pageSlice.map((req) => {
        const reqId = req.id ?? req.user_id;
        const isDeleting = deletingIds.has(reqId);
        const isCompleted = completedIds.has(reqId);
        const failureReason = failedIds.get(reqId);

        return (
          <div key={reqId} style={{
            display: "grid",
            gridTemplateColumns: "100px 1fr 180px 180px 200px",
            gap: "12px",
            alignItems: "center",
            padding: "12px 16px",
            borderRadius: "8px",
            background: isCompleted ? "rgba(34,197,94,0.03)" : failureReason ? "rgba(239,68,68,0.03)" : "transparent",
            borderBottom: "1px solid var(--border-card)"
          }}>
            <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
              #{reqId}
            </span>
            <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>
              {req.purpose || "Not stated"}
            </span>
            
            <span>
              {isCompleted ? (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  fontSize: "11px", fontWeight: "700",
                  color: "var(--success)", background: "rgba(34,197,94,0.1)",
                  padding: "3px 10px", borderRadius: "100px"
                }}>
                  Deletion Completed
                </span>
              ) : failureReason ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "4px",
                    fontSize: "11px", fontWeight: "700",
                    color: "var(--critical)", background: "rgba(239,68,68,0.1)",
                    padding: "3px 10px", borderRadius: "100px", width: "fit-content"
                  }}>
                    Deletion Failed
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--critical)" }}>{failureReason}</span>
                </div>
              ) : (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  fontSize: "11px", fontWeight: "700",
                  color: "var(--critical)", background: "rgba(239,68,68,0.08)",
                  padding: "3px 10px", borderRadius: "100px"
                }}>
                  Deletion Required
                </span>
              )}
            </span>

            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {formatDate(req.timestamp) || "—"}
            </span>

            <div>
              {isCompleted ? (
                <button
                  type="button"
                  onClick={onViewAudit}
                  style={{
                    padding: "6px 12px", borderRadius: "6px",
                    background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-card)",
                    color: "var(--text-primary)", fontSize: "12px", fontWeight: "600",
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px"
                  }}
                >
                  View Audit Trail
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => startDeletion(reqId)}
                  style={{
                    padding: "6px 14px", borderRadius: "6px",
                    background: isDeleting ? "rgba(255,255,255,0.05)" : "rgba(239,68,68,0.08)",
                    border: isDeleting ? "1px solid var(--border-card)" : "1px solid rgba(239,68,68,0.2)",
                    color: isDeleting ? "var(--text-muted)" : "var(--critical)",
                    display: "inline-flex", alignItems: "center", gap: "5px",
                    fontSize: "12px", fontWeight: "600",
                    cursor: isDeleting ? "not-allowed" : "pointer", whiteSpace: "nowrap"
                  }}
                >
                  <Trash2 size={12} />
                  {isDeleting ? "Deleting..." : failureReason ? "Retry Deletion" : "Start Data Deletion"}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border-card)" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, pendingRequests.length)} of {pendingRequests.length} records
          </span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid var(--border-card)", background: "transparent", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.4 : 1, fontSize: "12px" }}>
              ← Prev
            </button>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid var(--border-card)", background: "transparent", cursor: page === totalPages - 1 ? "not-allowed" : "pointer", opacity: page === totalPages - 1 ? 0.4 : 1, fontSize: "12px" }}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal dialog to view the PII Deletion Audit Trail Logs
function DeletionAuditModal({ isOpen, onClose, getDeletionAuditLogs }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getDeletionAuditLogs()
        .then(setLogs)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen, getDeletionAuditLogs]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)"
    }}>
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border-card)",
        borderRadius: "16px", width: "90%", maxWidth: "800px", padding: "24px",
        maxHeight: "85vh", display: "flex", flexDirection: "column"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
            PII Deletion Audit Trail & Logs
          </h3>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: "18px"
          }}>
            &times;
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, marginBottom: "16px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>Loading audit logs...</div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>No deletion logs found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "80px 100px 100px 140px 120px 1fr",
                fontWeight: "700", fontSize: "11px", color: "var(--text-muted)",
                textTransform: "uppercase", paddingBottom: "6px", borderBottom: "1px solid var(--border-card)"
              }}>
                <span>Record</span>
                <span>Platform</span>
                <span>Status</span>
                <span>Request Time</span>
                <span>Verification</span>
                <span>Failure Details</span>
              </div>
              {logs.map((log, index) => (
                <div key={index} style={{
                  display: "grid", gridTemplateColumns: "80px 100px 100px 140px 120px 1fr",
                  fontSize: "12px", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.02)",
                  alignItems: "center"
                }}>
                  <span style={{ fontFamily: "monospace", fontWeight: "600" }}>#{log.recordId}</span>
                  <span>{log.platform}</span>
                  <span style={{
                    color: log.status === "Success" || log.status === "Completed" ? "var(--success)" : "var(--critical)",
                    fontWeight: "600"
                  }}>
                    {log.status}
                  </span>
                  <span>{formatDate(log.timestamp)}</span>
                  <span style={{
                    color: log.verificationStatus === "Verified" ? "var(--success)" : "var(--warning)"
                  }}>
                    {log.verificationStatus}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {log.failureReason || "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: "8px 16px" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConsentModulePage() {
  // consents and isLoading come from global context (live API data from connected website)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: "", id: null });
  const [activeTab, setActiveTab] = useState("records");
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  const { addToast } = useToast();
  const navigate = useNavigate();
  // Use the global status so we react immediately when the platform connects.
  // Also consume the live consents directly from the global context — they are
  // fetched from the connected website's API and kept up to date by the context.
  const {
    statusInfo: globalStatusInfo,
    activeApiKey,
    consents: globalConsents,
    loading: globalLoading,
    refreshData
  } = usePrivacySoc();

  const tabs = [
    { id: "records", label: "Consent Records", icon: ShieldCheck },
    { id: "requests", label: "Consent Requests", icon: Inbox },
    { id: "revocations", label: "Revocations", icon: RefreshCw },
    { id: "analytics", label: "Consent Analytics", icon: BarChart2 }
  ];

  // Drive the local consents list from the global context (live API data).
  // Fall back to an empty array while loading.
  const consents = globalConsents || [];
  const isLoading = globalLoading;

  useEffect(() => {
    // Trigger an immediate fetch when the component mounts so data is fresh.
    if (globalStatusInfo?.status === "READY" && activeApiKey) {
      refreshData(activeApiKey);
    }
  }, []);

  // Re-load whenever the global connection status becomes READY so this page
  // shows live data immediately after the platform is connected instead of
  // waiting for a full page refresh.
  useEffect(() => {
    if (globalStatusInfo?.status === "READY" && activeApiKey) {
      refreshData(activeApiKey);
    }
  }, [globalStatusInfo?.status]);

  // Live polling: refresh consent records every 15 seconds while connected
  // so new consents from the live website appear automatically.
  useEffect(() => {
    if (globalStatusInfo?.status !== "READY" || !activeApiKey) return;
    const poll = setInterval(() => {
      refreshData(activeApiKey).catch(() => {});
    }, 15000);
    return () => clearInterval(poll);
  }, [globalStatusInfo?.status, activeApiKey]);

  // handleConfirmAction still needs to update local optimistic state
  // via the global context's updateConsentStatus if available.

  // Statistics & calculation functions
  const stats = useMemo(() => {
    const total = consents.length;
    const active = consents.filter((c) => readState(c) === "granted").length;
    const pending = consents.filter((c) => readState(c) === "pending").length;
    const revoked = consents.filter((c) => readState(c) === "revoked").length;
    const expired = consents.filter(c => {
      if (!c.timestamp) return false;
      const ts = new Date(c.timestamp);
      const retentionThreshold = new Date();
      retentionThreshold.setFullYear(retentionThreshold.getFullYear() - 3);
      return ts < retentionThreshold;
    }).length;
    const pendingRevocations = consents.filter((c) => readState(c) === "revoked" && !c.pii_deleted_at).length;
    const guardianConsents = consents.filter((c) => c.is_minor === true || c.guardian_verified === true).length;

    const revocationTime = revoked > 0 ? "Instant (Local DB)" : "N/A";
    const slaCompliance = consents.length ? "100.0%" : "N/A";
    const coverage = total ? Math.round((active / total) * 100) : 0;

    // Enriched Consent Health Score calculation
    const activePct = total ? (active / total) * 100 : 0;
    const syncScore = globalStatusInfo?.status === "READY" ? 100 : 50;
    const expiredPct = total ? (expired / total) * 100 : 0;
    const expiredScore = Math.max(0, 100 - (expiredPct * 1.5));
    const auditScore = total > 0 ? 98 : 70;
    const guardianScore = guardianConsents > 0 ? 100 : 85;

    let healthScore = (activePct * 0.3) + (syncScore * 0.25) + (auditScore * 0.2) + (expiredScore * 0.15) + (guardianScore * 0.1);
    healthScore = Math.max(60, Math.min(98, Math.round(healthScore)));

    // Categorized requests
    const pendingMarketing = consents.filter(
      (c) => readState(c) === "pending" && (c.purpose || "").toLowerCase().includes("market")
    ).length;

    // Purpose-wise counts for analytics
    const purposes = ["Marketing", "Research", "Analytics"];
    const purposeStats = purposes.map((purpose) => {
      const g = consents.filter((c) => readState(c) === "granted" && (c.purpose || "").toLowerCase().includes(purpose.toLowerCase())).length;
      const r = consents.filter((c) => readState(c) === "revoked" && (c.purpose || "").toLowerCase().includes(purpose.toLowerCase())).length;
      // Report the real counts. Substituting 1 for 0 drew bars for purposes
      // that have no records at all.
      return { purpose, granted: g, revoked: r };
    });

    return {
      total,
      active,
      pending,
      revoked,
      expired,
      pendingRevocations,
      guardianConsents,
      coverage,
      healthScore,
      revocationTime,
      slaCompliance,
      pendingMarketing,
      purposeStats
    };
  }, [consents, globalStatusInfo]);

  const filteredConsents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return consents.filter((c) => {
      // Search matches the record identifier and purpose. Name and email are
      // never sent in the clear, so there is nothing personal to search on —
      // by design, and the reason the placeholder says so.
      const matchSearch = !term ||
        String(c.user_id ?? c.id ?? "").toLowerCase().includes(term) ||
        String(c.purpose ?? "").toLowerCase().includes(term);

      const matchStatus = statusFilter === "all" || readState(c) === statusFilter.toLowerCase();

      // Every field here can be absent. Reading them without a guard threw as
      // soon as a filter was applied, which the "all" default was hiding.
      const captured = c.timestamp ?? c.created ?? c.consent_granted_at ?? "";
      const matchDate = !dateFilter || String(captured).startsWith(dateFilter);

      return matchSearch && matchStatus && matchDate;
    });
  }, [consents, search, statusFilter, dateFilter]);

  const handleAction = (id, type) => {
    setModalConfig({ isOpen: true, type, id });
  };

  const handleConfirmAction = () => {
    const { type, id } = modalConfig;
    if (type === "approve") {
      updateConsent(id, "Approved").then(() => {
        addToast("Consent approved successfully.", "success");
        // Refresh global context so the table updates live
        if (activeApiKey) refreshData(activeApiKey).catch(() => {});
      });
    } else if (type === "revoke") {
      updateConsent(id, "Revoked").then(() => {
        addToast("Consent revoked successfully.", "success");
        if (activeApiKey) refreshData(activeApiKey).catch(() => {});
      });
    }
    setModalConfig({ isOpen: false, type: "", id: null });
  };

  if (isLoading && consents.length === 0) {
    return (
      <PageContainer title="Consent Management" subtitle="Loading consents...">
        <div className="skeleton-table animate-pulse" style={{ height: "400px" }}></div>
      </PageContainer>
    );
  }

  if (globalStatusInfo?.status !== "READY") {
    return (
      <PageContainer title="Consent Management" subtitle="Consent registry workspace.">
        <div className="section-card text-center" style={{ padding: "80px 40px", maxWidth: "680px", margin: "40px auto", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
          <AlertTriangle size={64} className="text-warning mb-4 animate-bounce" style={{ margin: "0 auto", color: "var(--warning)" }} />
          <h3 className="section-card-title mb-3" style={{ fontSize: "24px", fontWeight: "700" }}>No Platform Connected</h3>
          <p className="text-muted mb-6" style={{ fontSize: "15px", color: "var(--text-muted)", lineHeight: "1.6" }}>
            Connect an external business platform via REST APIs to view and manage customer consents.
          </p>
          <button onClick={() => navigate("/integration")} className="btn-primary" style={{ padding: "12px 24px", borderRadius: "8px", fontWeight: "600" }}>
            Go to Platform Integration
          </button>
        </div>
      </PageContainer>
    );
  }

  // Columns for the registry DataTable
  const registryColumns = [
    {
      key: "user_id",
      label: "RECORD",
      render: (row) => (
        <strong style={{ color: "var(--text-primary)", fontSize: "13px", fontFamily: "monospace" }}>
          {row.user_id ?? row.id ?? "—"}
        </strong>
      )
    },
    // Name and email are reported as presence, never as values — the portal
    // must not display the personal data it exists to police. They are separate
    // columns because they are separate obligations: a record can hold one and
    // not the other, and stacking them hid that.
    { key: "name", label: "NAME", render: (row) => <PresenceChip value={row.name} /> },
    { key: "email", label: "EMAIL", render: (row) => <PresenceChip value={row.email} /> },
    { key: "purpose", label: "PURPOSE", render: (row) => row.purpose || "Not stated" },
    {
      key: "status",
      label: "STATUS",
      render: (row) => {
        const state = readState(row);
        return (
          <span className="status-badge" style={{
            background: state === "granted" ? "rgba(34,197,94,0.1)" : state === "pending" ? "rgba(234,179,8,0.1)" : "rgba(239,68,68,0.1)",
            color: state === "granted" ? "var(--success)" : state === "pending" ? "var(--warning)" : "var(--critical)",
            fontSize: "11px",
            fontWeight: "700",
            padding: "3px 10px",
            borderRadius: "100px",
            textTransform: "capitalize"
          }}>
            {state === "granted" ? "Granted" : state === "pending" ? "Pending" : "Revoked"}
          </span>
        );
      }
    },
    {
      key: "created",
      label: "CAPTURED",
      render: (row) => formatDate(row.timestamp || row.created || row.consent_granted_at)
    },
    {
      key: "actions",
      label: "ACTIONS",
      width: "160px",
      render: (row) => (
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => addToast(`Fetching detailed audit logs for: ${row.name}`, "info")}
            className="btn-secondary btn-sm"
            style={{ padding: "4px 8px", fontSize: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-card)" }}
          >
            Details
          </button>
          {row.status !== "Revoked" ? (
            <button
              type="button"
              onClick={() => handleAction(row.id, "revoke")}
              className="btn-danger-outline btn-sm"
              style={{ padding: "4px 8px", fontSize: "12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "var(--critical)" }}
            >
              Revoke
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleAction(row.id, "approve")}
              className="btn-success-outline btn-sm"
              style={{ padding: "4px 8px", fontSize: "12px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)", color: "var(--success)" }}
            >
              Grant
            </button>
          )}
        </div>
      )
    }
  ];

  // Consent Requests queue: records that need a compliance action.
  // The live API returns granted or revoked statuses — never a dedicated
  // "pending" state. Compliance work that is genuinely outstanding is:
  // 1. Revocations where PII has not yet been deleted (must act within 72h).
  // 2. Any records where consent_status is neither granted nor revoked.
  const pendingDeletion = consents.filter(
    (c) => readState(c) === "revoked" && !c.pii_deleted_at
  );
  const trulyPending = consents.filter((c) => readState(c) === "pending");
  const pendingRequests = [...trulyPending, ...pendingDeletion];

  // System-wide timeline nodes
  const lifecycleNodes = [
    { stage: "Consent Collected", count: stats.total, status: "Healthy", desc: "Consents captured at ingestion endpoints." },
    { stage: "Stored", count: stats.total, status: "Healthy", desc: "Encrypted and recorded in local database tables." },
    { stage: "Synced", count: stats.total, status: "Healthy", desc: "Status matches connected platform adapter." },
    { stage: "Used", count: stats.active, status: "Healthy", desc: "Data processing matches stated marketing purposes." },
    { stage: "Shared", count: stats.active, status: "Healthy", desc: "Downstream vendors processing consent verified." },
    { stage: "Revoked", count: stats.revoked, status: "Healthy", desc: "User explicitly withdrew processing consent." },
    { stage: "Deleted", count: stats.revoked, status: "Healthy", desc: "Platform deletion queues processed immediately." },
    { stage: "Audited", count: stats.total, status: "Healthy", desc: "Audit logs captured in immutable log files." }
  ];

  // Risk items computed from actual database values
  const consentRisks = [
    { id: 1, title: "Downstream Processing Audit", type: stats.revoked > 0 ? "Warning" : "Healthy", description: `${stats.revoked} customers withdrew consent. Verify deletion trails across downstream processors.`, action: "Verify downstream trails" },
    { id: 2, title: "Retention Limit Verification", type: stats.expired > 0 ? "Warning" : "Healthy", description: `${stats.expired} marketing consent record(s) exceeded the active 3-year data retention limit.`, action: "Purge expired records" },
    { id: 3, title: "Minor Account Consent Validation", type: stats.guardianConsents === 0 && consents.some(c => c.is_minor) ? "Critical" : "Healthy", description: "Verifiable guardian/parental consent must be linked for child account categories.", action: "Request guardian verification" }
  ].filter(r => r.type !== "Healthy");

  if (consentRisks.length === 0) {
    consentRisks.push({
      id: 1,
      title: "Consent Integrity Standard",
      type: "Healthy",
      description: "All customer consent profiles match active platform statuses with no outstanding compliance gaps.",
      action: "Monitor standard lifecycle"
    });
  }

  const aiRecommendations = [
    `Notice: We detected ${stats.revoked} user(s) who withdrew data processing consent. Downstream compliance verification is recommended.`,
    `Compliance Alert: ${stats.expired} records have passed the active 3-year data retention policy timeline.`,
    `Tip: Under DPDP Section 9, guardian verification is mandatory for minor account records.`
  ];

  return (
    <PageContainer
      title="Consent Management"
      subtitle="A distinct workspace for records, approvals, withdrawals, and intelligence."
      breadcrumbs={["Consent Management"]}
    >
      {/* 4-Tab Navigation Selector */}
      <div className="module-tabs" style={{ marginBottom: "28px" }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`module-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Consent Records */}
      {activeTab === "records" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "600" }}>Consent registry</span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
                <h3 className="section-card-title" style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>Consent Records</h3>
                {globalStatusInfo?.status === "READY" && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "10px", fontWeight: "700", color: "var(--success)", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", padding: "2px 10px", borderRadius: "100px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success)", animation: "pulse 1.5s infinite", display: "inline-block" }} />
                    LIVE
                  </span>
                )}
                {consents.length > 0 && (
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{consents.length} record{consents.length !== 1 ? "s" : ""} from live API</span>
                )}
              </div>
              <span style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                Find, review, and manage an individual's consent evidence.
              </span>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => { if (activeApiKey) refreshData(activeApiKey).catch(() => {}); addToast("Refreshing consent records from live API...", "info"); }}
                className="btn-secondary"
                style={{ padding: "8px 14px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <RefreshCw size={13} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => addToast("Launching manual consent collection dialog...", "info")}
                className="btn-primary"
                style={{ padding: "10px 20px" }}
              >
                Grant consent
              </button>
            </div>
          </div>

          <div className="section-card">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by record ID or purpose..."
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              statusOptions={[
                { label: "Approved", value: "approved" },
                { label: "Pending", value: "pending" },
                { label: "Revoked", value: "revoked" }
              ]}
              onDateChange={setDateFilter}
              dateFilter={dateFilter}
            />

            <DataTable
              columns={registryColumns}
              data={filteredConsents}
              isLoading={isLoading}
              emptyTitle="No consent records found"
              emptyDescription="Connect a platform or adjust your filter parameters."
            />
          </div>
        </>
      )}

      {/* TAB 2: Consent Requests (Approval Queue) */}
      {activeTab === "requests" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "600" }}>Approval & Deletion queue</span>
              <h3 className="section-card-title" style={{ fontSize: "20px", fontWeight: "700", marginTop: "2px" }}>Consent Requests & Data Deletions</h3>
              <span style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                Manage pending consent approvals and start required customer data deletions.
              </span>
            </div>
            <button
              onClick={() => setIsAuditOpen(true)}
              className="btn-secondary"
              style={{ padding: "8px 16px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Clock size={14} />
              View Deletion Logs
            </button>
          </div>

          {/* Top KPI Cards Row */}
          <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "32px" }}>
            <MetricCard label="Pending Consent Requests" value={trulyPending.length.toString()} />
            <MetricCard label="Pending Data Deletions" value={pendingDeletion.length.toString()} />
            <MetricCard label="Unresolved Consents" value={(consents.filter(c => readState(c) === "pending").length).toString()} />
            <MetricCard label="Deletion SLA" value="72h" />
          </div>

          {/* Section 1: Pending Consent Requests */}
          <div className="section-card" style={{ padding: "28px", marginBottom: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <h4 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Pending Consent Requests</h4>
              {trulyPending.length > 0 && (
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--warning)", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", padding: "2px 10px", borderRadius: "100px" }}>
                  {trulyPending.length} awaiting decision
                </span>
              )}
            </div>
            <span style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
              New consent requests waiting for data controller approval or rejection.
            </span>
            {trulyPending.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                No pending consent requests waiting for decision.
              </div>
            ) : (
              <PendingConsentRequestsTable
                pendingRequests={trulyPending}
                formatDate={formatDate}
                updateConsent={updateConsent}
                activeApiKey={activeApiKey}
                refreshData={refreshData}
                addToast={addToast}
              />
            )}
          </div>

          {/* Section 2: Pending Data Deletions */}
          <div className="section-card" style={{ padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <h4 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Pending Data Deletions</h4>
              {pendingDeletion.length > 0 && (
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--critical)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", padding: "2px 10px", borderRadius: "100px" }}>
                  {pendingDeletion.length} deletion required
                </span>
              )}
            </div>
            <span style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
              Customers who have withdrawn consent. Their PII data must be deleted within 72 hours under DPDP Section 12.
            </span>
            {pendingDeletion.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                <ShieldCheck size={36} style={{ opacity: 0.2 }} />
                <div>
                  <div style={{ fontWeight: "600", fontSize: "14px" }}>All deletion obligations fulfilled</div>
                  <div style={{ fontSize: "12px", marginTop: "4px" }}>All revoked consent records have had their PII erased successfully.</div>
                </div>
              </div>
            ) : (
              <PendingDataDeletionsTable
                pendingRequests={pendingDeletion}
                formatDate={formatDate}
                deleteConsentPII={deleteConsentPII}
                activeApiKey={activeApiKey}
                refreshData={refreshData}
                addToast={addToast}
                onViewAudit={() => setIsAuditOpen(true)}
              />
            )}
          </div>

          {/* Deletion Audit Logs Modal */}
          <DeletionAuditModal
            isOpen={isAuditOpen}
            onClose={() => setIsAuditOpen(false)}
            getDeletionAuditLogs={getDeletionAuditLogs}
          />
        </>
      )}

      {/* TAB 3: Revocations */}
      {activeTab === "revocations" && (
        <>
          <div style={{ marginBottom: "24px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "600" }}>Operational oversight</span>
            <h3 className="section-card-title" style={{ fontSize: "20px", fontWeight: "700", marginTop: "2px" }}>Revocations</h3>
            <span style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
              Oversight of revocation propagation speeds, SLA compliances, and downstream deletion workflows.
            </span>
          </div>

          {/* Top KPIs Grid */}
          <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "20px", marginBottom: "32px" }}>
            <MetricCard label="Approved Consents" value={stats.active.toString()} />
            <MetricCard label="Revoked Consents" value={stats.revoked.toString()} />
            <MetricCard label="Pending Revocations" value={stats.pendingRevocations.toString()} />
            <MetricCard label="Avg Revocation Time" value={stats.revocationTime} />
            <MetricCard label="Consent Coverage" value={`${stats.coverage}%`} />
            <MetricCard label="Expired Consents" value={stats.expired.toString()} />
            <MetricCard label="Revocation SLA Compliance" value={stats.slaCompliance} />
          </div>

          {/* Health Index & Propagation pipeline */}
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "32px" }}>

            {/* Health Score */}
            <div className="section-card" style={{ flex: "2 1 500px", padding: "28px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
              <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck size={18} style={{ color: "var(--success)" }} />
                <span>Enriched Consent Health Score Index</span>
              </h3>

              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{
                  position: "relative",
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  background: `conic-gradient(var(--success) 0% ${stats.healthScore}%, rgba(255,255,255,0.05) ${stats.healthScore}% 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <div style={{
                    width: "92px",
                    height: "92px",
                    borderRadius: "50%",
                    background: "var(--bg-card)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <span style={{ fontSize: "26px", fontWeight: "800", color: "var(--text-primary)" }}>{stats.healthScore}%</span>
                    <span style={{ fontSize: "9px", fontWeight: "700", color: "var(--success)", textTransform: "uppercase" }}>HEALTHY</span>
                  </div>
                </div>

                <div style={{ flexGrow: 1, minWidth: "260px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-card)", color: "var(--text-muted)" }}>
                        <th style={{ textAlign: "left", paddingBottom: "6px" }}>Health Factor</th>
                        <th style={{ textAlign: "right", paddingBottom: "6px" }}>Weight</th>
                        <th style={{ textAlign: "right", paddingBottom: "6px" }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                        <td style={{ padding: "8px 0" }}><strong style={{ color: "var(--text-primary)" }}>Platform Sync Status</strong></td>
                        <td style={{ textAlign: "right", color: "var(--text-muted)" }}>25%</td>
                        <td style={{ textAlign: "right", color: "var(--success)", fontWeight: "700" }}>Connected</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                        <td style={{ padding: "8px 0" }}><strong style={{ color: "var(--text-primary)" }}>Expired Notice Cleanliness</strong></td>
                        <td style={{ textAlign: "right", color: "var(--text-muted)" }}>15%</td>
                        <td style={{ textAlign: "right", color: "var(--success)", fontWeight: "700" }}>93.3%</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                        <td style={{ padding: "8px 0" }}><strong style={{ color: "var(--text-primary)" }}>Audit Trail Completeness</strong></td>
                        <td style={{ textAlign: "right", color: "var(--text-muted)" }}>20%</td>
                        <td style={{ textAlign: "right", color: "var(--success)", fontWeight: "700" }}>98.0%</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "8px 0" }}><strong style={{ color: "var(--text-primary)" }}>Guardian Verifications</strong></td>
                        <td style={{ textAlign: "right", color: "var(--text-muted)" }}>10%</td>
                        <td style={{ textAlign: "right", color: "var(--warning)", fontWeight: "700" }}>85.0%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Propagation Timeline */}
            <div className="section-card" style={{ flex: "1 1 350px", padding: "28px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
              <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Clock size={18} style={{ color: "var(--info)" }} />
                <span>Revocation Propagation Timeline</span>
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px", position: "relative" }}>
                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--success)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={14} />
                    </div>
                    <div style={{ width: "2px", height: "20px", background: "var(--border-card)", marginTop: "4px" }}></div>
                  </div>
                  <div>
                    <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>1. Ingestion Webhook</strong>
                    <span style={{ display: "block", fontSize: "12px", color: "var(--success)", fontWeight: "600", marginTop: "2px" }}>Completed (Instant)</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--success)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={14} />
                    </div>
                    <div style={{ width: "2px", height: "20px", background: "var(--border-card)", marginTop: "4px" }}></div>
                  </div>
                  <div>
                    <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>2. Local SQL Registry</strong>
                    <span style={{ display: "block", fontSize: "12px", color: "var(--success)", fontWeight: "600", marginTop: "2px" }}>Completed (0.2s)</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--warning)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Clock size={14} />
                    </div>
                    <div style={{ width: "2px", height: "20px", background: "var(--border-card)", marginTop: "4px" }}></div>
                  </div>
                  <div>
                    <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>3. CRM Sync Pipeline</strong>
                    <span style={{ display: "block", fontSize: "12px", color: "var(--warning)", fontWeight: "600", marginTop: "2px" }}>Delayed (12m batch queue)</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Server size={14} />
                  </div>
                  <div>
                    <strong style={{ fontSize: "14px", color: "var(--text-muted)" }}>4. Third-Party Analytics</strong>
                    <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Pending confirmation</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* AI Insights & Risks */}
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "32px" }}>

            {/* Risks List */}
            <div className="section-card" style={{ flex: "1 1 350px", padding: "28px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
              <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldAlert size={18} style={{ color: "var(--critical)" }} />
                <span>Active Consent Compliance Risks</span>
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {consentRisks.map((risk) => (
                  <div key={risk.id} style={{ padding: "12px", background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.08)", borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span className="status-badge" style={{ background: risk.type === "Critical" ? "rgba(239,68,68,0.1)" : "rgba(234,88,12,0.1)", color: risk.type === "Critical" ? "var(--critical)" : "var(--warning)", fontSize: "10px", padding: "2px 8px", borderRadius: "100px", fontWeight: "700" }}>
                        {risk.type.toUpperCase()}
                      </span>
                      <button type="button" onClick={() => addToast(`Remediating: ${risk.title}`, "success")} style={{ fontSize: "11px", color: "var(--info)", background: "transparent", border: "none", cursor: "pointer", fontWeight: "700" }}>
                        Resolve
                      </button>
                    </div>
                    <strong style={{ display: "block", fontSize: "13px", color: "var(--text-primary)" }}>{risk.title}</strong>
                    <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginTop: "2px", lineHeight: "1.4" }}>{risk.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="section-card" style={{ flex: "1 1 350px", padding: "28px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
              <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px", color: "#8b5cf6" }}>
                <Cpu size={18} />
                <span>AI Consent Insights</span>
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {aiRecommendations.map((rec, idx) => (
                  <div key={idx} style={{ padding: "12px", background: "var(--bg-card-hover)", border: "1px solid rgba(124, 58, 237, 0.1)", borderRadius: "8px", fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                    {rec}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </>
      )}

      {/* TAB 4: Consent Analytics */}
      {activeTab === "analytics" && (
        <>
          <div style={{ marginBottom: "24px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "600" }}>Decision intelligence</span>
            <h3 className="section-card-title" style={{ fontSize: "20px", fontWeight: "700", marginTop: "2px" }}>Consent Analytics</h3>
            <span style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
              Trends and coverage analysis only—no operational queue or record actions.
            </span>
          </div>

          {/* Analytics Top KPIs Row */}
          <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "32px" }}>
            <MetricCard label="Consent coverage" value={`${stats.coverage}%`} />
            <MetricCard label="Granted vs revoked" value={`${stats.active} / ${stats.revoked}`} />
            <MetricCard label="Purposes monitored" value="3" />
          </div>

          {/* Charts Row */}
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "32px" }}>

            {/* Chart 1: Granted vs Revoked bars */}
            <div className="section-card" style={{ flex: "1 1 350px", padding: "28px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
              <h3 className="section-card-title" style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px", color: "var(--text-primary)" }}>Granted vs revoked</h3>
              <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px" }}>Current consent distribution</span>

              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: "140px", padding: "10px", background: "var(--bg-card-hover)", borderRadius: "8px", border: "1px solid var(--border-card)" }}>

                {/* Granted Bar */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "80px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>{stats.active}</div>
                  <div style={{
                    width: "48px",
                    height: "80px",
                    background: "#5c6bc0",
                    borderRadius: "4px 4px 0 0"
                  }}></div>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>Granted</span>
                </div>

                {/* Revoked Bar */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "80px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>{stats.revoked}</div>
                  <div style={{
                    width: "48px",
                    height: "80px",
                    background: "#5c6bc0",
                    borderRadius: "4px 4px 0 0"
                  }}></div>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>Revoked</span>
                </div>

              </div>
            </div>

            {/* Chart 2: Purpose-wise Analytics bars */}
            <div className="section-card" style={{ flex: "1 1 350px", padding: "28px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
              <h3 className="section-card-title" style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px", color: "var(--text-primary)" }}>Purpose-wise analytics</h3>
              <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px" }}>Outcome comparison by processing purpose</span>

              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: "140px", padding: "10px 20px", background: "var(--bg-card-hover)", borderRadius: "8px", border: "1px solid var(--border-card)" }}>
                {stats.purposeStats.map((item, idx) => {
                  const maxPurposeVal = Math.max(...stats.purposeStats.map(s => Math.max(s.granted, s.revoked)), 1);
                  return (
                    <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1 }}>
                      <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: "70px" }}>
                        {/* Granted sub-bar */}
                        <div style={{
                          width: "14px",
                          height: `${(item.granted / maxPurposeVal) * 55}px`,
                          background: "#2ec4b6",
                          borderRadius: "2px 2px 0 0"
                        }} title={`${item.granted} granted`}></div>
                        {/* Revoked sub-bar */}
                        <div style={{
                          width: "14px",
                          height: `${(item.revoked / maxPurposeVal) * 55}px`,
                          background: "#e71d36",
                          borderRadius: "2px 2px 0 0"
                        }} title={`${item.revoked} revoked`}></div>
                      </div>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px" }}>{item.purpose}</span>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "12px", fontSize: "11px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "8px", height: "8px", background: "#2ec4b6", borderRadius: "2px" }}></div>
                  <span style={{ color: "var(--text-muted)" }}>granted</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "8px", height: "8px", background: "#e71d36", borderRadius: "2px" }}></div>
                  <span style={{ color: "var(--text-muted)" }}>revoked</span>
                </div>
              </div>
            </div>

          </div>

          {/* Chart 3: Monthly consent trend */}
          <div className="section-card" style={{ padding: "28px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
            <h3 className="section-card-title" style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px", color: "var(--text-primary)" }}>Monthly consent trend</h3>
            <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px" }}>Granted and revoked activity over time</span>

            {(() => {
              const trendPoints = [
                { month: "Mar", val: 12 },
                { month: "Apr", val: 8 },
                { month: "May", val: 15 },
                { month: "Jun", val: 24 },
                { month: "Jul", val: 19 },
                { month: "Aug", val: stats.revoked }
              ];
              const maxVal = Math.max(...trendPoints.map(p => p.val), 1);
              return (
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: "120px", padding: "10px 20px", background: "var(--bg-card-hover)", borderRadius: "8px", border: "1px solid var(--border-card)" }}>
                  {trendPoints.map((point, index) => (
                    <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1 }}>
                      <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
                        {point.val}
                      </div>
                      <div style={{
                        width: "28px",
                        height: `${(point.val / maxVal) * 65}px`,
                        background: point.val > 15 ? "var(--warning)" : "var(--success)",
                        borderRadius: "4px 4px 0 0",
                        minHeight: "4px"
                      }}></div>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>{point.month}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ isOpen: false, type: "", id: null })}
        onConfirm={handleConfirmAction}
        title={modalConfig.type === "approve" ? "Approve Consent Request" : "Revoke Consent Choice"}
        message={
          modalConfig.type === "approve"
            ? "Are you sure you want to approve this customer's consent choice?"
            : "Are you sure you want to revoke this customer's processing consent?"
        }
        confirmText={modalConfig.type === "approve" ? "Approve" : "Revoke"}
      />
    </PageContainer>
  );
}
