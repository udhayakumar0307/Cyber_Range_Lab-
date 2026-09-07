import { AlertTriangle, Calendar, CheckCircle2, Database, Gauge, Moon, Sun, Users } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import ApiKeyConnector from "../components/ApiKeyConnector.jsx";
import BreachNotification from "../components/BreachNotification.jsx";
import ConsentCharts from "../components/ConsentCharts.jsx";
import DpdpComplianceOverview from "../components/DpdpComplianceOverview.jsx";
import FilterBar from "../components/FilterBar.jsx";
import KpiCard from "../components/KpiCard.jsx";
import NavigationTabs from "../components/NavigationTabs.jsx";
import PiiMapping from "../components/PiiMapping.jsx";
import ReadinessModules from "../components/ReadinessModules.jsx";
import DpiaEntry from "../components/DpiaEntry.jsx";
import { fetchConsents } from "../services/consentApi.js";
import { fetchPiiResults as fetchPiiData } from "../services/piiApi.js";
import { getRopaRegisterForApiKey } from "../../data/ropaRegister.js";
import {
  calculateKpis,
  filterConsents,
  getPurposeChartData,
  getStatusChartData,
  toCsv
} from "../utils/consentMetrics.js";
import { calculateDpdpCompliance } from "../utils/dpdpCompliance.js";
import { calculateReadinessScores } from "../utils/readinessScores.js";

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

