import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Search, Bell, User, ChevronDown, Sun, Moon,
  AlertTriangle, ShieldCheck, RefreshCw, XCircle, AlertCircle, Info, CheckCircle 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { STORE_NAME } from "../config/appConfig";
import { tenantConfig, isSingleTenant } from "../config/tenantConfig";
import { useTheme } from "../context/ThemeContext";
import { usePrivacySoc } from "../context/PrivacySocContext";
import { useToast } from "../context/ToastContext";

export default function Navbar() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef(null);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();

  const {
    notifications,
    markAllNotificationsRead,
    markNotificationRead,
    clearNotifications,
    statusInfo,
    dashboardData,
    isRefreshing,
    forceRefresh
  } = usePrivacySoc();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotification, setSelectedNotification] = useState(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleForceRefresh = async () => {
    addToast("Triggering full data sync & analysis pipeline...", "info");
    const success = await forceRefresh();
    if (success) {
      addToast("Sync and privacy analysis complete.", "success");
    } else {
      addToast("Failed to refresh dashboard. Check connection settings.", "error");
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "critical":
        return <XCircle size={16} style={{ color: "var(--critical)" }} />;
      case "warning":
        return <AlertCircle size={16} style={{ color: "var(--warning)" }} />;
      case "success":
        return <CheckCircle size={16} style={{ color: "var(--success)" }} />;
      default:
        return <Info size={16} style={{ color: "var(--info)" }} />;
    }
  };

  const complianceScoreVal = dashboardData ? parseInt(dashboardData?.kpis?.complianceScore || "0") : 100;
  const isHealthyScore = complianceScoreVal >= 80;

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <div className="navbar-search-container" style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255, 255, 255, 0.04)", border: "1px solid var(--border-card)", padding: "8px 16px", borderRadius: "8px", width: "260px" }}>
          <Search size={16} style={{ color: "#94a3b8", flexShrink: 0 }} />
          <input
            type="text"
            style={{ background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", width: "100%", fontSize: "0.88rem" }}
            placeholder="Search registry, logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                navigate(`/consent-management?q=${encodeURIComponent(searchQuery)}`);
              }
            }}
          />
        </div>
      </div>

      <div className="navbar-right">
        {/* Connected Store Title */}
        <span className="navbar-store-label">
          {isSingleTenant ? tenantConfig.label : STORE_NAME}
        </span>

        {/* Theme Toggle Button */}
        <button 
          className="nav-action-btn" 
          onClick={toggleTheme} 
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notifications Icon Button & Dropdown */}
        <div style={{ position: "relative" }} ref={notificationsRef}>
          <button 
            className="nav-action-btn" 
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
            style={{ position: "relative" }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute",
                top: "-4px",
                right: "-4px",
                background: "var(--critical)",
                color: "#fff",
                borderRadius: "50%",
                width: "16px",
                height: "16px",
                fontSize: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold"
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <span>Notifications</span>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllNotificationsRead} 
                      style={{ background: "none", border: "none", color: "var(--success)", fontSize: "11px", fontWeight: "600", cursor: "pointer", padding: 0 }}
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button 
                      onClick={clearNotifications} 
                      style={{ background: "none", border: "none", color: "var(--critical)", fontSize: "11px", fontWeight: "600", cursor: "pointer", padding: 0 }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              {/* Compliance Posture / Engine Status Section */}
              <div style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-card)",
                background: isHealthyScore 
                  ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)"
                  : "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)",
              }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <div style={{
                    background: isHealthyScore ? "var(--success)" : "var(--warning)",
                    color: "#ffffff",
                    padding: "4px",
                    borderRadius: "50%",
                    display: "inline-flex",
                    marginTop: "2px"
                  }}>
                    {isHealthyScore ? <ShieldCheck size={14} /> : <AlertTriangle size={14} />}
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <h4 style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>
                      {isHealthyScore ? "Governance Active & Compliant" : "Attention Required: Compliance Gaps"}
                    </h4>
                    <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                      {statusInfo.status !== "READY" 
                        ? `Privacy engine status: ${statusInfo.current_task} (${statusInfo.progress}%)`
                        : `Last audited: ${dashboardData?.systemHealth?.lastSync || "Just now"}.`
                      }
                    </p>
                    <button 
                      type="button" 
                      onClick={handleForceRefresh} 
                      disabled={isRefreshing}
                      style={{
                        marginTop: "8px",
                        width: "100%",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        cursor: isRefreshing ? "not-allowed" : "pointer",
                        border: "1px solid var(--border-card)",
                        background: "var(--bg-card)",
                        color: "var(--text-primary)",
                        fontSize: "11px",
                        fontWeight: "600"
                      }}
                    >
                      <RefreshCw size={10} className={isRefreshing ? "animate-spin" : ""} />
                      <span>Sync Engine</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div style={{ padding: "16px", textAlign: "center", color: "var(--text-soft)", fontSize: "0.82rem" }}>
                    No notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className="notification-item" 
                      style={{ opacity: n.read ? 0.6 : 1, cursor: "pointer" }}
                      onClick={() => {
                        setSelectedNotification(n);
                        markNotificationRead(n.id);
                      }}
                    >
                      <div style={{ marginTop: "2px" }}>
                        {getNotificationIcon(n.type)}
                      </div>
                      <div style={{ flexGrow: 1 }}>
                        <p style={{ margin: 0, color: "var(--text-primary)", lineHeight: "1.4", textAlign: "left" }}>{n.text}</p>
                        <span style={{ fontSize: "10px", color: "var(--text-soft)", display: "block", marginTop: "4px", textAlign: "left" }}>{n.time}</span>
                      </div>
                      {!n.read && <span className="notification-dot" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div style={{ position: "relative" }} ref={profileRef}>
          <button 
            className="nav-action-btn" 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            style={{ display: "flex", gap: "6px", alignItems: "center", padding: "4px 8px" }}
          >
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={16} style={{ color: "#475569" }} />
            </div>
            <ChevronDown size={14} style={{ color: "#64748b" }} />
          </button>

          {showProfileMenu && (
            <div className="profile-dropdown-menu">
              <div className="profile-dropdown-header">
                <p className="profile-name">Privacy Officer</p>
                <p className="profile-email">officer@acme.com</p>
              </div>
              <button 
                onClick={() => { navigate("/settings"); setShowProfileMenu(false); }} 
                className="profile-dropdown-item"
              >
                Profile & Settings
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Important Notification Detail Modal Popup */}
      {selectedNotification && createPortal(
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1050
        }}>
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "16px",
            width: "90%",
            maxWidth: "480px",
            padding: "24px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)"
          }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{
                background: selectedNotification.type === "critical" 
                  ? "rgba(239, 68, 68, 0.1)" 
                  : selectedNotification.type === "warning" 
                    ? "rgba(245, 158, 11, 0.1)" 
                    : selectedNotification.type === "success" 
                      ? "rgba(16, 185, 129, 0.1)" 
                      : "rgba(59, 130, 246, 0.1)",
                color: selectedNotification.type === "critical" 
                  ? "var(--critical)" 
                  : selectedNotification.type === "warning" 
                    ? "var(--warning)" 
                    : selectedNotification.type === "success" 
                      ? "var(--success)" 
                      : "var(--info)",
                padding: "8px",
                borderRadius: "50%",
                display: "inline-flex"
              }}>
                {getNotificationIcon(selectedNotification.type)}
              </div>
              <div style={{ flexGrow: 1 }}>
                <h4 style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: selectedNotification.type === "critical" 
                    ? "var(--critical)" 
                    : selectedNotification.type === "warning" 
                      ? "var(--warning)" 
                      : "var(--text-soft)"
                }}>
                  {selectedNotification.type} Notification
                </h4>
                <p style={{
                  margin: "8px 0 0 0",
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "var(--text-primary)",
                  lineHeight: "1.4"
                }}>
                  {selectedNotification.text}
                </p>
                <span style={{
                  fontSize: "11px",
                  color: "var(--text-soft)",
                  display: "block",
                  marginTop: "8px"
                }}>
                  Received: {selectedNotification.time || "Just now"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
              <button 
                onClick={() => setSelectedNotification(null)}
                className="btn-primary"
                style={{ padding: "8px 20px", fontSize: "12px", borderRadius: "8px" }}
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </nav>
  );
}
