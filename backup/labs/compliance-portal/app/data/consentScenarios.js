import { consents } from "./consents.js";

export const complianceTestKeys = {
  "cms_test_sk_8f2a91d7c4b64e3fa0d925b71e6a34c2": "baseline",
  "dds_ecom_live_418850408699058e07b95f643ba6b9aba80c2eae": "baseline",
  "cms_test_sk_42b7f0a9e6d34c81b5f2a7d93c0e18ab": "marketingHeavy",
  "dds_demo_key_91f4c2a87e6b49dca2517ff03b0e8c19": "revocationHeavy",
  "dpdp_readiness_test_6d3b9f20a44d48c98a5b12ef77c901ad": "highReadiness",
  "dds_dpdp_score_50_test": "low",
  "dds_dpdp_score_75_test": "medium",
  "dds_dpdp_score_80_test": "strong"
};

const marketingHeavyConsents = [
  ...consents,
  {
    user_id: "MK009",
    name: "Ira Kapoor",
    email: "ira@example.com",
    phone: "9444411111",
    address: "Mumbai, India",
    purpose: "Marketing",
    consent_status: "granted",
    timestamp: "2026-05-24T10:20:00Z"
  },
  {
    user_id: "MK010",
    name: "Dev Nair",
    email: "dev@example.com",
    phone: "9444422222",
    address: "Kochi, India",
    purpose: "Marketing",
    consent_status: "granted",
    timestamp: "2026-05-24T12:35:00Z"
  },
  {
    user_id: "MK011",
    name: "Tara Singh",
    email: "tara@example.com",
    phone: "9444433333",
    address: "Jaipur, India",
    purpose: "Marketing",
    consent_status: "granted",
    timestamp: "2026-05-25T09:10:00Z"
  },
  {
    user_id: "MK012",
    name: "Neil Bose",
    email: "neil@example.com",
    phone: "9444444444",
    address: "Kolkata, India",
    purpose: "Marketing",
    consent_status: "revoked",
    timestamp: "2026-05-25T16:45:00Z"
  }
];

const revocationHeavyConsents = [
  {
    user_id: "R001",
    name: "Anika Sen",
    email: "anika@example.com",
    purpose: "Marketing",
    consent_status: "revoked",
    timestamp: "2026-05-25T17:40:00Z"
  },
  {
    user_id: "R002",
    name: "Vikram Das",
    phone: "9111100002",
    purpose: "Research",
    consent_status: "revoked",
    timestamp: "2026-05-25T13:20:00Z"
  },
  {
    user_id: "R003",
    name: "Meera Roy",
    email: "meera@example.com",
    purpose: "Analytics",
    consent_status: "revoked",
    timestamp: "2026-05-24T19:05:00Z"
  },
  {
    user_id: "R004",
    name: "Arjun Gill",
    purpose: "Marketing",
    consent_status: "revoked",
    timestamp: "2026-05-24T11:30:00Z"
  },
  {
    user_id: "R005",
    name: "Fatima Ali",
    email: "fatima@example.com",
    purpose: "Research",
    consent_status: "revoked"
  },
  {
    user_id: "R006",
    name: "Kunal Rao",
    phone: "9111100006",
    purpose: "Analytics",
    consent_status: "granted",
    timestamp: "2026-05-23T08:00:00Z"
  },
  {
    user_id: "R007",
    name: "Riya Menon",
    purpose: "Marketing",
    consent_status: "granted",
    timestamp: "2026-05-22T15:15:00Z"
  }
];

const highReadinessConsents = [
  ...consents,
  {
    user_id: "H009",
    name: "Aditya Jain",
    email: "aditya@example.com",
    phone: "9333311111",
    address: "Indore, India",
    purpose: "Analytics",
    consent_status: "granted",
    timestamp: "2026-05-24T08:15:00Z"
  },
  {
    user_id: "H010",
    name: "Leena Thomas",
    email: "leena@example.com",
    phone: "9333322222",
    address: "Thiruvananthapuram, India",
    purpose: "Research",
    consent_status: "granted",
    timestamp: "2026-05-24T10:45:00Z"
  },
  {
    user_id: "H011",
    name: "Om Prakash",
    email: "om@example.com",
    phone: "9333333333",
    address: "Lucknow, India",
    purpose: "Marketing",
    consent_status: "granted",
    timestamp: "2026-05-25T09:30:00Z"
  },
  {
    user_id: "H012",
    name: "Zoya Merchant",
    email: "zoya@example.com",
    phone: "9333344444",
    address: "Surat, India",
    purpose: "Analytics",
    consent_status: "revoked",
    timestamp: "2026-05-25T18:10:00Z"
  }
];

const lowComplianceConsents = [
  {
    user_id: "L001",
    name: "Low Score User 1",
    consent_status: "granted",
    purpose: "Marketing",
    timestamp: "2026-05-20T10:30:00Z"
  },
  { user_id: "L002", name: "Low Score User 2", consent_status: "granted" },
  { user_id: "L003", name: "Low Score User 3", consent_status: "granted" },
  { user_id: "L004", name: "Low Score User 4", consent_status: "granted" },
  { user_id: "L005", name: "Low Score User 5", consent_status: "granted" },
  { user_id: "L006", name: "Low Score User 6", consent_status: "granted" },
  { user_id: "L007", name: "Low Score User 7", consent_status: "granted" },
  { user_id: "L008", name: "Low Score User 8", consent_status: "granted" }
];

