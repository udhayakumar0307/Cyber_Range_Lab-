import { processAttacks } from "./process";
import { spoofingAttacks } from "./spoofing";
import { networkAttacks } from "./network";
import { plcAttacks } from "./plc";

export const attackLibrary = {
  ...processAttacks,
  ...spoofingAttacks,
  ...networkAttacks,
  ...plcAttacks,
};

export function getAttackDefinition(attackId) {
  return attackLibrary[attackId] || null;
}

export function getAllAttacks() {
  return Object.values(attackLibrary);
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
  }));
}
