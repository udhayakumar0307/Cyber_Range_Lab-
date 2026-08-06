import {
  attackLibrary,
  getAttackDefinition as getLibraryAttack,
  getAllAttacks as getLibraryAttacks,
} from "./attackLibrary";

export const ATTACK_SOURCES = Object.freeze({
  PROCESS: "EWS01",
  PLC: "EWS01",
  NETWORK: "UNKNOWN",
  SPOOFING: "UNKNOWN",
});

function resolvedSource(attack) {
  return (
    attack?.pcap?.source ||
    attack?.network?.actualSource ||
    attack?.network?.compromisedDevice ||
    ATTACK_SOURCES[attack?.category] ||
    "UNKNOWN"
  );
}

export function normalizeAttack(attack) {
  if (!attack) return null;

  return {
    ...attack,
    source: resolvedSource(attack),
    recoveryActions: Array.isArray(attack.recoveryActions)
      ? attack.recoveryActions
      : [],
  };
}

export function getAttackDefinition(attackId) {
  return normalizeAttack(getLibraryAttack(attackId));
}

export function getAllAttacks() {
  return getLibraryAttacks().map(normalizeAttack);
}

export function getAttacksByCategory(category) {
  return getAllAttacks().filter((attack) => attack.category === category);
}

export function getInstructorScenarios() {
  return getAllAttacks().map((attack) => ({
    title: attack.title,
    description: attack.description,
    severity: attack.severity,
    scenarioType: attack.id,
    category: attack.category,
    source: attack.source,
  }));
}

export function validateAttackLibrary() {
  return Object.values(attackLibrary).flatMap((attack) => {
    const errors = [];
    if (!attack.id) errors.push("missing id");
    if (!attack.title) errors.push(`${attack.id || "unknown"}: missing title`);
    if (!attack.category) errors.push(`${attack.id || "unknown"}: missing category`);
    return errors;
  });
}
