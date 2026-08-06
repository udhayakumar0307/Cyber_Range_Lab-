import { getRegisterSnapshot } from "./plc/registerStore";

export function evaluateAlarms(state) {
  const process = getRegisterSnapshot(state);
  const alarms = [];

  if (process.tankLevel > 90) alarms.push({ id: "LAH101", severity: "HIGH", equipment: "Tank", message: "High Tank Level" });
  if (process.tankLevel < 15) alarms.push({ id: "LAL101", severity: "HIGH", equipment: "Tank", message: "Low Tank Level" });
  if (process.temperature > 75) alarms.push({ id: "TAH101", severity: "HIGH", equipment: "Heater", message: "High Temperature" });
  if (process.pumpStatus === "RUNNING" && process.flowRate < 5) alarms.push({ id: "FAL101", severity: "MEDIUM", equipment: "Pump", message: "Low Flow Detected" });
  if (process.valvePosition < 10) alarms.push({ id: "VAL101", severity: "LOW", equipment: "Valve", message: "Valve Nearly Closed" });

  return alarms;
}
