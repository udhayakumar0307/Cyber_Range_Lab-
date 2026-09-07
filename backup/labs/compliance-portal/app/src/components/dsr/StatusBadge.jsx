import React from 'react';

const statusClasses = {
  pending: 'default',
  in_review: 'info',
  awaiting_info: 'warning',
  resolved: 'success',
  rejected: 'danger',
  escalated: 'critical',
};

export default function StatusBadge({ status }) {
  const className = `dsr-badge ${statusClasses[status] || 'default'}`;
  return (
    <span className={className}>
      {status ? status.replace(/_/g, ' ') : 'N/A'}
    </span>
  );
}