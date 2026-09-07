// Detector registry.
//
// A detector recognises one kind of personal data. It carries a name pattern
// (matched against the column name) and, where the identifier has a checkable
// structure, a value validator. Name matching alone is what turns a column
// called `account_name` into "Full Name"; validating the value is what tells a
// column of PANs apart from a column of order references.
//
// Detectors are data, not logic: sector packs select and re-weight them by id.

// ── value validators ─────────────────────────────────────────────────────────

// Verhoeff checksum, used by UIDAI for Aadhaar numbers.
const D_TABLE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];
const P_TABLE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

export function isAadhaar(value) {
  const digits = String(value).replace(/[\s-]/g, "");
  if (!/^[2-9]\d{11}$/.test(digits)) return false;
  let checksum = 0;
  const reversed = digits.split("").reverse().map(Number);
  reversed.forEach((digit, index) => {
    checksum = D_TABLE[checksum][P_TABLE[index % 8][digit]];
  });
  return checksum === 0;
}

// Luhn, used by payment card numbers.
export function isLuhnValid(value) {
  const digits = String(value).replace(/[\s-]/g, "");
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function isGstin(value) {
  const code = String(value).trim().toUpperCase();
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9][Z][A-Z0-9]$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const digit = GSTIN_CHARS.indexOf(code[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(digit / 36) + (digit % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === code[14];
}

const matches = (pattern) => (value) => pattern.test(String(value).trim());

// ── the registry ─────────────────────────────────────────────────────────────
// base: sensitivity 0..1 before any sector weighting is applied.

export const DETECTORS = [
  // Government and statutory identifiers
  { id: "in.aadhaar", type: "Aadhaar Number", category: "National Identifier", base: 1.0,
    names: [/aadhaar/i, /aadhar/i, /\buid\b/i], validate: isAadhaar },
  { id: "in.pan", type: "PAN", category: "National Identifier", base: 0.9,
    names: [/\bpan\b/i, /pan[_-]?(no|number|card)/i, /permanent[_-]?account/i],
    validate: matches(/^[A-Z]{5}\d{4}[A-Z]$/i) },
  { id: "in.passport", type: "Passport Number", category: "National Identifier", base: 0.9,
    names: [/passport/i], validate: matches(/^[A-PR-WY][0-9]{7}$/i) },
  { id: "in.voter", type: "Voter ID", category: "National Identifier", base: 0.85,
    names: [/voter/i, /epic[_-]?(no|id)/i], validate: matches(/^[A-Z]{3}\d{7}$/i) },
  { id: "in.driving_licence", type: "Driving Licence", category: "National Identifier", base: 0.85,
    names: [/driving[_-]?licen[cs]e/i, /\bdl[_-]?(no|number)\b/i] },

  // Financial
  { id: "in.bank_account", type: "Bank Account Number", category: "Financial Data", base: 0.95,
    names: [/account[_-]?(no|number)/i, /\bacct\b/i, /bank[_-]?account/i],
    validate: matches(/^\d{9,18}$/) },
  { id: "in.ifsc", type: "IFSC Code", category: "Financial Data", base: 0.6,
    names: [/ifsc/i], validate: matches(/^[A-Z]{4}0[A-Z0-9]{6}$/i) },
  { id: "in.upi", type: "UPI ID", category: "Financial Data", base: 0.8,
    names: [/\bupi\b/i, /\bvpa\b/i], validate: matches(/^[\w.\-]{2,256}@[a-z]{2,64}$/i) },
  { id: "fin.card", type: "Payment Card Number", category: "Financial Data", base: 1.0,
    names: [/card[_-]?(no|number)/i, /\bpan[_-]?card[_-]?no\b/i, /credit[_-]?card/i],
    validate: isLuhnValid },
  { id: "fin.balance", type: "Account Balance", category: "Financial Data", base: 0.75,
    names: [/balance/i, /available[_-]?funds/i] },
  { id: "fin.transaction", type: "Transaction Record", category: "Financial Data", base: 0.7,
    names: [/transaction/i, /\btxn\b/i, /statement/i] },
  { id: "fin.kyc", type: "KYC Document", category: "Financial Data", base: 0.9,
    names: [/\bkyc\b/i, /identity[_-]?proof/i, /address[_-]?proof/i] },
  { id: "in.gstin", type: "GSTIN", category: "Financial Data", base: 0.5,
    names: [/gstin/i, /\bgst\b/i], validate: isGstin },
  { id: "fin.demat", type: "Demat / Client Code", category: "Financial Data", base: 0.85,
    names: [/demat/i, /\bbo[_-]?id\b/i, /client[_-]?code/i] },

  // Health
  { id: "in.abha", type: "ABHA / Health ID", category: "Health Data", base: 1.0,
    names: [/\babha\b/i, /health[_-]?id/i], validate: matches(/^\d{14}$/) },
  { id: "hlt.diagnosis", type: "Medical Record", category: "Health Data", base: 1.0,
    names: [/diagnos/i, /prescription/i, /medical/i, /treatment/i, /blood[_-]?group/i, /allerg/i] },
  { id: "hlt.insurance", type: "Insurance Policy", category: "Health Data", base: 0.8,
    names: [/policy[_-]?(no|number)/i, /\btpa\b/i, /claim[_-]?(no|id)/i] },

  // Biometric and credentials
  { id: "sec.biometric", type: "Biometric Data", category: "Biometric", base: 1.0,
    names: [/biometric/i, /fingerprint/i, /\biris\b/i, /face[_-]?(id|print|scan)/i] },
  { id: "sec.credential", type: "Credential", category: "Credentials", base: 1.0,
    names: [/password/i, /passphrase/i, /\bsecret\b/i, /\btoken\b/i, /api[_-]?key/i, /\bpin\b/i, /\botp\b/i] },

  // Contact and identity
  { id: "gen.email", type: "Email Address", category: "Contact Information", base: 0.55,
    names: [/e-?mail/i], validate: matches(/^[^@\s]+@[^@\s]+\.[^@\s]+$/) },
  { id: "in.msisdn", type: "Phone Number", category: "Contact Information", base: 0.6,
    names: [/phone/i, /mobile/i, /telephone/i, /msisdn/i, /contact[_-]?(no|number)/i],
    validate: matches(/^(\+?91[\s-]?)?[6-9]\d{9}$|^\+?\d{8,15}$/) },
  { id: "gen.address", type: "Physical Address", category: "Location Data", base: 0.65,
    names: [/address/i, /street/i, /\bcity\b/i, /pin[_-]?code/i, /postal/i, /locality/i] },
  { id: "gen.geo", type: "Precise Location", category: "Location Data", base: 0.8,
    names: [/latitude/i, /longitude/i, /\bgeo\b/i, /coordinates/i] },
  { id: "gen.name", type: "Full Name", category: "Identity Information", base: 0.5,
    names: [/full[_-]?name/i, /first[_-]?name/i, /last[_-]?name/i, /customer[_-]?name/i, /^name$/i] },
  { id: "gen.dob", type: "Date of Birth", category: "Identity Information", base: 0.7,
    names: [/date[_-]?of[_-]?birth/i, /\bdob\b/i, /birth[_-]?date/i] },

  // Guardian and child-related — DPDP s.9
  { id: "dpdp.minor_flag", type: "Child Status", category: "Child Data", base: 1.0,
    names: [/is[_-]?minor/i, /is[_-]?child/i, /under[_-]?age/i] },
  { id: "dpdp.guardian", type: "Guardian Detail", category: "Child Data", base: 0.9,
    names: [/guardian/i, /parent[_-]?(name|email|contact)/i] },

  // Technical identifiers
  { id: "tech.ip", type: "IP Address", category: "Technical Identifier", base: 0.4,
    names: [/ip[_-]?address/i, /^ip$/i],
    validate: matches(/^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]{3,39}$/i) },
  { id: "tech.device", type: "Device Identifier", category: "Technical Identifier", base: 0.45,
    names: [/device[_-]?id/i, /\bimei\b/i, /\bmac[_-]?address\b/i, /advertis/i] },
  { id: "tech.session", type: "Session Identifier", category: "Technical Identifier", base: 0.35,
    names: [/session/i, /cookie/i] },

  // Behavioural
  { id: "beh.purpose", type: "Processing Purpose", category: "Behavioural", base: 0.3,
    names: [/purpose/i, /consent[_-]?type/i] },
  { id: "beh.order", type: "Order / Usage History", category: "Behavioural", base: 0.45,
    names: [/order/i, /\bcart\b/i, /purchase/i, /browsing/i, /wishlist/i] }
];

// Columns that carry no personal data. Counting these as PII is what inflated
// the old field totals: a boolean compliance flag is a finding, not an
// identifier, and a surrogate row id identifies a row rather than a person.
export const NON_PII_PATTERNS = [
  /^id$/i, /_?violation$/i, /^created(_at)?$/i, /^updated(_at)?$/i,
  /^timestamp$/i, /^status$/i, /^consent_status$/i, /^verified$/i,
  /_verified$/i, /^has_/i, /_deleted_at$/i, /_granted_at$/i, /_revoked_at$/i,
  /^limit$/i, /^offset$/i, /^page$/i, /^total$/i
];

export function isNonPiiColumn(columnName) {
  return NON_PII_PATTERNS.some((pattern) => pattern.test(columnName));
}

export function detectorById(id) {
  return DETECTORS.find((detector) => detector.id === id) || null;
}
