export function calculateKpis(consents) {
  const total = consents.length;
  const granted = consents.filter((item) => {
    const s = String(item.consent_status || item.status || "").toLowerCase();
    return s === "granted" || s === "approved";
  }).length;
  const revoked = consents.filter((item) => {
    const s = String(item.consent_status || item.status || "").toLowerCase();
    return s === "revoked";
  }).length;
  const decided = granted + revoked;

  return {
    total,
    grantedPercent: total ? (granted / total) * 100 : 0,
    revokedPercent: total ? (revoked / total) * 100 : 0,
    revocationRate: decided ? (revoked / decided) * 100 : 0
  };
}

export function getStatusChartData(consents) {
  const granted = consents.filter((item) => {
    const s = String(item.consent_status || item.status || "").toLowerCase();
    return s === "granted" || s === "approved";
  }).length;
  const revoked = consents.filter((item) => {
    const s = String(item.consent_status || item.status || "").toLowerCase();
    return s === "revoked";
  }).length;

  return [
    { name: "Granted", value: granted },
    { name: "Revoked", value: revoked }
  ];
}

export function getPurposeChartData(consents) {
  const purposeMap = new Map();

  consents.forEach((item) => {
    const purpose = item.purpose || "Unspecified";
    if (!purposeMap.has(purpose)) {
      purposeMap.set(purpose, { purpose, granted: 0, revoked: 0 });
    }

    const entry = purposeMap.get(purpose);
    const s = String(item.consent_status || item.status || "").toLowerCase();
    if (s === "granted" || s === "approved") entry.granted += 1;
    if (s === "revoked") entry.revoked += 1;
  });

  return Array.from(purposeMap.values());
}

export function getRecentRevocations(consents) {
  return consents
    .filter((item) => {
      const s = String(item.consent_status || item.status || "").toLowerCase();
      return s === "revoked" && !Number.isNaN(new Date(item.timestamp).getTime());
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export function filterConsents(consents, purpose, searchTerm) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  return consents.filter((item) => {
    const matchesPurpose = purpose === "All" || item.purpose === purpose;
    const matchesSearch =
      !normalizedSearch ||
      (item.name || "").toLowerCase().includes(normalizedSearch) ||
      (item.user_id || "").toLowerCase().includes(normalizedSearch);

    return matchesPurpose && matchesSearch;
  });
}

export function toCsv(rows) {
  const headers = [
    "User ID",
    "Name",
    "Email",
    "Phone",
    "Address",
    "Purpose",
    "Consent Status",
    "Timestamp"
  ];

  const values = rows.map((item) => [
    item.user_id,
    item.name,
    item.email,
    item.phone,
    item.address,
    item.purpose,
    item.consent_status || item.status,
    item.timestamp
  ]);

  return [headers, ...values]
    .map((row) => row.map((cell) => `` + String(cell || "").replaceAll('"', '""') + ``).join(","))
    .map((row) => row)
    .join("\n");
}
