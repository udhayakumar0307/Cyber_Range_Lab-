import { classifyDataset, availableSectors, loadSectorPack } from "./classifier.js";

// Infer a company's sector from the identifiers its data actually contains.
//
// Used only when an operator onboards a company without choosing a sector.
// Defaulting everyone to "generic" would silently drop the regulator overlay
// and the sector weighting, so the analysis would look complete while applying
// none of the sector's rules. Inference is reported back to the caller with its
// reason, and an explicit choice always wins over it.

// Which categories point at which sector. Derived from the identifier classes
// that are characteristic of each, not from company names.
const SIGNALS = {
  finance: ["Financial Data"],
  healthcare: ["Health Data"],
  telecom: ["Technical Identifier", "Location Data"],
  ecommerce: ["Behavioural", "Location Data"]
};

export function inferSector(records = []) {
  if (!records.length) {
    return { sector: "generic", confidence: 0, reason: "No records returned, so no sector could be inferred." };
  }

  // Classify once with no weighting, then look at which categories appeared.
  const { fields } = classifyDataset(records, "generic");
  if (!fields.length) {
    return { sector: "generic", confidence: 0, reason: "No personal-data fields were detected." };
  }

  const strength = new Map();
  for (const field of fields) {
    strength.set(field.category, (strength.get(field.category) || 0) + field.score * field.coverage);
  }

  const known = new Set(availableSectors().map((entry) => entry.sector));
  const scored = Object.entries(SIGNALS)
    .filter(([sector]) => known.has(sector))
    .map(([sector, categories]) => ({
      sector,
      score: categories.reduce((sum, category) => sum + (strength.get(category) || 0), 0),
      matched: categories.filter((category) => strength.has(category))
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score <= 0) {
    return { sector: "generic", confidence: 0, reason: "No sector-specific identifiers were found." };
  }

  const total = scored.reduce((sum, entry) => sum + entry.score, 0);
  const confidence = total ? Number((best.score / total).toFixed(2)) : 0;
  const pack = loadSectorPack(best.sector);

  return {
    sector: best.sector,
    confidence,
    reason: `Detected ${best.matched.join(" and ")} fields, characteristic of ${pack.label} (${pack.regulator}).`
  };
}
