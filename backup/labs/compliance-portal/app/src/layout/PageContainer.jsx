import React from "react";
import PageHeader from "../components/common/PageHeader";

export default function PageContainer({ title, subtitle, breadcrumbs = [], actionButton, children }) {
  return (
    <div className="workspace-shell">
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        actionButton={actionButton}
      />
      <div className="page-content-body">
        {children}
      </div>
    </div>
  );
}
