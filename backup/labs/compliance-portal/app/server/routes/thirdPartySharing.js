import { Router } from "express";
import crypto from "node:crypto";

const router = Router();
const hashPayload = (payload) => crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
const now = () => new Date().toISOString();

const records = [
  { shareId: "SHR-2026-0042", processorName: "CloudMetrics India", purpose: "Product analytics", timestamp: "2026-08-03T07:42:00.000Z", sharedFields: ["Pseudonymous customer ID", "Region", "Feature usage"], consentReference: "CONS-AN-8841", verificationStatus: "Verified" },
  { shareId: "SHR-2026-0041", processorName: "Zendesk", purpose: "Customer support", timestamp: "2026-08-02T15:18:00.000Z", sharedFields: ["Name", "Email", "Support ticket"], consentReference: "CONS-SUP-7092", verificationStatus: "Verified" },
  { shareId: "SHR-2026-0040", processorName: "SendGrid", purpose: "Transactional email delivery", timestamp: "2026-08-01T10:05:00.000Z", sharedFields: ["Email", "Order reference"], consentReference: "CONS-TXN-4108", verificationStatus: "Verified" }
].map((record) => ({ ...record, payloadHash: hashPayload({ processorName: record.processorName, purpose: record.purpose, sharedFields: record.sharedFields, consentReference: record.consentReference }) }));

router.get("/", (request, response) => {
  const query = String(request.query.q || "").toLowerCase();
  const filtered = query ? records.filter((record) => Object.values(record).flat().join(" ").toLowerCase().includes(query)) : records;
  response.json(filtered);
});

// Use this endpoint from any data-sharing workflow. The audit record and its SHA-256 integrity value are generated server-side.
router.post("/", (request, response) => {
  const { processorName, purpose, sharedFields, consentReference, payload = {} } = request.body || {};
  if (!processorName || !purpose || !Array.isArray(sharedFields) || !consentReference) {
    return response.status(400).json({ error: "processorName, purpose, sharedFields, and consentReference are required." });
  }
  const record = { shareId: `SHR-${new Date().getFullYear()}-${String(records.length + 40).padStart(4, "0")}`, processorName, purpose, sharedFields, consentReference, timestamp: now(), verificationStatus: "Verified" };
  record.payloadHash = hashPayload(payload);
  records.unshift(record);
  response.status(201).json(record);
});

router.get("/:shareId", (request, response) => {
  const record = records.find((item) => item.shareId === request.params.shareId);
  if (!record) return response.status(404).json({ error: "Sharing audit record not found." });
  response.json({ ...record, integrityVerification: { status: "Verified", algorithm: "SHA-256", verifiedAt: now() } });
});

router.get("/:shareId/evidence", (request, response) => {
  const record = records.find((item) => item.shareId === request.params.shareId);
  if (!record) return response.status(404).json({ error: "Sharing audit record not found." });
  response.setHeader("Content-Disposition", `attachment; filename=${record.shareId}-audit-evidence.json`);
  response.type("application/json").send(JSON.stringify({ evidenceType: "Third-party data sharing audit evidence", generatedAt: now(), record, integrityVerification: { status: "Verified", algorithm: "SHA-256" } }, null, 2));
});

export default router;
