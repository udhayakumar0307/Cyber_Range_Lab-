import crypto from "node:crypto";

// Masking preview.
//
// The preview demonstrates what each technique does to a field. It is built
// from a representative sample value per identifier type, never from a real
// record: the portal must not put a customer's Aadhaar or account number on
// screen in order to show that it would have masked it. The point of the panel
// is the transformation, and a synthetic value shows that just as well.

const SAMPLES = {
  "Aadhaar Number": "2345 6789 0123",
  "PAN": "ABCDE1234F",
  "Passport Number": "K1234567",
  "Voter ID": "ABC1234567",
  "Driving Licence": "MH0120110012345",
  "Bank Account Number": "50100123456789",
  "IFSC Code": "HDFC0001234",
  "UPI ID": "person@okbank",
  "Payment Card Number": "4111 1111 1111 1111",
  "Account Balance": "48250.00",
  "Transaction Record": "TXN-2026-004182",
  "KYC Document": "kyc-proof-of-address.pdf",
  "GSTIN": "27ABCDE1234F1Z5",
  "Demat / Client Code": "IN30012345678901",
  "ABHA / Health ID": "12345678901234",
  "Medical Record": "Type 2 diabetes, metformin 500mg",
  "Insurance Policy": "POL-4471-2026",
  "Biometric Data": "<fingerprint template>",
  "Credential": "••••••••••••",
  "Email Address": "person@example.com",
  "Phone Number": "9876543210",
  "Physical Address": "14 MG Road, Bengaluru, Karnataka 560001",
  "Precise Location": "12.9716, 77.5946",
  "Full Name": "Asha Menon",
  "Date of Birth": "1994-03-17",
  "Child Status": "true",
  "Guardian Detail": "Ravi Menon",
  "IP Address": "203.0.113.42",
  "Device Identifier": "d41d8cd98f00b204",
  "Session Identifier": "sess_7f3a91c4",
  "Processing Purpose": "Marketing",
  "Order / Usage History": "3 orders, last 2026-07-02"
};

const DEFAULT_SAMPLE = "sample-value";

export function sampleFor(piiType) {
  return SAMPLES[piiType] || DEFAULT_SAMPLE;
}

/** Apply one technique to a value and return what would be stored. */
export function applyTechnique(value, technique) {
  const input = String(value ?? "");
  switch ((technique || "").toLowerCase()) {
    case "hashing":
      return `sha256:${crypto.createHash("sha256").update(input).digest("hex").slice(0, 24)}…`;

    case "tokenization":
      // A stable surrogate: same input maps to the same token, and the token
      // cannot be reversed without the mapping table.
      return `tok_${crypto.createHash("sha256").update(input).digest("hex").slice(0, 16)}`;

    case "generalization": {
      // Keep the least specific part that is still useful for analysis.
      if (/^\d{4}-\d{2}-\d{2}/.test(input)) return `${input.slice(0, 4)} (year only)`;
      if (input.includes(",")) {
        const parts = input.split(",").map((part) => part.trim()).filter(Boolean);
        return parts.length > 1 ? parts[parts.length - 2] : parts[0];
      }
      if (/^-?\d+(\.\d+)?$/.test(input)) {
        const bucket = Math.floor(Number(input) / 10000) * 10000;
        return `${bucket}–${bucket + 10000} (range)`;
      }
      return input.split(/\s+/)[0];
    }

    case "masking":
    default: {
      if (input.includes("@")) {
        const [local, domain] = input.split("@");
        return `${local.slice(0, 1)}${"•".repeat(Math.max(2, local.length - 1))}@${domain}`;
      }
      if (input.length <= 4) return "•".repeat(input.length);
      return `${"•".repeat(input.length - 4)}${input.slice(-4)}`;
    }
  }
}

/**
 * Build a before/after preview for the selected fields.
 * `fields` is the detected inventory, so each sample matches the identifier
 * type that was actually found rather than being guessed from the column name.
 */
export function buildPreview(selectedFields = [], techniques = {}, inventory = []) {
  const typeByField = new Map(inventory.map((field) => [field.field, field.piiType]));
  const raw = {};
  const anonymized = {};

  for (const name of selectedFields) {
    const sample = sampleFor(typeByField.get(name) || "");
    raw[name] = sample;
    anonymized[name] = applyTechnique(sample, techniques[name]);
  }

  return {
    raw,
    anonymized,
    synthetic: true,
    note: "Values shown are representative samples, not records from the connected platform. The portal never displays real personal data."
  };
}
