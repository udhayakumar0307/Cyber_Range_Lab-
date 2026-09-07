import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  Settings,
  Shield,
  Scale,
  ShieldOff,
  Database,
  FileBarChart2,
  GitBranch,
  ShieldAlert,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { APP_NAME } from "../config/appConfig";
import { tenantConfig, isSingleTenant } from "../config/tenantConfig";

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const allMenuItems = [
    { path: "/", label: "Dashboard", icon: LayoutGrid },
    { path: "/integration", label: "Platform Integration", icon: GitBranch, multiOnly: true },
    { path: "/consent-management", label: "Consent Management", icon: Shield },
    { path: "/dpdp-compliance", label: "DPDP Compliance", icon: Scale },
    { path: "/pii-management", label: "PII Management", icon: ShieldAlert },
    { path: "/anonymization", label: "Anonymization", icon: ShieldOff },
    { path: "/reports", label: "Reports", icon: FileBarChart2 },
    { path: "/settings", label: "Settings", icon: Settings }
  ];

  // In single-tenant mode, hide items marked as multiOnly (e.g. Integration page)
  const menuItems = isSingleTenant
    ? allMenuItems.filter((item) => !item.multiOnly)
    : allMenuItems;

  return (
    <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-logo">
        <Database size={20} className="sidebar-logo-icon" />
        {!isCollapsed && <span className="logo-text">{tenantConfig.label}</span>}
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-nav-item ${isActive ? "active" : ""}`}
            >
              <Icon size={18} className="sidebar-icon" />
              {!isCollapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="sidebar-collapse-toggle"
      >
        {!isCollapsed && <span>COLLAPSE</span>}
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </div>
    </aside>
  );
}
