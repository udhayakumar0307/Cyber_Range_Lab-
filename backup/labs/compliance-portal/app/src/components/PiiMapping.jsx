import React, { useEffect, useState } from "react";
import { Database, Search } from "lucide-react";
import { getClassificationApiUrl } from "../config/appConfig.js";
import { requestJson } from "../services/apiClient.js";
import { fetchPiiResults } from "../services/piiApi.js";

const classificationUnavailableMessage =
  "Classification service is currently unavailable. Please configure the classification provider or contact your administrator.";

export default function PiiMapping({ activeApiKey }) {
  const [piiData, setPiiData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);

  const fetchGridData = async () => {
    setLoading(true);
    try {
      const { results } = await fetchPiiResults(activeApiKey);
      setPiiData(results);
      setError("");
    } catch (requestError) {
      console.warn("PII results request failed:", requestError);
      setPiiData([]);
      setError("PII discovery data is currently unavailable. Please try again or contact your administrator.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGridData();
  }, [activeApiKey]);

  const handleClassify = async () => {
    setIsClassifying(true);
    setError("");
    try {
      await requestJson(getClassificationApiUrl(), {
        headers: activeApiKey ? { "x-api-key": activeApiKey } : {}
      });
      await fetchGridData();
    } catch (requestError) {
      console.warn("PII classification request failed:", requestError);
      setError(classificationUnavailableMessage);
    } finally {
      setIsClassifying(false);
    }
  };

  const filteredData = piiData.filter((item) => {
    if (!item || !query) return Boolean(item);
    const normalized = query.toLowerCase();
    return Object.values(item).some((value) => String(value).toLowerCase().includes(normalized));
  });
  const columns = piiData.length > 0 && piiData[0] ? Object.keys(piiData[0]) : [];
  const hasData = piiData.length > 0;

  return (
    <section className="module-section" aria-label="PII Mapping">
      <article className="panel module-hero-panel">
        <div className="module-hero-copy">
          <p className="eyebrow">Data Discovery</p>
          <h2>PII Mapping Results</h2>
          <p>Review the personally identifiable information discovered across your integrated datasets.</p>
        </div>
        {hasData && (
          <div className="module-score-block">
            <Database size={26} aria-hidden="true" />
            <strong>{piiData.length}</strong>
            <span>Fields Mapped</span>
          </div>
        )}
      </article>

      <section className="panel module-table-panel">
        <div className="section-heading module-heading-row">
          <div>
            <h2>Discovered PII Fields</h2>
            <p>Automatically extracted attributes from the connected data source.</p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button type="button" onClick={handleClassify} disabled={isClassifying} className="action-primary">
              {isClassifying ? "Running discovery..." : "Run Discovery Scan"}
            </button>
            {hasData && (
              <label className="compact-search">
                <Search size={16} aria-hidden="true" />
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search PII data" />
              </label>
            )}
          </div>
        </div>

        {loading ? (
          <div className="notice" style={{ margin: "20px" }}>Loading PII discovery results...</div>
        ) : error ? (
          <div className="notice error" style={{ margin: "20px" }}>{error}</div>
        ) : !hasData ? (
          <div className="notice" style={{ margin: "20px" }}>
            <h3>PII Discovery</h3>
            <p>No data available. Connect a data source or run a discovery scan to begin identifying personal data.</p>
            <button type="button" className="action-primary" onClick={handleClassify} disabled={isClassifying}>Run Discovery Scan</button>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="notice" style={{ margin: "20px" }}>No PII fields match your search.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>{columns.map((column) => <th key={column} style={{ textTransform: "capitalize" }}>{column.replace(/_/g, " ")}</th>)}</tr></thead>
              <tbody>{filteredData.map((item, index) => <tr key={index}>{columns.map((column) => {
                const value = item[column];
                return <td key={column}>{typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)}</td>;
              })}</tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
