import { getRegisterSnapshot } from "./plc/registerStore";

export function evaluateExerciseState(state, alarms = []) {
  if (state.exerciseState === "NORMAL") return "NORMAL";

  const process = getRegisterSnapshot(state);
  const pumpHealthy = process.pumpStatus === "RUNNING";
  const valveHealthy = process.valvePosition >= 45 && process.valvePosition <= 55;
  const tankHealthy = process.tankLevel >= 60 && process.tankLevel <= 85;
  const flowHealthy = process.flowRate >= 24 && process.flowRate <= 26;
  const tempHealthy = process.temperature >= 69 && process.temperature <= 72;
  const chemicalHealthy = process.chemicalLevel >= 95 && process.chemicalLevel <= 125;

  if (
    state.exerciseState === "RECOVERY" &&
    pumpHealthy && valveHealthy && tankHealthy && flowHealthy &&
    tempHealthy && chemicalHealthy && alarms.length === 0
  ) return "COMPLETE";

  return state.exerciseState;
}
