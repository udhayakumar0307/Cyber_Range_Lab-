import React from 'react';

const typeClasses = {
  access: 'info',
  correction: 'warning',
  erasure: 'danger',
  grievance: 'critical',
  nomination: 'primary',
};

export default function RequestTypeBadge({ type }) {
  const className = `dsr-badge ${typeClasses[type] || 'default'}`;
  return (
    <span className={className}>
      {type ? type.replace(/_/g, ' ') : 'N/A'}
    </span>
  );
}