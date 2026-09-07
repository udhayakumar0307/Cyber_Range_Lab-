// Sector-aware PII classifier.
//
// Walks a dataset of consent records, decides what each column actually holds,
// and returns a field inventory plus real instance counts. Nothing here is a
// multiplier: every number is derived from the records passed in.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DETECTORS, isNonPiiColumn } from "./detectors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACK_DIR = path.join(__dirname, "sectors");

const packCache = new Map();

export function loadSectorPack(sector) {
  const key = (sector || "generic").toLowerCase();
  if (packCache.has(key)) return packCache.get(key);

  const file = path.join(PACK_DIR, `${key}.json`);
  let pack;
  try {
    pack = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    if (key === "generic") throw new Error("generic sector pack is missing");
    pack = loadSectorPack("generic");
  }
  packCache.set(key, pack);
  return pack;
}

export function availableSectors() {
  return fs
    .readdirSync(PACK_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const pack = loadSectorPack(path.basename(file, ".json"));
      return { sector: pack.sector, label: pack.label, regulator: pack.regulator };
    });
}

// How many values to test per column. Validation exists to raise confidence,
// not to read the whole dataset into memory: results are booleans and the
// values themselves are never retained or logged.
const SAMPLE_SIZE = 25;

function matchDetector(columnName) {
  for (const detector of DETECTORS) {
    if (detector.names.some((pattern) => pattern.test(columnName))) return detector;
  }
  return null;
}

function confidenceFor(detector, samples) {
  if (!detector.validate) return { confidence: "name-only", validatedRatio: null };
  const testable = samples.filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
  if (!testable.length) return { confidence: "name-only", validatedRatio: null };
  const passed = testable.filter((value) => {
    try {
      return detector.validate(value);
    } catch {
      return false;
    }
  }).length;
  const ratio = passed / testable.length;
  if (ratio >= 0.8) return { confidence: "validated", validatedRatio: ratio };
  if (ratio > 0) return { confidence: "partial", validatedRatio: ratio };
  return { confidence: "name-mismatch", validatedRatio: 0 };
}

function riskBandFor(score) {
  if (score >= 0.8) return "Critical";
  if (score >= 0.6) return "High";
  if (score >= 0.35) return "Medium";
  return "Low";
}

/**
 * Classify a dataset for a given sector.
 * Returns the field inventory and instance counts — no presentation strings.
 */
export function classifyDataset(records = [], sector = "generic") {
  const pack = loadSectorPack(sector);
  const weights = pack.weights || {};
  const totalRecords = records.length;

  // Collect every column that appears anywhere in the dataset.
  const columns = new Map();
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    for (const [column, value] of Object.entries(record)) {
      if (!columns.has(column)) columns.set(column, { populated: 0, samples: [] });
      const entry = columns.get(column);
      const isEmpty = value === null || value === undefined || String(value).trim() === "";
      if (!isEmpty) {
        entry.populated += 1;
        if (entry.samples.length < SAMPLE_SIZE) entry.samples.push(value);
      }
    }
  }

  const fields = [];
  let piiInstances = 0;
  let sensitiveInstances = 0;

  for (const [column, entry] of columns) {
    if (isNonPiiColumn(column)) continue;
    const detector = matchDetector(column);
    if (!detector) continue;

    const { confidence, validatedRatio } = confidenceFor(detector, entry.samples);

    // A name match whose values all fail validation is very likely a false
    // positive (an `account_number` column holding order references), so it is
    // discounted rather than silently trusted.
    const confidencePenalty = confidence === "name-mismatch" ? 0.5 : 1;
    const weight = weights[detector.category] ?? 1;
    const score = Math.min(1, detector.base * weight * confidencePenalty);

    piiInstances += entry.populated;
    if (score >= 0.6) sensitiveInstances += entry.populated;

    fields.push({
      id: detector.id,
      field: column,
      piiType: detector.type,
      category: detector.category,
      riskLevel: riskBandFor(score),
      score: Number(score.toFixed(3)),
      confidence,
      validatedRatio: validatedRatio === null ? null : Number(validatedRatio.toFixed(2)),
      populated: entry.populated,
      coverage: totalRecords ? Number((entry.populated / totalRecords).toFixed(3)) : 0,
      sectorWeighted: weight !== 1
    });
  }

  fields.sort((a, b) => b.score - a.score || a.field.localeCompare(b.field));

  return {
    sector: pack.sector,
    sectorLabel: pack.label,
    regulator: pack.regulator,
    localisation: pack.localisation,
    totalRecords,
    fields,
    counts: {
      distinctPiiFields: fields.length,
      piiInstances,
      sensitiveInstances,
      criticalFields: fields.filter((f) => f.riskLevel === "Critical").length,
      validatedFields: fields.filter((f) => f.confidence === "validated").length
    }
  };
}
