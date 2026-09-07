import React from "react";

export default function MetricCard({ label, value, indicator, indicatorStatus, accentColor }) {
  const getIndicatorClass = () => {
    if (!indicatorStatus) return "";
    return `indicator-${indicatorStatus}`;
  };

  return (
    <div className="metric-card" style={accentColor ? { borderTop: `3px solid ${accentColor}` } : {}}>
      <div className="metric-card-label">{label}</div>
      <div className="metric-card-value-row">
        <span className="metric-card-value">{value}</span>
        {indicator && (
          <span className={`metric-card-indicator ${getIndicatorClass()}`}>
            {indicator}
          </span>
        )}
      </div>
    </div>
  );
}
