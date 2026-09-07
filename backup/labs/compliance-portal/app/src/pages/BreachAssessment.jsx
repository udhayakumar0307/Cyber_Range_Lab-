import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Download, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePrivacySoc } from "../context/PrivacySocContext.jsx";

const STEPS = ["Incident details", "Affected data", "Risk assessment", "Notification decision", "Summary"];
const initialAssessment = {
  incidentName: "Payment API log exposure", description: "", detectionTime: "", severity: "high",
  dataTypes: "", recordCount: "", principals: "", impact: "high", likelihood: "medium",
  boardRequired: "undetermined", principalsRequired: "undetermined"
};

function downloadReport(assessment) {
  const lines = ["Breach assessment report", "", `Incident: ${assessment.incidentName || "Untitled incident"}`,
    `Detected: ${assessment.detectionTime || "Not recorded"}`, `Severity: ${assessment.severity}`,
    `Description: ${assessment.description || "Not provided"}`, "", "Affected data",
    `Data types: ${assessment.dataTypes || "Not provided"}`, `Records: ${assessment.recordCount || "Not provided"}`,
    `Data principals: ${assessment.principals || "Not provided"}`, "", "Risk assessment",
    `Impact: ${assessment.impact}`, `Likelihood: ${assessment.likelihood}`, `Overall severity: ${assessment.overallSeverity}`,
    "", "Notification decision", `Data Protection Board: ${assessment.boardRequired}`,
    `Data principals: ${assessment.principalsRequired}`];
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
  link.download = "breach-assessment-report.txt";
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function BreachAssessment() {
  const navigate = useNavigate();
  const { addNotification } = usePrivacySoc();
  const [step, setStep] = useState(0);
  const [assessment, setAssessment] = useState(() => {
    try { return { ...initialAssessment, ...JSON.parse(localStorage.getItem("ddsBreachAssessment") || "{}") }; }
    catch { return initialAssessment; }
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const overallSeverity = useMemo(() => assessment.impact === "high" || assessment.likelihood === "high" ? "high" : assessment.impact === "medium" || assessment.likelihood === "medium" ? "medium" : "low", [assessment.impact, assessment.likelihood]);
  useEffect(() => setAssessment(current => ({ ...current, overallSeverity })), [overallSeverity]);
  const update = (field, value) => setAssessment(current => ({ ...current, [field]: value }));
  const save = () => {
    setSaving(true); setMessage("");
    window.setTimeout(() => { localStorage.setItem("ddsBreachAssessment", JSON.stringify({ ...assessment, overallSeverity })); setSaving(false); setMessage("Assessment saved locally and ready for review."); addNotification("Breach assessment saved for review.", "success"); }, 350);
  };
  const select = (field, label) => <label className="assessment-field"><span>{label}</span><select value={assessment[field]} onChange={e => update(field, e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>;
  const decision = (field, label) => <label className="assessment-field"><span>{label}</span><select value={assessment[field]} onChange={e => update(field, e.target.value)}><option value="undetermined">Undetermined</option><option value="required">Required</option><option value="not required">Not required</option></select></label>;
  return <section className="module-shell assessment-page">
    <div className="page-header"><div><span className="eyebrow">Incident response</span><h1 className="page-title">Breach Assessment</h1><p className="page-subtitle">Document the incident, evaluate risk, and record the notification decision.</p></div><button className="premium-btn secondary" onClick={() => navigate("/incident-management/breach")}><ArrowLeft size={16}/> Back to incidents</button></div>
    <ol className="assessment-steps" aria-label="Assessment progress">{STEPS.map((label, index) => <li key={label} className={index === step ? "active" : index < step ? "complete" : ""}><button type="button" onClick={() => setStep(index)} aria-current={index === step ? "step" : undefined}><span>{index < step ? <Check size={14}/> : index + 1}</span>{label}</button></li>)}</ol>
    <section className="glass-panel workspace-card assessment-card">
      {step === 0 && <div className="assessment-grid"><label className="assessment-field full"><span>Incident name</span><input value={assessment.incidentName} onChange={e => update("incidentName", e.target.value)} placeholder="e.g. Payment API log exposure"/></label><label className="assessment-field full"><span>Description</span><textarea value={assessment.description} onChange={e => update("description", e.target.value)} placeholder="Describe what happened, systems involved, and containment status."/></label><label className="assessment-field"><span>Detection time</span><input type="datetime-local" value={assessment.detectionTime} onChange={e => update("detectionTime", e.target.value)}/></label>{select("severity", "Initial severity")}</div>}
      {step === 1 && <div className="assessment-grid"><label className="assessment-field full"><span>Personal data types</span><input value={assessment.dataTypes} onChange={e => update("dataTypes", e.target.value)} placeholder="e.g. Contact details, Aadhaar identifiers"/></label><label className="assessment-field"><span>Number of records</span><input type="number" min="0" value={assessment.recordCount} onChange={e => update("recordCount", e.target.value)} placeholder="0"/></label><label className="assessment-field"><span>Data principals</span><input value={assessment.principals} onChange={e => update("principals", e.target.value)} placeholder="e.g. Customers, employees"/></label></div>}
      {step === 2 && <div className="assessment-grid">{select("impact", "Impact")}{select("likelihood", "Likelihood")}<div className="assessment-result"><span>Overall severity</span><strong className={`severity-${overallSeverity}`}>{overallSeverity}</strong><p>Calculated from the recorded impact and likelihood.</p></div></div>}
      {step === 3 && <div className="assessment-grid"><p className="assessment-copy full">Record the decision after considering the incident scope, severity, and likely harm to affected people.</p>{decision("boardRequired", "Notify the Data Protection Board")}{decision("principalsRequired", "Notify affected data principals")}</div>}
      {step === 4 && <div className="assessment-summary"><div><span>Incident</span><strong>{assessment.incidentName || "Untitled incident"}</strong></div><div><span>Overall severity</span><strong className={`severity-${overallSeverity}`}>{overallSeverity}</strong></div><div><span>Board notification</span><strong>{assessment.boardRequired}</strong></div><div><span>Principal notification</span><strong>{assessment.principalsRequired}</strong></div></div>}
      {message && <div className="notice success" role="status">{message}</div>}
      <div className="assessment-actions"><button className="premium-btn secondary" onClick={save} disabled={saving}><Save size={16}/>{saving ? "Saving…" : "Save assessment"}</button>{step === 4 && <button className="premium-btn secondary" onClick={() => downloadReport({ ...assessment, overallSeverity })}><Download size={16}/> Generate report</button>}<span className="assessment-spacer"/><button className="premium-btn secondary" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Back</button>{step < 4 ? <button className="premium-btn primary" onClick={() => setStep(step + 1)}>Continue <ArrowRight size={16}/></button> : <button className="premium-btn primary" onClick={() => { save(); navigate("/breach-notification"); }}>Continue to notification <ArrowRight size={16}/></button>}</div>
    </section>
  </section>;
}
