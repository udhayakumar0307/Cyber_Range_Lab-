import React, { useEffect, useState } from "react";
import PageContainer from "../layout/PageContainer";
import { getSettingsData, updateSettingsData } from "../services/settingsService";
import { useToast } from "../context/ToastContext";
import DataTable from "../components/common/DataTable";
import StatusBadge from "../components/common/StatusBadge";

export default function Settings() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    getSettingsData()
      .then((res) => {
        setData(res);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const handleSave = async (section) => {
    try {
      await updateSettingsData(data);
      addToast(`${section} settings updated successfully.`, "success");
    } catch (err) {
      addToast(`Failed to update ${section} settings: ${err.message}`, "error");
    }
  };

  const handleInputChange = (section, key, value) => {
    setData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  if (isLoading || !data) {
    return (
      <PageContainer title="Settings" subtitle="Loading settings..." breadcrumbs={["Settings"]}>
        <div className="skeleton-card animate-pulse" style={{ height: "400px" }}></div>
      </PageContainer>
    );
  }

  const userColumns = [
    { key: "name", label: "User Name" },
    { key: "role", label: "Role" },
    { key: "email", label: "Email Address" },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />
    }
  ];

  const webhookColumns = [
    { key: "url", label: "Webhook Target Endpoint" },
    { key: "event", label: "Subscribed Event" },
    {
      key: "status",
      label: "Webhook Status",
      render: (row) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <PageContainer
      title="Settings"
      subtitle="Configure organization parameters, notification channels, data retention policies, and team users."
      breadcrumbs={["Settings"]}
    >
      <div className="settings-cards-stack-layout">
        
        {/* 1. Organization Details */}
        <div className="section-card">
          <h3 className="section-card-title">Organization Profile</h3>
          <div className="settings-fields-row">
            <div className="input-group">
              <label>Organization Name</label>
              <input 
                type="text" 
                value={data.organization.name || ""} 
                onChange={(e) => handleInputChange("organization", "name", e.target.value)} 
              />
            </div>
            <div className="input-group">
              <label>Industry</label>
              <select 
                value={data.organization.industry || "Technology"} 
                onChange={(e) => handleInputChange("organization", "industry", e.target.value)}
                className="filter-select"
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-card)", background: "var(--input-bg)", color: "var(--text-primary)" }}
              >
                <option value="Technology">Technology / Retail</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Financial">Financial / Banking</option>
              </select>
            </div>
            <div className="input-group">
              <label>Default Country</label>
              <input 
                type="text" 
                value={data.organization.country || ""} 
                onChange={(e) => handleInputChange("organization", "country", e.target.value)} 
              />
            </div>
            <div className="input-group">
              <label>Data Protection Officer (DPO)</label>
              <input 
                type="text" 
                value={data.organization.officer || ""} 
                onChange={(e) => handleInputChange("organization", "officer", e.target.value)} 
              />
            </div>
          </div>
          <button onClick={() => handleSave("Organization Profile")} className="btn-primary" style={{ marginTop: "12px" }}>
            Save Profile
          </button>
        </div>

        {/* 2. API Integration settings */}
        <div className="section-card">
          <h3 className="section-card-title">API Integration Defaults</h3>
          <div className="settings-fields-row">
            <div className="input-group">
              <label>Default Timeout (Seconds)</label>
              <input 
                type="number" 
                value={data.api.timeout || 30} 
                onChange={(e) => handleInputChange("api", "timeout", parseInt(e.target.value) || 0)} 
              />
            </div>
            <div className="input-group">
              <label>Default Sync Retry Limit</label>
              <input 
                type="number" 
                value={data.api.retry || 3} 
                onChange={(e) => handleInputChange("api", "retry", parseInt(e.target.value) || 0)} 
              />
            </div>
          </div>
          <button onClick={() => handleSave("API Integration Defaults")} className="btn-primary" style={{ marginTop: "12px" }}>
            Save API Settings
          </button>
        </div>

        {/* 3. Data Retention Policy */}
        <div className="section-card">
          <h3 className="section-card-title">Data Retention Policy</h3>
          <div className="settings-fields-row">
            <div className="input-group">
              <label>Customer Consent Duration</label>
              <input 
                type="text" 
                value={data.retention.defaultDuration || ""} 
                onChange={(e) => handleInputChange("retention", "defaultDuration", e.target.value)} 
              />
            </div>
            <div className="input-group">
              <label>Expired Records Action</label>
              <select 
                value={data.retention.expiredDeletion || "Automated purging"} 
                onChange={(e) => handleInputChange("retention", "expiredDeletion", e.target.value)}
                className="filter-select"
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-card)", background: "var(--input-bg)", color: "var(--text-primary)" }}
              >
                <option value="Automated purging">Automated Purging</option>
                <option value="Hold for review">Hold for Review</option>
                <option value="Archive only">Archive Only</option>
              </select>
            </div>
            <div className="input-group">
              <label>Audit Log Retention Period</label>
              <input 
                type="text" 
                value={data.retention.backupPeriod || ""} 
                onChange={(e) => handleInputChange("retention", "backupPeriod", e.target.value)} 
              />
            </div>
          </div>
          <button onClick={() => handleSave("Retention Policy")} className="btn-primary" style={{ marginTop: "12px" }}>
            Save Retention Policy
          </button>
        </div>

        {/* 4. Team Users List */}
        <div className="section-card">
          <h3 className="section-card-title">Team Access Management</h3>
          <DataTable columns={userColumns} data={data.users || []} />
        </div>

        {/* 5. Notification channels */}
        <div className="section-card">
          <h3 className="section-card-title">Notification Channels</h3>
          <div className="settings-fields-row">
            <div className="input-group">
              <label>Slack Channel Link</label>
              <input 
                type="text" 
                value={data.notifications.slackChannel || ""} 
                onChange={(e) => handleInputChange("notifications", "slackChannel", e.target.value)} 
              />
            </div>
          </div>
          <button onClick={() => handleSave("Notification Channels")} className="btn-primary" style={{ marginTop: "12px" }}>
            Save Notifications
          </button>
        </div>

        {/* 6. Active Webhooks list */}
        <div className="section-card">
          <h3 className="section-card-title">Event Webhooks</h3>
          <DataTable columns={webhookColumns} data={data.webhooks || []} />
        </div>
      </div>
    </PageContainer>
  );
}
