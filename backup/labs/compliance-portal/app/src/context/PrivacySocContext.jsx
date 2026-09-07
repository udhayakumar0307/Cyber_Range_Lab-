import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { fetchConsents } from "../services/consentApi.js";
import { fetchPiiResults } from "../services/piiApi.js";
import { calculateDpdpCompliance } from "../utils/dpdpCompliance.js";
import { calculateReadinessScores } from "../utils/readinessScores.js";
import { calculateKpis } from "../utils/consentMetrics.js";
import { getRopaRegisterForApiKey } from "../../data/ropaRegister.js";
import { API_BASE_URL } from "../config/appConfig";

const PrivacySocContext = createContext(null);

export const usePrivacySoc = () => {
  const context = useContext(PrivacySocContext);
  if (!context) {
    throw new Error("usePrivacySoc must be used within a PrivacySocProvider");
  }
  return context;
};

export const PrivacySocProvider = ({ children }) => {
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem("ddsActiveApiKey") || "cms_test_sk_8f2a91d7c4b64e3fa0d925b71e6a34c2";
    } catch (_) {
      return "cms_test_sk_8f2a91d7c4b64e3fa0d925b71e6a34c2";
    }
  });
  const [activeApiKey, setActiveApiKey] = useState(() => {
    try {
      return localStorage.getItem("ddsActiveApiKey") || "cms_test_sk_8f2a91d7c4b64e3fa0d925b71e6a34c2";
    } catch (_) {
      return "cms_test_sk_8f2a91d7c4b64e3fa0d925b71e6a34c2";
    }
  });

  const [consents, setConsents] = useState([]);
  const [statusInfo, setStatusInfo] = useState({ status: "NOT_CONNECTED", current_task: "Idle", progress: 0 });
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [piiCount, setPiiCount] = useState(0);
  const [piiFields, setPiiFields] = useState([]);
  const [navMode, setNavMode] = useState("developer"); // "executive" | "developer"
  const [showSearch, setShowSearch] = useState(false);

  // Audit date state
  const [recentAuditDate, setRecentAuditDate] = useState(() => {
    const currentRopa = getRopaRegisterForApiKey(activeApiKey);
    if (!currentRopa || !currentRopa.length) return Date.now();
    return Math.max(...currentRopa.map((item) => new Date(item.lastReviewed).getTime()));
  });

  // Mock Notifications list
  const [notifications, setNotifications] = useState([
    { id: 1, text: "Critical PII exposed: Credit Card tokens found in payment API logs", type: "critical", time: "10 mins ago", read: false },
    { id: 2, text: "Compliance decreased: Notice coverage dropped below 80%", type: "warning", time: "1 hour ago", read: false },
    { id: 3, text: "New API discovered: Analytics tracking endpoint detected", type: "info", time: "3 hours ago", read: true },
    { id: 4, text: "DPDP compliance audit completed successfully", type: "success", time: "1 day ago", read: true },
    { id: 5, text: "Consent expired: Guardian consent for child ID minors", type: "warning", time: "2 days ago", read: true },
  ]);

  // Sync API function
  const triggerSync = (newKey) => {
    const trimmed = newKey.trim();
    setActiveApiKey(trimmed);
    try {
      localStorage.setItem("ddsActiveApiKey", trimmed);
    } catch (_) {}
  };

  const refreshData = async (key = activeApiKey) => {
    setLoading(true);
    setError("");

    try {
      // fetchConsents now calls /api/v1/consents which the backend authenticates
      // using its own registered source key — no client API key needed.
      const [consentData, piiData] = await Promise.all([
        fetchConsents(),
        fetchPiiResults(key).catch(() => ({ results: [] }))
      ]);

      setConsents(Array.isArray(consentData) ? consentData : []);
      const list = piiData?.results || [];
      setPiiCount(list.length);
      setPiiFields(list);
      return { consentData, piiData };
    } catch (requestError) {
      setError(requestError.message || "Unable to refresh privacy data");
      setConsents([]);
      setPiiCount(0);
      setPiiFields([]);
      throw requestError;
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    setActiveApiKey("");
    setApiKey("");
    setConsents([]);
    setPiiCount(0);
    setPiiFields([]);
    try {
      localStorage.removeItem("ddsActiveApiKey");
    } catch (_) {}
  };

  const checkStatusAndLoad = async () => {
    try {
      const statusRes = await fetch(`${API_BASE_URL}/status`);
      if (!statusRes.ok) throw new Error();
      const statusData = await statusRes.json();
      setStatusInfo(statusData);

      // Store the masked key for display only — it is NOT used as an auth credential.
      // The actual data fetching goes through /api/v1/consents which the backend
      // authenticates itself using its own registered source key.
      const configRes = await fetch(`${API_BASE_URL}/integration/config`);
      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.connectionStatus === "Connected" && configData.apiKeyMasked) {
          // Only update display key; do NOT use as actual API credential
          setApiKey(configData.apiKeyMasked);
        }
      }

      if (statusData.status === "READY" || statusData.status === "SYNCING" || statusData.status === "ANALYZING") {
        const response = await fetch(`${API_BASE_URL}/dashboard`);
        if (response.ok) {
          const dashData = await response.json();
          setDashboardData(dashData);
        }
        // Fetch live consents directly from the CMS backend (no client key needed).
        // This runs on every poll cycle so the consent list stays fresh.
        refreshData().catch(() => {});
      }
      setDashboardLoading(false);
    } catch {
      setStatusInfo({ status: "NOT_CONNECTED", current_task: "Connection Failed", progress: 0 });
      setDashboardLoading(false);
    }
  };

  const forceRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/refresh`, { method: "POST" });
      if (response.ok) {
        await checkStatusAndLoad();
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    checkStatusAndLoad();
    const interval = setInterval(checkStatusAndLoad, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;

    const currentRopa = getRopaRegisterForApiKey(activeApiKey);
    if (currentRopa && currentRopa.length) {
      const maxDate = Math.max(...currentRopa.map((item) => new Date(item.lastReviewed).getTime()));
      setRecentAuditDate(maxDate);
    }

    if (!activeApiKey) {
      setConsents([]);
      setLoading(false);
      setError("");
      return;
    }

    refreshData(activeApiKey)
      .then((data) => {
        if (active && data?.consentData) {
          setNotifications(prev => [
            {
              id: Date.now(),
              text: `Database connected. Synced ${data.consentData.length} consent records successfully.`,
              type: "success",
              time: "Just now",
              read: false
            },
            ...prev
          ]);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message);
        }
      });

    return () => {
      active = false;
    };
  }, [activeApiKey]);

  // Pre-calculated DPDP compliance values
  const dpdpCompliance = useMemo(() => {
    return calculateDpdpCompliance(consents, Boolean(activeApiKey));
  }, [consents, activeApiKey]);

  const kpis = useMemo(() => {
    return calculateKpis(consents);
  }, [consents]);

  const readinessScores = useMemo(() => {
    return calculateReadinessScores({ kpis, dpdpCompliance, apiKey: activeApiKey });
  }, [kpis, dpdpCompliance, activeApiKey]);

  const nextAuditDateStr = useMemo(() => {
    const nextDate = new Date(recentAuditDate);
    nextDate.setFullYear(nextDate.getFullYear() + 1);
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(nextDate);
  }, [recentAuditDate]);

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markNotificationRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const addNotification = (text, type = "info") => {
    setNotifications(prev => [
      { id: Date.now(), text, type, time: "Just now", read: false },
      ...prev
    ]);
  };

  const updateConsentStatus = (userId, consent_status) => {
    setConsents((current) => current.map((record) => (
      record.user_id === userId
        ? { ...record, consent_status, timestamp: new Date().toISOString() }
        : record
    )));
    addNotification(`Consent ${consent_status} for ${userId}.`, consent_status === "revoked" ? "warning" : "success");
  };


  return (
    <PrivacySocContext.Provider
      value={{
        apiKey,
        setApiKey,
        activeApiKey,
        triggerSync,
        refreshData,
        disconnect,
        consents,
        loading,
        error,
        piiCount,
        piiFields,
        navMode,
        setNavMode,
        readinessScores,
        dpdpCompliance,
        kpis,
        recentAuditDate,
        setRecentAuditDate,
        nextAuditDateStr,
        notifications,
        markAllNotificationsRead,
        markNotificationRead,
        clearNotifications,
        addNotification,
        updateConsentStatus,
        showSearch,
        setShowSearch,
        statusInfo,
        dashboardData,
        dashboardLoading,
        isRefreshing,
        forceRefresh,
        checkStatusAndLoad
      }}
    >
      {children}
    </PrivacySocContext.Provider>
  );
};
