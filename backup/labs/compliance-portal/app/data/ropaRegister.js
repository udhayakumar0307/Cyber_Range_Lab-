export const ropaRegister = [
  {
    activity: "Marketing Consent Management",
    purpose: "Marketing",
    dataCategories: ["Name", "Email", "Phone"],
    lawfulBasis: "Consent",
    owner: "Growth",
    risk: "Medium",
    dpiaRequired: "Yes",
    dpiaStatus: "In Progress",
    lastReviewed: "2026-05-22"
  },
  {
    activity: "Product Analytics",
    purpose: "Analytics",
    dataCategories: ["User ID", "Address"],
    lawfulBasis: "Consent",
    owner: "Data Office",
    risk: "Medium",
    dpiaRequired: "No",
    dpiaStatus: "Not Required",
    lastReviewed: "2026-05-21"
  },
  {
    activity: "Research Participation Tracking",
    purpose: "Research",
    dataCategories: ["Name", "Email", "Address"],
    lawfulBasis: "Consent",
    owner: "Research Ops",
    risk: "High",
    dpiaRequired: "Yes",
    dpiaStatus: "Pending Review",
    lastReviewed: "2026-05-18"
  },
  {
    activity: "Revocation Audit Trail",
    purpose: "Compliance",
    dataCategories: ["User ID", "Consent Status", "Timestamp"],
    lawfulBasis: "Legal Obligation",
    owner: "Privacy Ops",
    risk: "Low",
    dpiaRequired: "No",
    dpiaStatus: "Not Required",
    lastReviewed: "2026-05-23"
  }
];

export function getRopaRegisterForApiKey(apiKey = "") {
  if (!apiKey) return ropaRegister;

  // Let's modify the dates and statuses dynamically depending on the API Key
  let offsetDays = 0;
  if (apiKey.includes("marketing")) offsetDays = 25;
  else if (apiKey.includes("revocation")) offsetDays = 45;
  else if (apiKey.includes("readiness")) offsetDays = 80;
  else if (apiKey.includes("50_test")) offsetDays = -30;
  else if (apiKey.includes("75_test")) offsetDays = -15;
  else if (apiKey.includes("80_test")) offsetDays = 60;
  else {
    let hash = 0;
    for (let i = 0; i < apiKey.length; i++) {
      hash = apiKey.charCodeAt(i) + ((hash << 5) - hash);
    }
    offsetDays = hash % 60;
  }

  return ropaRegister.map((item) => {
    const d = new Date(item.lastReviewed);
    d.setDate(d.getDate() + offsetDays);
    
    let dpiaStatus = item.dpiaStatus;
    if (apiKey.includes("readiness") || apiKey.includes("80_test")) {
      dpiaStatus = item.dpiaRequired === "Yes" ? "Completed" : "Not Required";
    } else if (apiKey.includes("50_test")) {
      dpiaStatus = item.dpiaRequired === "Yes" ? "Pending Review" : "Not Required";
    }

    return {
      ...item,
      dpiaStatus,
      lastReviewed: d.toISOString().split("T")[0]
    };
  });
}
