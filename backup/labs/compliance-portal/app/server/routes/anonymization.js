import { Router } from "express";

const router = Router();

const datasets = [
  { id: "ANON-1042", dataset: "Customer Profiles", fields: ["Email", "Phone", "Date of birth"], technique: "Pseudonymization", status: "Completed", lastExecution: "2026-08-03T06:20:00.000Z" },
  { id: "ANON-1041", dataset: "Support Tickets", fields: ["Name", "Email", "Free-text notes"], technique: "Masking", status: "Completed", lastExecution: "2026-08-02T18:45:00.000Z" },
  { id: "ANON-1040", dataset: "Product Analytics", fields: ["IP address", "Location"], technique: "Generalization", status: "Running", lastExecution: "2026-08-03T08:10:00.000Z" },
  { id: "ANON-1039", dataset: "Payment Reconciliation", fields: ["Account number", "Transaction ID"], technique: "Tokenization", status: "Scheduled", lastExecution: "2026-08-01T02:00:00.000Z" },
  { id: "ANON-1038", dataset: "Marketing Exports", fields: ["Email", "Mobile number"], technique: "Hashing", status: "Completed", lastExecution: "2026-07-31T22:15:00.000Z" }
];

const policies = [
  { id: "POL-021", name: "Analytics minimization", technique: "Generalization", scope: "Product Analytics", status: "Active", updatedAt: "2026-08-01T09:30:00.000Z" },
  { id: "POL-018", name: "Customer export protection", technique: "Pseudonymization", scope: "Customer Profiles", status: "Active", updatedAt: "2026-07-29T14:20:00.000Z" },
  { id: "POL-012", name: "Archive data masking", technique: "Masking", scope: "Support Tickets", status: "Active", updatedAt: "2026-07-25T11:00:00.000Z" }
];

const activity = [
  { id: "ACT-834", event: "Dataset anonymized", subject: "Customer Profiles", actor: "Privacy Automation", timestamp: "2026-08-03T06:20:00.000Z" },
  { id: "ACT-833", event: "Policy updated", subject: "Analytics minimization", actor: "A. Sharma", timestamp: "2026-08-01T09:30:00.000Z" },
  { id: "ACT-832", event: "Job scheduled", subject: "Payment Reconciliation", actor: "Privacy Automation", timestamp: "2026-08-01T02:00:00.000Z" }
];

router.get("/overview", (_request, response) => {
  const completed = datasets.filter((item) => item.status === "Completed");
  response.json({
    totalAnonymizedDatasets: completed.length,
    pendingJobs: datasets.filter((item) => ["Running", "Scheduled"].includes(item.status)).length,
    activePolicies: policies.filter((item) => item.status === "Active").length,
    lastAnonymizationTimestamp: completed.sort((a, b) => new Date(b.lastExecution) - new Date(a.lastExecution))[0]?.lastExecution ?? null
  });
});
router.get("/datasets", (_request, response) => response.json(datasets));
router.get("/policies", (_request, response) => response.json(policies));
router.get("/activity-log", (_request, response) => response.json(activity));

export default router;
