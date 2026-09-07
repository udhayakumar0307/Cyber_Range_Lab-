export const piiInventory = [
  {
    field: "name",
    label: "Full Name",
    category: "Direct Identifier",
    sensitivity: "Medium",
    purposes: ["Marketing", "Research"],
    source: "Consent API",
    owner: "Privacy Ops",
    protection: "Masked in exports",
    retention: "Until consent withdrawal"
  },
  {
    field: "email",
    label: "Email Address",
    category: "Contact Data",
    sensitivity: "High",
    purposes: ["Marketing", "Analytics"],
    source: "Consent API",
    owner: "Growth",
    protection: "Encrypted at rest",
    retention: "Until consent withdrawal"
  },
  {
    field: "phone",
    label: "Phone Number",
    category: "Contact Data",
    sensitivity: "High",
    purposes: ["Marketing"],
    source: "Consent API",
    owner: "Customer Success",
    protection: "Role-based access",
    retention: "Until consent withdrawal"
  },
  {
    field: "address",
    label: "Address",
    category: "Location Data",
    sensitivity: "High",
    purposes: ["Research", "Analytics"],
    source: "Consent API",
    owner: "Data Office",
    protection: "Restricted processing",
    retention: "365 days after last activity"
  },
  {
    field: "user_id",
    label: "User ID",
    category: "Pseudonymous Identifier",
    sensitivity: "Medium",
    purposes: ["Analytics", "Research"],
    source: "Consent API",
    owner: "Platform",
    protection: "Access logged",
    retention: "As per audit policy"
  }
];

export function getPiiInventoryForApiKey(apiKey = "") {
  if (!apiKey) return piiInventory;

  if (apiKey.includes("readiness") || apiKey.includes("80_test")) {
    return piiInventory.map(item => ({
      ...item,
      protection: item.protection || "Encrypted at rest"
    }));
  } else if (apiKey.includes("50_test")) {
    return piiInventory.map(item => ({
      ...item,
      protection: ""
    }));
  }

  return piiInventory;
}
