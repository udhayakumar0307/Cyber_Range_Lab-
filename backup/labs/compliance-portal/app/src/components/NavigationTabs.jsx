import React from "react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "consent", label: "Consent" },
  { id: "dpdp", label: "DPDP Score" },
  { id: "pii", label: "PII Mapping" },
  { id: "breach", label: "Breach Notification" },
  { id: "dpia-entry", label: "DPIA Entry" }
];

export default function NavigationTabs({ activeTab, onTabChange }) {
  return (
    <nav className="dashboard-tabs" aria-label="Dashboard modules">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={activeTab === tab.id ? "active" : ""}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
      