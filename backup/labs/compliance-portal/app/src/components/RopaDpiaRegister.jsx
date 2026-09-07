import React, { useMemo, useState } from "react";
import { FileCheck2, Search } from "lucide-react";
import { ropaRegister } from "../../data/ropaRegister.js";

function getRiskClass(risk) {
  return risk.toLowerCase();
}

export default function RopaDpiaRegister() {
  const [query, setQuery] = useState("");
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return ropaRegister;

    return ropaRegister.filter((item) =>
      [
        item.activity,
        item.purpose,
        item.owner,
        item.risk,
        item.dpiaStatus,
        item.dataCategories.join(" ")
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query]);

  const dpiaRequiredCount = ropaRegister.filter((item) => item.dpiaRequired === "Yes").length;
  const completedCount = ropaRegister.filter((item) =>
    ["Not Required", "Completed"].includes(item.dpiaStatus)
  ).length;
  const completionRate = Math.round((completedCount / ropaRegister.length) * 100);

  const lastAuditDateStr = useMemo(() => {
    if (!ropaRegister || !ropaRegister.length) return "N/A";
    const lastAuditTimestamp = Math.max(...ropaRegister.map((item) => new Date(item.lastReviewed).getTime()));
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(lastAuditTimestamp));
  }, []);

  return (
    <section className="module-section" aria-label="ROPA and DPIA register">
      <article className="panel module-hero-panel">
        <div className="module-hero-copy">
          <p className="eyebrow">Processing Register</p>
          <h2>ROPA & DPIA Register</h2>
          <p>
            Maintain processing activities, lawful basis, data categories, ownership, risk level,
            and DPIA status for DPDP readiness.
          </p>
        </div>
        <div className="module-score-block">
          <FileCheck2 size={26} aria-hidden="true" />
          <strong>{completionRate}%</strong>
          <span>DPIA posture</span>
        </div>
      </article>

      <section className="module-kpi-grid">
        <div className="module-stat">
          <span>Processing activities</span>
          <strong>{ropaRegister.length}</strong>
        </div>
        <div className="module-stat">
          <span>DPIA required</span>
          <strong>{dpiaRequiredCount}</strong>
        </div>
        <div className="module-stat">
          <span>High risk activities</span>
          <strong>{ropaRegister.filter((item) => item.risk === "High").length}</strong>
        </div>
        <div className="module-stat">
          <span>Owners assigned</span>
          <strong>{new Set(ropaRegister.map((item) => item.owner)).size}</strong>
        </div>
        <div className="module-stat">
          <span>Last Audit Date</span>
          <strong>{lastAuditDateStr}</strong>
        </div>
      </section>

      <section className="panel module-table-panel">
        <div className="section-heading module-heading-row">
          <div>
            <h2>Processing Activity Register</h2>
            <p>ROPA records and DPIA status for privacy risk tracking.</p>
          </div>
          <label className="compact-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ROPA"
            />
          </label>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>Purpose</th>
                <th>Data Categories</th>
                <th>Lawful Basis</th>
                <th>Owner</th>
                <th>Risk</th>
                <th>DPIA</th>
                <th>Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((item) => (
                <tr key={item.activity}>
                  <td>{item.activity}</td>
                  <td>{item.purpose}</td>
                  <td>{item.dataCategories.join(", ")}</td>
                  <td>{item.lawfulBasis}</td>
                  <td>{item.owner}</td>
                  <td>
                    <span className={`risk-pill ${getRiskClass(item.risk)}`}>{item.risk}</span>
                  </td>
                  <td>
                    <strong>{item.dpiaRequired}</strong>
                    <span className="field-name">{item.dpiaStatus}</span>
                  </td>
                  <td>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(item.lastReviewed))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
