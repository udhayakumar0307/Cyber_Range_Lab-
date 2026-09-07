import React, { useState, useEffect, useRef } from "react";
import { Search, Shield, Eye, AlertOctagon, Fingerprint, Calendar, User, CornerDownLeft } from "lucide-react";
import { usePrivacySoc } from "../context/PrivacySocContext.jsx";
import { useNavigate } from "react-router-dom";

export default function SpotlightSearch() {
  const { showSearch, setShowSearch } = usePrivacySoc();
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Global Ctrl+K trigger
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
      if (e.key === "Escape") {
        setShowSearch(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setShowSearch]);

  // Focus input when modal opens
  useEffect(() => {
    if (showSearch && inputRef.current) {
      inputRef.current.focus();
      setQuery("");
    }
  }, [showSearch]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSearch(false);
      }
    }
    if (showSearch) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSearch, setShowSearch]);

  if (!showSearch) return null;

  // Static searchable mock index representing endpoints, risks, classifications, rules
  const searchIndex = [
    {
      id: "payment-api-pii",
      title: "Payment API - PII Attributes",
      desc: "Credit Card, Aadhaar, PAN data exposed in headers",
      category: "PII Discovery",
      badge: "PII",
      badgeColor: "var(--critical)",
      icon: Fingerprint,
      route: "/pii"
    },
    {
      id: "payment-api-risk",
      title: "Payment API - Critical Vulnerability",
      desc: "Severity: Critical | Affected API: /api/v1/checkout",
      category: "Risk Center",
      badge: "Risk",
      badgeColor: "var(--critical)",
      icon: AlertOctagon,
      route: "/risks"
    },
    {
      id: "payment-api-owner",
      title: "Payment API - Owner",
      desc: "Assigned: john.doe@acme.com (Payments Dev Group)",
      category: "Owner",
      badge: "Owner",
      badgeColor: "var(--info)",
      icon: User,
      route: "/settings"
    },
    {
      id: "payment-api-compliance",
      title: "Payment API - Compliance Status",
      desc: "Section 8(5) Security Safeguards: Failed (Needs Encrypted Payload)",
      category: "DPDP Compliance",
      badge: "Compliance",
      badgeColor: "var(--warning)",
      icon: Shield,
      route: "/compliance"
    },
    {
      id: "payment-api-history",
      title: "Payment API - Scan History",
      desc: "Last scanned 10 mins ago | Completed with warnings",
      category: "History",
      badge: "History",
      badgeColor: "var(--text-soft)",
      icon: Calendar,
      route: "/scanner"
    },
    {
      id: "auth-gateway",
      title: "Authentication Gateway node",
      desc: "Secure JWT login endpoints mapped",
      category: "API Topology",
      badge: "Node",
      badgeColor: "var(--success)",
      icon: Shield,
      route: "/risks"
    },
    {
      id: "dsr-erasure-42",
      title: "DSR Request #1042 - User Erasure",
      desc: "Status: Pending | Applicant: anika@example.com",
      category: "DSR Requests",
      badge: "DSR",
      badgeColor: "var(--primary)",
      icon: User,
      route: "/dsr/requests"
    }
  ];

  const filteredResults = searchIndex.filter(item => 
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.desc.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleItemClick = (route) => {
    setShowSearch(false);
    navigate(route);
  };

  return (
    <div className="spotlight-backdrop">
      <div className="spotlight-container" ref={containerRef}>
        <div className="spotlight-header">
          <Search size={18} style={{ color: "var(--text-muted)" }} />
          <input
            ref={inputRef}
            type="text"
            className="spotlight-input"
            placeholder="Type to search endpoints, owners, risks, DSR logs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span style={{ fontSize: "0.72rem", color: "var(--text-soft)", border: "1px solid var(--border-card)", padding: "2px 6px", borderRadius: "4px" }}>
            ESC to close
          </span>
        </div>

        <div className="spotlight-results">
          {filteredResults.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-soft)" }}>
              No results found for "{query}"
            </div>
          ) : (
            filteredResults.map(item => {
              const IconComp = item.icon;
              return (
                <div key={item.id} className="spotlight-item" onClick={() => handleItemClick(item.route)}>
                  <div className="spotlight-item-left">
                    <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px", borderRadius: "6px", color: "var(--primary)" }}>
                      <IconComp size={16} />
                    </div>
                    <div>
                      <p className="spotlight-item-title">{item.title}</p>
                      <p className="spotlight-item-desc">{item.desc}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span 
                      className="spotlight-item-badge" 
                      style={{ 
                        backgroundColor: "rgba(255,255,255,0.03)", 
                        color: item.badgeColor,
                        border: `1px solid ${item.badgeColor}33`
                      }}
                    >
                      {item.badge}
                    </span>
                    <CornerDownLeft size={12} style={{ color: "var(--text-soft)" }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div 
          style={{
            padding: "10px 16px",
            background: "rgba(255,255,255,0.02)",
            borderTop: "1px solid var(--border-card)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.72rem",
            color: "var(--text-soft)"
          }}
        >
          <span>Tip: search for "Payment API" to see all risk layers</span>
          <span>↑↓ navigation | ↵ to open</span>
        </div>
      </div>
    </div>
  );
}
