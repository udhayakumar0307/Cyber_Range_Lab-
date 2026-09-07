import { classifyDataset } from "./classifier.js";

// The portal exists to police personal data, so it must not become another copy
// of it. Analysis needs the values — a checksum cannot be verified without
// them — but nothing that leaves the server does. Records sent to the browser
// carry presence, not content: whether a field is populated is enough to judge
// completeness, minimisation and erasure, and it is all an operator needs.
//
// Anyone who genuinely needs the underlying value looks it up in the source
// system, against the record identifier, under that system's own access
// controls and audit trail.

const PRESENT = "Present";
const ABSENT = "Not provided";

const isEmpty = (value) =>
  value === null || value === undefined || String(value).trim() === "";

/**
 * Replace every classified personal-data value with a presence marker.
 * Operational fields — the record id, consent state, timestamps, compliance
 * flags — are left intact, because they carry no personal content and the
 * dashboard is unusable without them.
 */
export function redactRecords(records = [], sector = "generic") {
  if (!records.length) return [];

  const { fields } = classifyDataset(records, sector);
  const piiColumns = new Set(fields.map((field) => field.field));

  // A boolean flag says nothing about a person beyond what the compliance view
  // already reports, and blanking it would hide the very findings the portal
  // exists to surface.
  const keepAsIs = new Set(["is_minor", "is_child", "guardian_verified", "purpose", "consent_type"]);

  return records.map((record) => {
    const output = {};
    for (const [column, value] of Object.entries(record)) {
      if (piiColumns.has(column) && !keepAsIs.has(column)) {
        if (value === "Deleted") {
          output[column] = "Deleted";
        } else {
          output[column] = isEmpty(value) ? ABSENT : PRESENT;
        }
      } else {
        output[column] = value;
      }
    }
    return output;
  });
}

/** Which columns a redacted payload withheld, so the UI can say so. */
export function redactedColumns(records = [], sector = "generic") {
  if (!records.length) return [];
  const { fields } = classifyDataset(records, sector);
  const keepAsIs = new Set(["is_minor", "is_child", "guardian_verified", "purpose", "consent_type"]);
  return fields.filter((field) => !keepAsIs.has(field.field)).map((field) => field.field);
}