export default function Dashboard() {
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [purpose, setPurpose] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem("ddsActiveApiKey") || "";
    } catch (_) {
      return "";
    }
  });
  const [activeApiKey, setActiveApiKey] = useState(() => {
    try {
      return localStorage.getItem("ddsActiveApiKey") || "";
    } catch (_) {
      return "";
    }
  });
  const [nightMode, setNightMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [activeTab, setActiveTab] = useState("overview");
  const [piiCount, setPiiCount] = useState(0);
  const [recentAuditDate, setRecentAuditDate] = useState(() => {
    const currentRopa = getRopaRegisterForApiKey("");
    if (!currentRopa || !currentRopa.length) return Date.now();
    return Math.max(...currentRopa.map((item) => new Date(item.lastReviewed).getTime()));
  });

  useEffect(() => {
    let active = true;

    // Recalculate audit date for the connected API key
    const currentRopa = getRopaRegisterForApiKey(activeApiKey);
    if (currentRopa && currentRopa.length) {
      const maxDate = Math.max(...currentRopa.map((item) => new Date(item.lastReviewed).getTime()));
      setRecentAuditDate(maxDate);
    }

    if (!activeApiKey) {
      setConsents([]);
      setLoading(false);
      setError("");
      return () => {
        active = false;
      };
    }

    setLoading(true);
    fetchConsents(activeApiKey)
      .then((data) => {
        if (active) {
          setConsents(data);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    fetchPiiData(activeApiKey)
      .then((data) => {
        if (active) {
          let list = [];
          if (Array.isArray(data)) {
            list = data;
          } else if (data && typeof data === "object") {
            const arrayVal = Object.values(data).find(val => Array.isArray(val));
            list = arrayVal ? arrayVal : (data.results || [data]);
          } else {
            list = [data];
          }
          setPiiCount(list.length);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [activeApiKey]);

  useEffect(() => {
    document.documentElement.dataset.theme = nightMode ? "dark" : "light";
    localStorage.setItem("theme", nightMode ? "dark" : "light");
  }, [nightMode]);

  const filteredConsents = useMemo(
    () => filterConsents(consents, purpose, searchTerm),
    [consents, purpose, searchTerm]
  );

  const kpis = useMemo(() => calculateKpis(filteredConsents), [filteredConsents]);
  const statusData = useMemo(() => getStatusChartData(filteredConsents), [filteredConsents]);
  const purposeData = useMemo(() => getPurposeChartData(filteredConsents), [filteredConsents]);
  const dpdpCompliance = useMemo(
    () => calculateDpdpCompliance(consents, Boolean(activeApiKey)),
    [consents, activeApiKey]
  );
  const readinessScores = useMemo(
    () => calculateReadinessScores({ kpis, dpdpCompliance, apiKey: activeApiKey }),
    [kpis, dpdpCompliance, activeApiKey]
  );

  const nextAuditDateStr = useMemo(() => {
    const nextDate = new Date(recentAuditDate);
    nextDate.setFullYear(nextDate.getFullYear() + 1);
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(nextDate);
  }, [recentAuditDate]);

  function handleExport() {
    const csv = toCsv(filteredConsents);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "consent-dashboard-data.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleApiKeySubmit(event) {
    event.preventDefault();
    const trimmed = apiKey.trim();
    setActiveApiKey(trimmed);
    try {
      localStorage.setItem("ddsActiveApiKey", trimmed);
    } catch (_) {}
  }

  const hasConnectedConsentDatabase = Boolean(activeApiKey);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Consent Management</p>
          <h1>Data Discovery System</h1>
          <p className="subtitle">
            Monitor consent, DPDP readiness, PII classification, and ROPA/DPIA posture from one
            operational dashboard.
          </p>
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setNightMode((current) => !current)}
          aria-label={nightMode ? "Switch to day mode" : "Switch to night mode"}
          title={nightMode ? "Switch to day mode" : "Switch to night mode"}
        >
          {nightMode ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
        </button>
      </header>

      <ApiKeyConnector
        apiKey={apiKey}
        connected={Boolean(activeApiKey)}
        loading={loading}
        onApiKeyChange={setApiKey}
        onConnect={handleApiKeySubmit}
      />

      <NavigationTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {loading && <div className="notice">Loading consent records...</div>}
      {error && <div className="notice error">Error: {error}</div>}

      {!loading && !error && !hasConnectedConsentDatabase && (
        <section className="panel empty-dashboard-panel" aria-label="Empty dashboard state">
          <Database size={34} aria-hidden="true" />
          <h2>Connect a consent database to view dashboard insights</h2>
          <p>
            Paste a consent database API key and click Sync to load consent records, charts, DPDP
            score, PII mapping, and ROPA/DPIA analytics.
          </p>
        </section>
      )}

      {!loading && !error && hasConnectedConsentDatabase && consents.length === 0 && (
        <section className="panel empty-dashboard-panel" aria-label="No consent data state">
          <Database size={34} aria-hidden="true" />
          <h2>No consent records found</h2>
          <p>
            The connected consent service returned no records. Please check the configured data source.
          </p>
        </section>
      )}

      {!loading && !error && hasConnectedConsentDatabase && consents.length > 0 && (
        <>
          {activeTab === "overview" && (
            <>
              <ReadinessModules scores={readinessScores} nextAuditDateStr={nextAuditDateStr} onOpenModule={setActiveTab} />
              <DpdpComplianceOverview compliance={dpdpCompliance} />

              <section className="kpi-grid" aria-label="Data discovery summary metrics">
                <KpiCard
                  icon={CheckCircle2}
                  label="Consent Readiness"
                  value={`${readinessScores.consent}%`}
                  accent="#0f9f6e"
                />
                <KpiCard
                  icon={Gauge}
                  label="DPDP Score"
                  value={`${readinessScores.dpdp}%`}
                  accent="#2463eb"
                />
                <KpiCard
                  icon={Users}
                  label="PII Fields Mapped"
                  value={piiCount.toString()}
                  accent="#7c3aed"
                />
                <KpiCard
                  icon={Calendar}
                  label="Next DPIA Audit"
                  value={nextAuditDateStr}
                  accent="#ec4899"
                />
              </section>
            </>
          )}

          {activeTab === "consent" && (
            <>
              <FilterBar
                purpose={purpose}
                searchTerm={searchTerm}
                onPurposeChange={setPurpose}
                onSearchChange={setSearchTerm}
                onExport={handleExport}
              />

              <section className="kpi-grid" aria-label="Consent metrics">
                <KpiCard
                  icon={CheckCircle2}
                  label="Consents Granted"
                  value={formatPercent(kpis.grantedPercent)}
                  accent="#0f9f6e"
                />
                <KpiCard
                  icon={AlertTriangle}
                  label="Consents Revoked"
                  value={formatPercent(kpis.revokedPercent)}
                  accent="#d03801"
                />
                <KpiCard
                  icon={Gauge}
                  label="Revocation Rate"
                  value={formatPercent(kpis.revocationRate)}
                  accent="#2463eb"
                />
                <KpiCard
                  icon={Users}
                  label="Total Consents"
                  value={kpis.total.toLocaleString("en-IN")}
                  accent="#7c3aed"
                />
              </section>

              <ConsentCharts statusData={statusData} purposeData={purposeData} />
            </>
          )}

          {activeTab === "dpdp" && <DpdpComplianceOverview compliance={dpdpCompliance} />}
          {activeTab === "pii" && <PiiMapping activeApiKey={activeApiKey} />}
          {activeTab === "breach" && <BreachNotification />}
          {activeTab === "dpia-entry" && <DpiaEntry activeApiKey={activeApiKey} onAuditComplete={(date) => setRecentAuditDate(date.getTime())} />}
        </>
      )}
    </main>
  );
}
