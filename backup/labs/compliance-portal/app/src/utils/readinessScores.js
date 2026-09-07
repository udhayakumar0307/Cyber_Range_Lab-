import { getPiiInventoryForApiKey } from "../../data/piiInventory.js";
import { getRopaRegisterForApiKey } from "../../data/ropaRegister.js";

export function calculateReadinessScores({ kpis, dpdpCompliance, apiKey = "" }) {
  const currentPiiInventory = getPiiInventoryForApiKey(apiKey);
  const currentRopaRegister = getRopaRegisterForApiKey(apiKey);

  const consentScore = Math.round(
    Math.min(100, kpis.grantedPercent * 0.55 + (100 - kpis.revokedPercent) * 0.25 + 20)
  );

  const highSensitivityFields = currentPiiInventory.filter((item) => item.sensitivity === "High").length;
  const protectedFields = currentPiiInventory.filter((item) => Boolean(item.protection)).length;
  const piiScore = Math.round(
    (protectedFields / currentPiiInventory.length) * 72 +
      ((currentPiiInventory.length - highSensitivityFields) / currentPiiInventory.length) * 18 +
      10
  );

  const dpiaComplete = currentRopaRegister.filter((item) =>
    ["Not Required", "Completed"].includes(item.dpiaStatus)
  ).length;
  const ropaScore = Math.round((dpiaComplete / currentRopaRegister.length) * 70 + 20);

  return {
    consent: consentScore,
    dpdp: dpdpCompliance.score,
    pii: piiScore,
    ropa: ropaScore
  };
}
