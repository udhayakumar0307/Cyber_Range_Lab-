import React from "react";
import { formatStatus } from "../../utils/formatStatus";

export default function StatusBadge({ status, text }) {
  const badgeClass = formatStatus(status);
  return (
    <span className={`status-badge status-badge-${badgeClass}`}>
      {text || status}
    </span>
  );
}
