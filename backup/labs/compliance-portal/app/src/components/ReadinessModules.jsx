import React from "react";
import { ClipboardCheck, Database, FileCheck2, ShieldCheck } from "lucide-react";

const MODULES = [
  {
    id: "consent",
    name: "Consent Management",
    description: "Track consent status, purpose coverage, and revocations.",
    icon: ClipboardCheck,
    color: "#0f9f6e"
  },
  {
    id: "dpdp",
    name: "DPDP Gap Review",
    description: "Review rule coverage and readiness gaps.",
    icon: ShieldCheck,
    color: "#2463eb"
  },
  {
    id: "pii",
    name: "PII Mapping",
    description: "Identify PII fields, sensitivity, owners, and safeguards.",
    icon: Database,
    color: "#7c3aed"
  },
  {
    id: "dpia-entry",
    name: "DPIA Assessment",
    description: "AI-assisted DPIA Entry and DPDP compliance reporting.",
    icon: FileCheck2,
    color: "#d97706"
  }
];

function getTone(score) {
  if (score >= 85) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "needs-action";
  return "critical";
}

export default function ReadinessModules({ scores, nextAuditDateStr, onOpenModule }) {
  return (
    <section className="readiness-grid" aria-label="DPDPA readiness modules">
      {MODULES.map((module) => {
        const Icon = module.icon;
        const isDpia = module.id === "dpia-entry";
        const score = scores?.[module.id] ?? 0;
        const displayValue = isDpia ? nextAuditDateStr : `${score}%`;
        const toneClass = isDpia ? "good" : getTone(score);

        return (
          <button
            key={module.id}
            type="button"
            className={`readiness-card ${toneClass}`}
            onClick={() => onOpenModule(module.id)}
          >
            <span className="readiness-icon" style={{ color: module.color }}>
              <Icon size={22} aria-hidden="true" />
            </span>
            <span>
              <strong>{module.name}</strong>
              <small>{module.description}</small>
            </span>
            <b style={isDpia ? { fontSize: "1.1rem" } : {}}>{displayValue}</b>
          </button>
        );
      })}
    </section>
  );
}