const mediumComplianceConsents = [
  {
    user_id: "M001",
    name: "Medium Score User 1",
    email: "medium1@example.com",
    purpose: "Marketing",
    consent_status: "granted",
    timestamp: "2026-05-20T10:30:00Z"
  },
  {
    user_id: "M002",
    name: "Medium Score User 2",
    email: "medium2@example.com",
    purpose: "Research",
    consent_status: "revoked",
    timestamp: "2026-05-21T11:10:00Z"
  },
  {
    user_id: "M003",
    name: "Medium Score User 3",
    phone: "9000000003",
    purpose: "Analytics",
    consent_status: "revoked",
    timestamp: "2026-05-22T13:15:00Z"
  },
  {
    user_id: "M004",
    name: "Medium Score User 4",
    phone: "9000000004",
    purpose: "Marketing",
    consent_status: "revoked",
    timestamp: "2026-05-23T14:25:00Z"
  },
  {
    user_id: "M005",
    name: "Medium Score User 5",
    email: "medium5@example.com",
    purpose: "Research",
    consent_status: "revoked"
  },
  {
    user_id: "M006",
    name: "Medium Score User 6",
    purpose: "Analytics",
    consent_status: "granted",
    timestamp: "2026-05-19T09:45:00Z"
  },
  {
    user_id: "M007",
    name: "Medium Score User 7",
    consent_status: "granted"
  },
  { user_id: "M008", name: "Medium Score User 8", consent_status: "granted" }
];

const strongComplianceConsents = [
  ...consents.slice(0, 5),
  {
    user_id: "S006",
    name: "Strong Score User 6",
    email: "strong6@example.com",
    phone: "9000000006",
    address: "Ahmedabad, India",
    purpose: "Research",
    consent_status: "granted",
    timestamp: "2026-05-18T15:05:00Z"
  },
  {
    user_id: "S007",
    name: "Strong Score User 7",
    consent_status: "granted"
  },
  { user_id: "S008", name: "Strong Score User 8", consent_status: "granted" }
];

export function getConsentsForApiKey(apiKey = "") {
  const scenario = complianceTestKeys[apiKey];

  if (scenario === "baseline") return consents;
  if (scenario === "marketingHeavy") return marketingHeavyConsents;
  if (scenario === "revocationHeavy") return revocationHeavyConsents;
  if (scenario === "highReadiness") return highReadinessConsents;
  if (scenario === "low") return lowComplianceConsents;
  if (scenario === "medium") return mediumComplianceConsents;
  if (scenario === "strong") return strongComplianceConsents;

  return null;
}

function classifyField(columnName, sampleValue) {
  const colLower = columnName.toLowerCase();
  
  if (colLower.includes("email")) return { pii_type: "Email Address", risk: "Medium" };
  if (colLower.includes("phone") || colLower.includes("mobile")) return { pii_type: "Phone Number", risk: "Medium" };
  if (colLower.includes("name")) return { pii_type: "Full Name", risk: "Medium" };
  if (colLower.includes("address") || colLower.includes("street") || colLower.includes("city")) return { pii_type: "Physical Address", risk: "Medium" };
  if (colLower.includes("aadhar") || colLower.includes("pan") || colLower.includes("ssn") || colLower.includes("national")) return { pii_type: "National Identifier", risk: "High" };
  if (colLower.includes("dob") || colLower.includes("birth")) return { pii_type: "Date of Birth", risk: "Medium" };
  if (colLower.includes("card") || colLower.includes("account") || colLower.includes("financial")) return { pii_type: "Financial Data", risk: "High" };
  if (colLower.includes("ip") || colLower.includes("ip_address")) return { pii_type: "IP Address", risk: "Low" };
  
  return { pii_type: "Other Personal Attribute", risk: "Low" };
}

export function getPiiResultsFromConsents(consents = []) {
  if (!consents || !consents.length) return [];
  
  const piiFieldsMap = new Map();
  
  consents.forEach((record) => {
    Object.entries(record).forEach(([key, val]) => {
      if (!val || String(val).trim() === "") return;
      const classification = classifyField(key, val);
      if (classification) {
        const uniqueKey = `${key}_${classification.pii_type}`;
        if (!piiFieldsMap.has(uniqueKey)) {
          piiFieldsMap.set(uniqueKey, {
            table: "consent_records",
            column: key,
            is_pii: true,
            pii_type: classification.pii_type,
            risk: classification.risk
          });
        }
      }
    });
  });
  
  return Array.from(piiFieldsMap.values());
}

export function getPiiRiskDetailsFromResults(results = []) {
  const fields = Array.from(new Set(results.map(r => r.pii_type)));
  let risk_level = "None";
  if (results.some(r => r.risk === "High")) {
    risk_level = "High";
  } else if (results.some(r => r.risk === "Medium")) {
    risk_level = "Medium";
  } else if (results.length > 0) {
    risk_level = "Low";
  }
  
  return {
    status: "success",
    risk_level,
    data: {
      fields,
      storage_location: "Local Database Store",
      encryption: "AES-256"
    }
  };
}
