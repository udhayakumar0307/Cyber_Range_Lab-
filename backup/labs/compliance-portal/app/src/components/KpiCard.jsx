import React from "react";

export default function KpiCard({ icon: Icon, label, value, accent }) {
  return (
    <article className="kpi-card">
      <div className="kpi-icon" style={{ color: accent }}>
        <Icon size={22} aria-hidden="true" />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
