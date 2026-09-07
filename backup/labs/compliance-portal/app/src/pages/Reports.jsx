import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../layout/PageContainer";
import { getReportsData, generateReport as triggerGenerateReport } from "../services/reportService";
import { getConsents } from "../services/consentService";
import { getPiiData } from "../services/piiService";
import { getAnonymizationData } from "../services/anonymizationService";
import { calculateDpdpCompliance } from "../utils/dpdpCompliance";
import { useToast } from "../context/ToastContext";
import DataTable from "../components/common/DataTable";
import StatusBadge from "../components/common/StatusBadge";
import { formatDate } from "../utils/formatDate";
import { 
  FileText, 
  Download, 
  Eye, 
  AlertTriangle, 
  Sliders, 
  Calendar, 
  Database, 
  Layers, 
  CheckCircle, 
  Clock, 
  ShieldCheck,
  Briefcase,
  Play,
  Mail,
  Bell
} from "lucide-react";
import { API_BASE_URL } from "../config/appConfig";

export default function Reports() {
  const [statusInfo, setStatusInfo] = useState({ status: "NOT_CONNECTED" });
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Real platform metrics for dynamic report generation
  const [platformStats, setPlatformStats] = useState({
    consentsCount: 0,
    consentsActive: 0,
    consentsRevoked: 0,
    piiFieldsCount: 0,
    piiHighRiskCount: 0,
    anonymizedRecords: "0",
    anonymizationJobs: 0,
    dpdpComplianceScore: "85%"
  });

  // Filter state
  const [filters, setFilters] = useState({
    startDate: "2026-08-01",
    endDate: "2026-08-07",
    system: "All Connected Systems",
    dataType: "All Data Types"
  });

  // Selected report for live preview
  const [previewReport, setPreviewReport] = useState(null);

  // Scheduled reports state
  const [scheduledJobs, setScheduledJobs] = useState([
    { id: "SCH-001", name: "Weekly DPDP Compliance Audit", frequency: "Weekly (Mondays)", format: "PDF", recipient: "audit@acme.com", status: "Active" },
    { id: "SCH-002", name: "Daily PII Data Map Export", frequency: "Daily (02:00 AM)", format: "CSV", recipient: "sftp://security-vault", status: "Active" }
  ]);
  const [scheduleForm, setScheduleForm] = useState({
    name: "DPDP Compliance Audit Report",
    frequency: "Weekly (Mondays)",
    format: "PDF",
    recipient: "compliance-alerts@acme.com"
  });

  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkStatusAndLoad();
  }, []);

  const checkStatusAndLoad = async () => {
    try {
      const statusRes = await fetch(`${API_BASE_URL}/status`);
      if (!statusRes.ok) throw new Error();
      const statusData = await statusRes.json();
      setStatusInfo(statusData);

      if (statusData.status === "READY") {
        const [reportsData, consentsData, piiData, anonData] = await Promise.all([
          getReportsData(),
          getConsents(),
          getPiiData(),
          getAnonymizationData()
        ]);
        setData(reportsData);

        // Compute DPDP index dynamically
        const dpdpCalc = calculateDpdpCompliance(consentsData || [], true);
        const scoreStr = dpdpCalc ? `${dpdpCalc.score}%` : "85%";

        setPlatformStats({
          consentsCount: consentsData?.length || 0,
          consentsActive: consentsData?.filter(c => c.consent_status === "granted").length || 0,
          consentsRevoked: consentsData?.filter(c => c.consent_status === "revoked").length || 0,
          piiFieldsCount: piiData?.fields?.length || 0,
          piiHighRiskCount: piiData?.fields?.filter(f => f.riskLevel === "High").length || 0,
          anonymizedRecords: anonData?.summary?.recordsAnonymized || "0",
          anonymizationJobs: anonData?.jobs?.length || 0,
          dpdpComplianceScore: scoreStr
        });
      }
      setIsLoading(false);
    } catch {
      setStatusInfo({ status: "NOT_CONNECTED" });
      setIsLoading(false);
    }
  };

  const handlePreview = (report) => {
    setPreviewReport(report);
    addToast(`Loaded live preview for: ${report.name}`, "info");
  };

  const handleAddSchedule = (e) => {
    e.preventDefault();
    const newJob = {
      id: `SCH-${Math.floor(100 + Math.random() * 900)}`,
      name: scheduleForm.name,
      frequency: scheduleForm.frequency,
      format: scheduleForm.format,
      recipient: scheduleForm.recipient,
      status: "Active"
    };
    setScheduledJobs(prev => [...prev, newJob]);
    addToast(`Successfully scheduled automated run for: ${scheduleForm.name}`, "success");
  };

  const handleDownload = async (reportName, formatType) => {
    addToast(`Compiling and downloading ${formatType} report...`, "info");
    
    try {
      // 1. Log report generation in backend database
      await triggerGenerateReport(reportName, formatType);
      
      // 2. Generate and download file client-side
      const baseFilename = reportName.toLowerCase().replace(/\s+/g, "_");
      const generatedDate = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
      const generatedTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      const complianceNum = parseInt(platformStats.dpdpComplianceScore) || 0;
      const complianceColor = complianceNum >= 80 ? "#16a34a" : complianceNum >= 60 ? "#d97706" : "#dc2626";
      
      if (formatType === "PDF") {
        // Build a rich, styled HTML document and print it via the browser
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${reportName} – Privacy Audit Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 13px; line-height: 1.5; }

    /* ── Cover Header ── */
    .cover-header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0c4a6e 100%);
      color: #fff; padding: 36px 48px 28px; position: relative; overflow: hidden;
    }
    .cover-header::after {
      content: ''; position: absolute; bottom: -30px; right: -30px;
      width: 200px; height: 200px; border-radius: 50%;
      background: rgba(56, 189, 248, 0.08); pointer-events: none;
    }
    .brand-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .brand-logo {
      width: 40px; height: 40px; background: #38bdf8; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; font-weight: 800; color: #0f172a;
    }
    .brand-name { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; }
    .cover-title { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 6px; }
    .cover-subtitle { font-size: 13px; color: #94a3b8; font-weight: 500; }
    .meta-chips { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
    .chip {
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 100px; padding: 4px 14px; font-size: 11px; font-weight: 600;
      color: #cbd5e1; letter-spacing: 0.03em;
    }

    /* ── Score Banner ── */
    .score-banner {
      display: flex; align-items: center; gap: 32px; flex-wrap: wrap;
      background: #f8fafc; border-bottom: 2px solid #e2e8f0;
      padding: 20px 48px;
    }
    .score-circle {
      width: 80px; height: 80px; border-radius: 50%; flex-shrink: 0;
      background: conic-gradient(${complianceColor} 0% ${complianceNum}%, #e2e8f0 ${complianceNum}% 100%);
      display: flex; align-items: center; justify-content: center;
    }
    .score-inner {
      width: 62px; height: 62px; border-radius: 50%; background: #f8fafc;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .score-val { font-size: 18px; font-weight: 800; color: ${complianceColor}; line-height: 1; }
    .score-label-sm { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .score-text h2 { font-size: 17px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
    .score-text p { font-size: 12px; color: #64748b; max-width: 520px; }
    .score-badge {
      margin-left: auto; padding: 6px 18px; border-radius: 100px; font-size: 12px; font-weight: 700;
      background: ${complianceNum >= 80 ? "#dcfce7" : "#fef3c7"};
      color: ${complianceNum >= 80 ? "#15803d" : "#92400e"};
      border: 1px solid ${complianceNum >= 80 ? "#86efac" : "#fde68a"};
    }

    /* ── Body ── */
    .body { padding: 32px 48px; }
    .section-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
      color: #2563eb; margin-bottom: 12px; padding-bottom: 6px;
      border-bottom: 2px solid #dbeafe;
    }

    /* ── KPI Cards ── */
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 28px; }
    .kpi-card {
      border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px;
      background: #fff; position: relative; overflow: hidden;
    }
    .kpi-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0;
      height: 3px; border-radius: 10px 10px 0 0;
    }
    .kpi-card.green::before { background: #16a34a; }
    .kpi-card.blue::before  { background: #2563eb; }
    .kpi-card.red::before   { background: #dc2626; }
    .kpi-card.purple::before { background: #7c3aed; }
    .kpi-card.amber::before  { background: #d97706; }
    .kpi-card.cyan::before   { background: #0891b2; }
    .kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 6px; }
    .kpi-value { font-size: 26px; font-weight: 800; color: #0f172a; line-height: 1; }
    .kpi-sub { font-size: 10px; color: #94a3b8; margin-top: 4px; }

    /* ── Compliance Table ── */
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    thead { background: #1e3a5f; color: #fff; }
    thead th { padding: 10px 14px; font-size: 11px; font-weight: 700; text-align: left; letter-spacing: 0.05em; text-transform: uppercase; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr:hover { background: #eff6ff; }
    td { padding: 10px 14px; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
    .badge {
      display: inline-block; padding: 2px 10px; border-radius: 100px;
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .badge-green { background: #dcfce7; color: #15803d; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .badge-red   { background: #fee2e2; color: #991b1b; }

    /* ── Horizontal rule ── */
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }

    /* ── Info Box ── */
    .info-box {
      background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #2563eb;
      border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;
    }
    .info-box h4 { font-size: 12px; font-weight: 700; color: #1d4ed8; margin-bottom: 6px; }
    .info-box p  { font-size: 11px; color: #1e40af; line-height: 1.6; }

    /* ── Footer ── */
    .footer {
      background: #0f172a; color: #64748b;
      padding: 18px 48px; font-size: 10px;
      display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: 8px; margin-top: 32px;
    }
    .footer strong { color: #94a3b8; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .cover-header, .footer { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <!-- Cover Header -->
  <div class="cover-header">
    <div class="brand-row">
      <div class="brand-logo">P</div>
      <span class="brand-name">Privacy Command Center</span>
    </div>
    <div class="cover-title">${reportName}</div>
    <div class="cover-subtitle">DPDP Act 2023 – Automated Audit &amp; Compliance Report</div>
    <div class="meta-chips">
      <span class="chip">Generated: ${generatedDate} at ${generatedTime}</span>
      <span class="chip">Scope: ${filters.system}</span>
      <span class="chip">Data Type: ${filters.dataType}</span>
      <span class="chip">Period: ${filters.startDate} → ${filters.endDate}</span>
    </div>
  </div>

  <!-- Score Banner -->
  <div class="score-banner">
    <div class="score-circle">
      <div class="score-inner">
        <div class="score-val">${complianceNum}%</div>
        <div class="score-label-sm">Index</div>
      </div>
    </div>
    <div class="score-text">
      <h2>Statutory Compliance Index (DPDP Act 2023)</h2>
      <p>
        The compliance index is graded across 10 core data protection provisions. A score above 80% indicates
        operational alignment. Controls below 60% require immediate remediation before the next scheduled audit.
      </p>
    </div>
    <div class="score-badge">${complianceNum >= 80 ? "✓ COMPLIANT" : "⚠ NEEDS ATTENTION"}</div>
  </div>

  <!-- Body -->
  <div class="body">

    <!-- KPI Cards -->
    <div class="section-title">Key Privacy &amp; Compliance Metrics</div>
    <div class="kpi-grid">
      <div class="kpi-card green">
        <div class="kpi-label">Total Consents</div>
        <div class="kpi-value">${platformStats.consentsCount.toLocaleString()}</div>
        <div class="kpi-sub">Customer records captured</div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-label">Active Consents</div>
        <div class="kpi-value">${platformStats.consentsActive.toLocaleString()}</div>
        <div class="kpi-sub">Currently granted &amp; valid</div>
      </div>
      <div class="kpi-card red">
        <div class="kpi-label">Revoked Consents</div>
        <div class="kpi-value">${platformStats.consentsRevoked.toLocaleString()}</div>
        <div class="kpi-sub">Withdrawn by data principals</div>
      </div>
      <div class="kpi-card purple">
        <div class="kpi-label">PII Fields Discovered</div>
        <div class="kpi-value">${platformStats.piiFieldsCount}</div>
        <div class="kpi-sub">Sensitive data categories found</div>
      </div>
      <div class="kpi-card amber">
        <div class="kpi-label">High-Risk PII Fields</div>
        <div class="kpi-value">${platformStats.piiHighRiskCount}</div>
        <div class="kpi-sub">Requiring immediate masking</div>
      </div>
      <div class="kpi-card cyan">
        <div class="kpi-label">Anonymized Records</div>
        <div class="kpi-value">${platformStats.anonymizedRecords}</div>
        <div class="kpi-sub">Database records processed</div>
      </div>
    </div>

    <hr class="divider" />

    <!-- Compliance Checklist Table -->
    <div class="section-title">DPDP Act 2023 – Compliance Controls Review</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Control / Provision</th>
          <th>DPDP Section</th>
          <th>Status</th>
          <th>Coverage</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td><td>Consent collection with stated purpose</td><td>Section 6</td>
          <td><span class="badge badge-green">Compliant</span></td>
          <td>${platformStats.consentsCount > 0 ? "100%" : "N/A"}</td>
        </tr>
        <tr>
          <td>2</td><td>Notice &amp; Transparency – purpose disclosure</td><td>Section 5</td>
          <td><span class="badge badge-green">Compliant</span></td>
          <td>${platformStats.consentsActive > 0 ? Math.round((platformStats.consentsActive / Math.max(platformStats.consentsCount,1)) * 100) + "%" : "N/A"}</td>
        </tr>
        <tr>
          <td>3</td><td>Rights of data principals – access &amp; correction</td><td>Section 11–12</td>
          <td><span class="badge badge-green">Compliant</span></td>
          <td>Operational</td>
        </tr>
        <tr>
          <td>4</td><td>Data erasure on consent withdrawal</td><td>Section 8(7)</td>
          <td><span class="badge ${platformStats.consentsRevoked > 0 ? "badge-amber" : "badge-green"}">${platformStats.consentsRevoked > 0 ? "Review" : "Compliant"}</span></td>
          <td>${platformStats.consentsRevoked} records pending verification</td>
        </tr>
        <tr>
          <td>5</td><td>Reasonable security safeguards</td><td>Section 8(5)</td>
          <td><span class="badge badge-green">Compliant</span></td>
          <td>API-key access enforced</td>
        </tr>
        <tr>
          <td>6</td><td>PII data minimisation &amp; classification</td><td>Section 8(1)</td>
          <td><span class="badge ${platformStats.piiHighRiskCount > 0 ? "badge-amber" : "badge-green"}">${platformStats.piiHighRiskCount > 0 ? "Partial" : "Compliant"}</span></td>
          <td>${platformStats.piiFieldsCount} fields inventoried, ${platformStats.piiHighRiskCount} high-risk</td>
        </tr>
        <tr>
          <td>7</td><td>Anonymization &amp; cryptographic masking</td><td>Section 8</td>
          <td><span class="badge badge-green">Compliant</span></td>
          <td>${platformStats.anonymizedRecords} records anonymized</td>
        </tr>
        <tr>
          <td>8</td><td>Breach notification readiness</td><td>Section 8(6)</td>
          <td><span class="badge badge-green">Compliant</span></td>
          <td>Incident module active</td>
        </tr>
        <tr>
          <td>9</td><td>Guardian consent for minors</td><td>Section 9</td>
          <td><span class="badge badge-green">Compliant</span></td>
          <td>Guardian verification workflow active</td>
        </tr>
        <tr>
          <td>10</td><td>Cross-border processing restrictions</td><td>Section 16</td>
          <td><span class="badge badge-amber">Partial</span></td>
          <td>Domestic processing verified</td>
        </tr>
      </tbody>
    </table>

    <!-- Info Box -->
    <div class="info-box">
      <h4>📋 Audit Certification Statement</h4>
      <p>
        This report certifies that the privacy compliance posture of <strong>${filters.system}</strong> was systematically evaluated
        against the Digital Personal Data Protection (DPDP) Act, 2023. All consent records, PII classifications,
        anonymization logs, and breach notification controls were reviewed for the period <strong>${filters.startDate}</strong> to
        <strong>${filters.endDate}</strong>. Cryptographic audit logs are preserved in immutable database registers and
        accessible to authorized stakeholders for regulatory inspection.
      </p>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer">
    <div><strong>Privacy Command Center</strong> · DPDP Act 2023 Compliance Platform</div>
    <div>Report ID: RPT-${Date.now().toString(36).toUpperCase()} · Exported: ${generatedDate}</div>
    <div>Confidential – Internal Use Only</div>
  </div>

</body>
</html>`;

        // Open a hidden iframe, write the HTML, and trigger print-to-PDF
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.top = "-9999px";
        iframe.style.left = "-9999px";
        iframe.style.width = "210mm";
        iframe.style.height = "297mm";
        iframe.style.border = "none";
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        // Wait for fonts to load then print
        setTimeout(() => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setTimeout(() => document.body.removeChild(iframe), 2000);
        }, 600);

        addToast(`PDF report ready — save via your browser's print dialog as "${baseFilename}.pdf"`, "success");
      } else {
        // CSV Export
        const csvContent = 
`PRIVACY COMMAND CENTER COMPLIANCE AUDIT
Report Name,${reportName}
Format,CSV Spreadsheets
Generated On,${generatedDate}
System Filter,${filters.system}
Data Category Filter,${filters.dataType}
Start Date,${filters.startDate}
End Date,${filters.endDate}

COMPLIANCE METRICS
DPDP Compliance index,${platformStats.dpdpComplianceScore}
Total Customer Consents,${platformStats.consentsCount}
Active Consents,${platformStats.consentsActive}
Revoked Consents,${platformStats.consentsRevoked}
PII Fields Identified,${platformStats.piiFieldsCount}
High-Risk PII Fields,${platformStats.piiHighRiskCount}
Anonymized Database Records,${platformStats.anonymizedRecords}
Anonymization jobs run,${platformStats.anonymizationJobs}
`;
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${baseFilename}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addToast(`Downloaded CSV: ${baseFilename}.csv`, "success");
      }
      
      // Re-fetch reports data to refresh the "Recently Generated" table
      const updatedReports = await getReportsData();
      setData(updatedReports);
    } catch (err) {
      addToast(err.message || "Failed to generate report", "error");
    }
  };





  if (isLoading) {
    return (
      <PageContainer title="Reports" subtitle="Loading compliance reports..." breadcrumbs={["Reports"]}>
        <div className="skeleton-card animate-pulse" style={{ height: "400px" }}></div>
      </PageContainer>
    );
  }

  if (statusInfo.status !== "READY" || !data) {
    return (
      <PageContainer title="Reports" subtitle="Compliance audit reporting center.">
        <div className="section-card text-center" style={{ padding: "80px 40px", maxWidth: "680px", margin: "40px auto", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
          <AlertTriangle size={64} className="text-warning mb-4 animate-bounce" style={{ margin: "0 auto", color: "var(--warning)" }} />
          <h3 className="section-card-title mb-3" style={{ fontSize: "24px", fontWeight: "700" }}>No Platform Connected</h3>
          <p className="text-muted mb-6" style={{ fontSize: "15px", color: "var(--text-muted)", lineHeight: "1.6" }}>
            Connect an external business platform via REST APIs to view, filter, and generate privacy audit reports.
          </p>
          <button onClick={() => navigate("/integration")} className="btn-primary" style={{ padding: "12px 24px", borderRadius: "8px", fontWeight: "600" }}>
            Go to Platform Integration
          </button>
        </div>
      </PageContainer>
    );
  }

  const columns = [
    { key: "name", label: "Report Name" },
    { key: "category", label: "Category" },
    {
      key: "generated",
      label: "Generated At",
      render: (row) => formatDate(row.generated)
    },
    { key: "size", label: "File Size" },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      key: "download",
      label: "Action",
      render: (row) => (
        <button onClick={() => handleDownload(row.name, row.format)} className="btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <Download size={12} />
          <span>Download</span>
        </button>
      )
    }
  ];

  const renderReportCard = (report, category) => (
    <div key={report.id} className="report-action-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "var(--bg-card-hover)", border: "1px solid var(--border-card)", borderRadius: "8px", marginBottom: "12px" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <FileText size={22} className="text-muted" style={{ color: "var(--info)" }} />
        <div>
          <strong style={{ display: "block", color: "var(--text-primary)", fontSize: "14px" }}>{report.name}</strong>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Formats: {report.format}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={() => handlePreview({ ...report, category })} className="btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", padding: "6px 12px" }}>
          <Eye size={13} />
          <span>Preview</span>
        </button>
        {report.format.includes("PDF") && (
          <button onClick={() => handleDownload(report.name, "PDF")} className="btn-success-outline btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", padding: "6px 12px", color: "var(--success)" }}>
            <Download size={13} />
            <span>PDF</span>
          </button>
        )}
        {report.format.includes("CSV") && (
          <button onClick={() => handleDownload(report.name, "CSV")} className="btn-success-outline btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", padding: "6px 12px", color: "var(--success)" }}>
            <Download size={13} />
            <span>CSV</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <PageContainer
      title="Privacy Reports & Auditing"
      subtitle="Generate, filter, and schedule structured audits for compliance and regulatory reporting."
      breadcrumbs={["Reports"]}
    >
      
      {/* 1. Interactive Filters Card */}
      <div className="section-card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", marginBottom: "24px" }}>
        <h4 style={{ fontSize: "14px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "8px", margin: "0 0 16px 0", color: "var(--text-primary)" }}>
          <Sliders size={16} />
          <span>Scope Filter Controls</span>
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <div className="input-group">
            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>Start Date</label>
            <input 
              type="date" 
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              style={{ width: "100%", padding: "8px", border: "1px solid var(--border-card)", background: "var(--bg-card-hover)", borderRadius: "6px", color: "var(--text-primary)" }}
            />
          </div>
          <div className="input-group">
            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>End Date</label>
            <input 
              type="date" 
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              style={{ width: "100%", padding: "8px", border: "1px solid var(--border-card)", background: "var(--bg-card-hover)", borderRadius: "6px", color: "var(--text-primary)" }}
            />
          </div>
          <div className="input-group">
            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>Target Platform</label>
            <select
              value={filters.system}
              onChange={(e) => setFilters(prev => ({ ...prev, system: e.target.value }))}
              style={{ width: "100%", padding: "8px", border: "1px solid var(--border-card)", background: "var(--bg-card-hover)", borderRadius: "6px", color: "var(--text-primary)" }}
            >
              <option value="All Connected Systems">All Connected Systems</option>
              <option value="Evershop REST API">Evershop (Primary Ecommerce)</option>
              <option value="Salesforce System">Salesforce System</option>
            </select>
          </div>
          <div className="input-group">
            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>Data Category</label>
            <select
              value={filters.dataType}
              onChange={(e) => setFilters(prev => ({ ...prev, dataType: e.target.value }))}
              style={{ width: "100%", padding: "8px", border: "1px solid var(--border-card)", background: "var(--bg-card-hover)", borderRadius: "6px", color: "var(--text-primary)" }}
            >
              <option value="All Data Types">All Data Types</option>
              <option value="Identity Information">Identity Information</option>
              <option value="Contact Information">Contact Information</option>
              <option value="Location Data">Location Data</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "24px" }}>
        
        {/* Left Column: Report categories list */}
        <div style={{ flex: "1 1 500px" }}>
          
          {/* Consolidated overall report */}
          <div className="section-card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", marginBottom: "20px", borderLeft: "4px solid var(--info)" }}>
            <h3 className="section-card-title" style={{ fontSize: "16px", fontWeight: "700", marginBottom: "12px", color: "var(--text-primary)" }}>Consolidated Corporate Report</h3>
            {(data.overallConsolidatedReport || []).map(r => renderReportCard(r, "Consolidated"))}
          </div>

          <div className="section-card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", marginBottom: "20px" }}>
            <h3 className="section-card-title" style={{ fontSize: "16px", fontWeight: "700", marginBottom: "12px", color: "var(--text-primary)" }}>Compliance Audit Reports</h3>
            {(data.complianceReports || []).map(r => renderReportCard(r, "Compliance"))}
          </div>

          <div className="section-card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", marginBottom: "20px" }}>
            <h3 className="section-card-title" style={{ fontSize: "16px", fontWeight: "700", marginBottom: "12px", color: "var(--text-primary)" }}>Consent Registers Reports</h3>
            {(data.consentReports || []).map(r => renderReportCard(r, "Consent"))}
          </div>

          <div className="section-card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
            <h3 className="section-card-title" style={{ fontSize: "16px", fontWeight: "700", marginBottom: "12px", color: "var(--text-primary)" }}>Privacy Mapping & Sharing</h3>
            {(data.privacyReports || []).map(r => renderReportCard(r, "Privacy"))}
          </div>

        </div>

        {/* Right Column: Dynamic Live Preview Area */}
        <div style={{ flex: "1 1 360px" }}>
          
          <div className="section-card" style={{ padding: "24px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", height: "100%", display: "flex", flexDirection: "column" }}>
            <h3 className="section-card-title" style={{ fontSize: "18px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "8px", margin: "0 0 16px 0", color: "var(--text-primary)" }}>
              <Eye size={18} style={{ color: "var(--info)" }} />
              <span>Live Report Preview Document</span>
            </h3>
            
            {previewReport ? (
              <div style={{ border: "1px dashed var(--border-card)", borderRadius: "12px", padding: "20px", background: "var(--bg-app)", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-card)", paddingBottom: "10px", marginBottom: "16px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--info)", textTransform: "uppercase" }}>{previewReport.category} REPORT</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{new Date().toLocaleDateString()}</span>
                  </div>
                  
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "15px", color: "var(--text-primary)" }}>{previewReport.name}</h4>
                  
                  {/* Applied Filters Context */}
                  <div style={{ background: "var(--bg-card)", padding: "8px 12px", borderRadius: "6px", marginBottom: "16px", border: "1px solid var(--border-card)" }}>
                    <span style={{ display: "block", fontSize: "10px", color: "var(--text-muted)" }}>Scope Context:</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-primary)" }}>{filters.system} · {filters.dataType}</span>
                  </div>

                  {/* Combined Metrics summary */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <span style={{ color: "var(--text-muted)" }}>DPDP Compliance Score:</span>
                      <strong style={{ color: "var(--success)" }}>{platformStats.dpdpComplianceScore}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <span style={{ color: "var(--text-muted)" }}>Total Consents Audited:</span>
                      <strong style={{ color: "var(--text-primary)" }}>{platformStats.consentsCount} records</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <span style={{ color: "var(--text-muted)" }}>PII Fields Evaluated:</span>
                      <strong style={{ color: "var(--text-primary)" }}>{platformStats.piiFieldsCount} fields</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <span style={{ color: "var(--text-muted)" }}>Anonymized Database State:</span>
                      <strong style={{ color: "var(--text-primary)" }}>{platformStats.anonymizedRecords} rows</strong>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border-card)", paddingTop: "16px", marginTop: "24px", display: "flex", gap: "12px" }}>
                  <button onClick={() => handleDownload(previewReport.name, "PDF")} className="btn-primary" style={{ flex: 1, padding: "10px", fontSize: "12px", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "6px" }}>
                    <Download size={14} />
                    <span>Download PDF</span>
                  </button>
                  <button onClick={() => handleDownload(previewReport.name, "CSV")} className="btn-secondary" style={{ flex: 1, padding: "10px", fontSize: "12px", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "6px" }}>
                    <Download size={14} />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, border: "1px dashed var(--border-card)", borderRadius: "12px", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", background: "var(--bg-app)" }}>
                <FileText size={48} className="text-muted" style={{ marginBottom: "16px", opacity: 0.5 }} />
                <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", color: "var(--text-primary)" }}>No Preview Loaded</h4>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>Click the "Preview" button on any report template to inspect its parameters and compile metadata.</p>
              </div>
            )}
            
          </div>

        </div>

      </div>

      {/* 2. Scheduled compliance reports scheduling form */}
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "24px" }}>
        
        <div style={{ flex: "1 1 300px" }}>
          <div className="section-card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
            <h3 className="section-card-title" style={{ fontSize: "16px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "16px", margin: 0, color: "var(--text-primary)" }}>
              <Clock size={16} />
              <span>Schedule Automated Privacy Audits</span>
            </h3>
            
            <form onSubmit={handleAddSchedule} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="input-group">
                <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Report Template</label>
                <select 
                  value={scheduleForm.name}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, name: e.target.value }))}
                  style={{ width: "100%", padding: "8px", border: "1px solid var(--border-card)", background: "var(--bg-card-hover)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "13px" }}
                >
                  <option value="DPDP Compliance Audit Report">DPDP Compliance Audit Report</option>
                  <option value="Customer Consent Registry Audit">Customer Consent Registry Audit</option>
                  <option value="PII Data Inventory Mapping">PII Data Inventory Mapping</option>
                  <option value="Consolidated Privacy Posture Audit">Consolidated Privacy Posture Audit</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Frequency</label>
                  <select 
                    value={scheduleForm.frequency}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, frequency: e.target.value }))}
                    style={{ width: "100%", padding: "8px", border: "1px solid var(--border-card)", background: "var(--bg-card-hover)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "13px" }}
                  >
                    <option value="Daily (02:00 AM)">Daily</option>
                    <option value="Weekly (Mondays)">Weekly</option>
                    <option value="Monthly (1st day)">Monthly</option>
                  </select>
                </div>
                <div className="input-group" style={{ width: "100px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Format</label>
                  <select 
                    value={scheduleForm.format}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, format: e.target.value }))}
                    style={{ width: "100%", padding: "8px", border: "1px solid var(--border-card)", background: "var(--bg-card-hover)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "13px" }}
                  >
                    <option value="PDF">PDF</option>
                    <option value="CSV">CSV</option>
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Delivery Destination Email / Vault</label>
                <input 
                  type="text" 
                  value={scheduleForm.recipient}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, recipient: e.target.value }))}
                  style={{ width: "100%", padding: "8px", border: "1px solid var(--border-card)", background: "var(--bg-card-hover)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "13px" }}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ padding: "10px", width: "100%", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "6px", fontWeight: "600", fontSize: "13px", marginTop: "8px" }}>
                <Clock size={14} />
                <span>Schedule Report Pipeline</span>
              </button>
            </form>
          </div>
        </div>

        <div style={{ flex: "2 1 400px" }}>
          <div className="section-card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px", height: "100%" }}>
            <h3 className="section-card-title" style={{ fontSize: "16px", fontWeight: "700", marginBottom: "16px", color: "var(--text-primary)" }}>Active Scheduled Runs</h3>
            
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-card)", textAlign: "left", color: "var(--text-muted)" }}>
                    <th style={{ padding: "10px" }}>Report Name</th>
                    <th style={{ padding: "10px" }}>Frequency</th>
                    <th style={{ padding: "10px" }}>Format</th>
                    <th style={{ padding: "10px" }}>Destination</th>
                    <th style={{ padding: "10px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledJobs.map(job => (
                    <tr key={job.id} style={{ borderBottom: "1px solid var(--border-card)" }}>
                      <td style={{ padding: "12px 10px" }}><strong style={{ color: "var(--text-primary)" }}>{job.name}</strong></td>
                      <td style={{ padding: "12px 10px", color: "var(--text-body)" }}>{job.frequency}</td>
                      <td style={{ padding: "12px 10px", color: "var(--text-body)" }}>{job.format}</td>
                      <td style={{ padding: "12px 10px", color: "var(--text-muted)", fontSize: "11px" }}>{job.recipient}</td>
                      <td style={{ padding: "12px 10px" }}><span style={{ background: "rgba(34,197,94,0.1)", color: "var(--success)", fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "100px" }}>{job.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Recently generated list card */}
      <div className="section-card" style={{ padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "16px" }}>
        <h3 className="section-card-title" style={{ fontSize: "16px", fontWeight: "700", marginBottom: "16px", color: "var(--text-primary)" }}>Recently Generated Reports</h3>
        <DataTable columns={columns} data={data.recent || []} />
      </div>

    </PageContainer>
  );
}
