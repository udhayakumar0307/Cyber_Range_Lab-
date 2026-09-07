import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  ShieldCheck
} from "lucide-react";

function getScoreTone(score) {
  if (score >= 85) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "needs-action";
  return "critical";
}

export default function DpdpComplianceOverview({ compliance }) {
  const tone = getScoreTone(compliance.score);
  const topRules = compliance.rules.slice(0, 6);

  return (
    <section className="compliance-section" aria-label="DPDP compliance overview">
      <article className="panel compliance-score-panel">
        <div className="section-heading">
          <h2>Overall DPDP Compliance Score</h2>
          <p>Estimated readiness based on consent data quality and DPDP control coverage.</p>
        </div>

        <div className="compliance-score-layout">
          <div className={`score-ring ${tone}`} style={{ "--score": `${compliance.score}%` }}>
            <div>
              <strong>{compliance.score}%</strong>
              <span>{compliance.status}</span>
            </div>
          </div>

          <div className="compliance-summary">
            <div>
              <ShieldCheck size={22} aria-hidden="true" />
              <span>Rules reviewed</span>
              <strong>{compliance.rules.length}</strong>
            </div>
            <div>
              <FileWarning size={22} aria-hidden="true" />
              <span>Needs action</span>
              <strong>{compliance.actionRules.length}</strong>
            </div>
            <div>
              <AlertTriangle size={22} aria-hidden="true" />
              <span>Critical risks</span>
              <strong>{compliance.criticalRules.length}</strong>
            </div>
          </div>
        </div>
      </article>

      <article className="panel compliance-rules-panel">
        <div className="section-heading">
          <h2>DPDP Rule Coverage</h2>
          <p>Controls inspired by the DPDP compliance sheet and expanded for dashboard monitoring.</p>
        </div>

        <div className="rule-card-grid">
          {topRules.map((rule) => (
            <div className={`rule-card ${getScoreTone(rule.score)}`} key={rule.id}>
              <div className="rule-card-top">
                {rule.score >= 85 ? (
                  <CheckCircle2 size={18} aria-hidden="true" />
                ) : (
                  <ClipboardCheck size={18} aria-hidden="true" />
                )}
                <span>{rule.score}%</span>
              </div>
              <strong>{rule.name}</strong>
              <p>{rule.description}</p>
            </div>
          ))}
        </div>

        <div className="table-wrap compliance-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rule</th>
                <th>Name</th>
                <th>Score</th>
                <th>Compliant</th>
              </tr>
            </thead>
            <tbody>
              {compliance.rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.id}</td>
                  <td>{rule.name}</td>
                  <td>{rule.score}%</td>
                  <td>
                    <span className={`compliance-pill ${rule.compliant}`}>
                      {rule.compliant}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
