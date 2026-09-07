// Third-party processors: who the company shares personal data with, for what,
// and under what contract.
//
// This is a disclosure obligation under DPDP — a Data Fiduciary stays
// accountable for personal data handed to a Data Processor, and s.8(2) requires
// that transfer to be under a valid contract. The portal cannot infer any of
// this from consent records, so it is either declared by the company through
// its own API or registered by an operator. It is never invented: an empty
// registry means nothing has been declared, which is itself a finding.

const KNOWN_INDIA = ["india", "in", "ind"];

const asBool = (value) =>
  value === true || value === "true" || value === 1 || value === "1" || value === "yes";

const asDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Accept whatever shape a company sends and produce one consistent record. */
export function normaliseProcessor(raw = {}, index = 0) {
  const location = String(raw.location ?? raw.country ?? raw.region ?? "").trim();
  const declaredCrossBorder = raw.crossBorder ?? raw.cross_border;
  const crossBorder = declaredCrossBorder !== undefined
    ? asBool(declaredCrossBorder)
    : Boolean(location) && !KNOWN_INDIA.includes(location.toLowerCase());

  const dpaSigned = asBool(raw.dpaSigned ?? raw.dpa_signed ?? raw.contract ?? raw.dpa);
  const dpaExpiry = asDate(raw.dpaExpiry ?? raw.dpa_expiry ?? raw.contractExpiry);
  const expired = dpaExpiry ? dpaExpiry.getTime() < Date.now() : false;

  const categories = Array.isArray(raw.dataCategories ?? raw.data_categories ?? raw.categories)
    ? (raw.dataCategories ?? raw.data_categories ?? raw.categories)
    : String(raw.dataCategories ?? raw.data_categories ?? raw.categories ?? "")
        .split(",").map((entry) => entry.trim()).filter(Boolean);

  return {
    id: String(raw.id ?? raw.processor_id ?? `TPS-${String(index + 1).padStart(4, "0")}`),
    name: raw.name ?? raw.processor ?? raw.vendor ?? raw.sharedTo ?? "Unnamed processor",
    purpose: raw.purpose ?? raw.processingPurpose ?? "Not stated",
    dataCategories: categories,
    location: location || "Not stated",
    crossBorder,
    dpaSigned,
    dpaExpiry: dpaExpiry ? dpaExpiry.toISOString() : null,
    dpaExpired: expired,
    sharingMedium: raw.sharingMedium ?? raw.sharing_medium ?? raw.medium ?? "API",
    lastSharedAt: (asDate(raw.lastSharedAt ?? raw.last_shared_at ?? raw.timestamp) || new Date()).toISOString(),
    source: raw.source ?? "declared"
  };
}

/**
 * Assess one processor. The severity ordering follows the obligation: sharing
 * without a contract is a breach of s.8(2) regardless of destination, and doing
 * it across a border compounds it.
 */
export function assessProcessor(processor) {
  const warnings = [];
  let status = "Compliant";

  if (!processor.dpaSigned) {
    warnings.push("No data processing agreement recorded (s.8(2))");
    status = "Violation";
  } else if (processor.dpaExpired) {
    warnings.push(`Processing agreement expired ${processor.dpaExpiry.slice(0, 10)}`);
    status = "Violation";
  }

  if (processor.crossBorder) {
    if (!processor.dpaSigned) {
      warnings.push(`Personal data leaves India (${processor.location}) with no contract in place`);
    } else {
      warnings.push(`Cross-border transfer to ${processor.location} — verify it is a permitted destination`);
      if (status === "Compliant") status = "Review";
    }
  }

  if (processor.purpose === "Not stated") {
    warnings.push("No processing purpose declared (s.5 notice)");
    if (status === "Compliant") status = "Review";
  }

  if (!processor.dataCategories.length) {
    warnings.push("Data categories shared are not declared");
    if (status === "Compliant") status = "Review";
  }

  return {
    ...processor,
    status,
    violationWarning: warnings[0] || null,
    warnings
  };
}

/** The shape the sharing log renders, plus the assessment behind it. */
export function toSharingRows(processors = []) {
  return processors.map((processor) => {
    const assessed = assessProcessor(processor);
    return {
      id: assessed.id,
      sharedTo: assessed.name,
      purpose: assessed.purpose,
      sharingMedium: assessed.sharingMedium,
      timestamp: assessed.lastSharedAt,
      status: assessed.status,
      violationWarning: assessed.violationWarning,
      warnings: assessed.warnings,
      location: assessed.location,
      crossBorder: assessed.crossBorder,
      dpaSigned: assessed.dpaSigned,
      dataCategories: assessed.dataCategories
    };
  });
}

export function summariseProcessors(rows = []) {
  return {
    total: rows.length,
    violations: rows.filter((row) => row.status === "Violation").length,
    needsReview: rows.filter((row) => row.status === "Review").length,
    crossBorder: rows.filter((row) => row.crossBorder).length,
    withoutContract: rows.filter((row) => !row.dpaSigned).length
  };
}
