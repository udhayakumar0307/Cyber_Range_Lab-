import React from 'react';

const formatDate = (isoString) => {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export default function ActivityLogItem({ item }) {
  return (
    <div className="activity-log-item">
      <div className="activity-log-dot"></div>
      <div className="activity-log-content">
        <p><strong>{item.action.replace(/_/g, ' ')}</strong> by {item.performed_by} ({item.performed_by_role})</p>
        <small>{formatDate(item.created_at)}</small>
      </div>
    </div>
  );
}