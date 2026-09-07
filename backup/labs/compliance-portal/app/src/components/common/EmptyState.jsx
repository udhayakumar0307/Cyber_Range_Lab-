import React from "react";
import { FolderOpen } from "lucide-react";

export default function EmptyState({ title = "No records found", description = "Try adjusting your search filters or check your data integration status." }) {
  return (
    <div className="empty-state-container">
      <div className="empty-state-icon">
        <FolderOpen size={40} className="text-muted" />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
    </div>
  );
}
