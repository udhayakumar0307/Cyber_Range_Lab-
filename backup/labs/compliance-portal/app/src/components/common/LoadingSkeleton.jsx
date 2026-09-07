import React from "react";

export function CardSkeleton() {
  return (
    <div className="skeleton-card animate-pulse">
      <div className="skeleton-line skeleton-title"></div>
      <div className="skeleton-line skeleton-body"></div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  const rowArray = Array.from({ length: rows });
  const colArray = Array.from({ length: cols });

  return (
    <div className="skeleton-table animate-pulse">
      <div className="skeleton-table-header">
        {colArray.map((_, i) => (
          <div key={i} className="skeleton-cell header-cell"></div>
        ))}
      </div>
      <div className="skeleton-table-body">
        {rowArray.map((_, ri) => (
          <div key={ri} className="skeleton-table-row">
            {colArray.map((_, ci) => (
              <div key={ci} className="skeleton-cell body-cell"></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LoadingSkeleton({ type = "table" }) {
  if (type === "card") {
    return <CardSkeleton />;
  }
  return <TableSkeleton />;
}
