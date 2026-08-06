import { getRegisterSnapshot } from "./plc/registerStore";

export function createHistorianPoint(state) {
  const process = getRegisterSnapshot(state);
  return {
    time: new Date().toLocaleTimeString(),
    tankLevel: Number(process.tankLevel.toFixed(1)),
    flowRate: Number(process.flowRate.toFixed(1)),
    temperature: Number(process.temperature.toFixed(1)),
    chemicalLevel: Number(process.chemicalLevel.toFixed(1)),
  };
}

export function updateHistorian(history = [], state, maxSamples = 20) {
  return [...history.slice(-(maxSamples - 1)), createHistorianPoint(state)];
}
