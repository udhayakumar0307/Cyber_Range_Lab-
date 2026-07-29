const NORMAL_RANGES = {
  tankLevel: { min: 69, max: 72, speed: 2600, noise: 0.08 },
  flowRate: { min: 24, max: 26, speed: 2200, noise: 0.05 },
  temperature: { min: 69, max: 72, speed: 2400, noise: 0.08 },
  chemicalLevel: { min: 106, max: 110, speed: 3000, noise: 0.08 },
};

export function updatePlantPhysics(prev) {
  const valveTarget = prev.valvePositionTarget ?? prev.valvePosition;
  const pumpTarget = prev.pumpCommand ?? prev.pumpStatus;
  const heaterCommand = prev.heaterCommand ?? prev.heaterStatus;
  const chemicalTarget = prev.chemicalTarget ?? prev.chemicalLevel;
  const temperatureTarget = prev.temperatureTarget ?? 70;

  // ==========================================================
  // Valve Dynamics
  // ==========================================================
  const valvePosition = moveToward(prev.valvePosition, valveTarget, 5);

  // ==========================================================
  // Pump Dynamics
  // ==========================================================
  let pumpStatus = prev.pumpStatus;

  if (pumpTarget === "STOPPED" && pumpStatus === "RUNNING") {
    pumpStatus = "STOPPING";
  } else if (pumpStatus === "STOPPING") {
    pumpStatus = "STOPPED";
  } else if (pumpTarget === "RUNNING" && pumpStatus === "STOPPED") {
    pumpStatus = "STARTING";
  } else if (pumpStatus === "STARTING") {
    pumpStatus = "RUNNING";
  }

  const pumpEffect =
    pumpStatus === "RUNNING"
      ? 1
      : pumpStatus === "STARTING"
      ? 0.5
      : pumpStatus === "STOPPING"
      ? 0.4
      : 0;

  const normalControls = isNormalControlState({
    pumpTarget,
    pumpStatus,
    valveTarget,
    heaterCommand,
    temperatureTarget,
    chemicalTarget,
  });

  // ==========================================================
  // Flow
  // ==========================================================
  const valveEffect = valvePosition / 100;

  // Normal valve position is 50%, so use 50 as the full-scale base.
  // This gives 50 * 1.0 * 0.5 = 25 L/min during normal operation.
  const targetFlow = 50 * pumpEffect * valveEffect;
  let flowRate = moveToward(prev.flowRate, targetFlow, 3);

  if (normalControls) {
    const normalFlowTarget = oscillationTarget(NORMAL_RANGES.flowRate);
    flowRate = moveToward(flowRate, normalFlowTarget, 0.6);
  }

  // ==========================================================
  // Tank
  // ==========================================================
  const nominalFlow = 25;
  const nominalInlet = 0.25;

  const inletRate = nominalInlet;
  const outletRate = nominalInlet * (flowRate / nominalFlow);

  let tankLevel = clamp(prev.tankLevel + inletRate - outletRate, 0, 100);

  if (normalControls) {
    const normalTankTarget = oscillationTarget(NORMAL_RANGES.tankLevel);
    tankLevel = moveToward(tankLevel, normalTankTarget, 0.18);
  }

  // ==========================================================
  // Temperature
  // ==========================================================
  let temperature = prev.temperature;

  if (heaterCommand === "ON" && flowRate > 5) {
    temperature = moveToward(temperature, temperatureTarget, 0.35);
  } else {
    temperature = moveToward(temperature, 35, 0.15);
  }

  if (normalControls) {
    const normalTemperatureTarget = oscillationTarget(NORMAL_RANGES.temperature);
    temperature = moveToward(temperature, normalTemperatureTarget, 0.25);
  }

  // ==========================================================
  // Chemical
  // ==========================================================
  let chemicalLevel = clamp(
    moveToward(prev.chemicalLevel, chemicalTarget, 3),
    0,
    500
  );

  if (normalControls) {
    const normalChemicalTarget = oscillationTarget(NORMAL_RANGES.chemicalLevel);
    chemicalLevel = moveToward(chemicalLevel, normalChemicalTarget, 0.5);
  }

  return {
    ...prev,

    valvePosition: clamp(valvePosition, 0, 100),
    pumpStatus,
    heaterStatus: heaterCommand,

    flowRate: clamp(flowRate, 0, 40),
    tankLevel: clamp(tankLevel, 0, 100),
    temperature: clamp(temperature, 20, 120),
    chemicalLevel,
  };
}

function isNormalControlState({
  pumpTarget,
  pumpStatus,
  valveTarget,
  heaterCommand,
  temperatureTarget,
  chemicalTarget,
}) {
  return (
    pumpTarget === "RUNNING" &&
    (pumpStatus === "RUNNING" || pumpStatus === "STARTING") &&
    valveTarget >= 45 &&
    valveTarget <= 55 &&
    heaterCommand === "ON" &&
    temperatureTarget >= 69 &&
    temperatureTarget <= 72 &&
    chemicalTarget >= 106 &&
    chemicalTarget <= 110
  );
}

function oscillationTarget({ min, max, speed, noise }) {
  const midpoint = (min + max) / 2;
  const amplitude = (max - min) / 2;

  let value = midpoint + Math.sin(Date.now() / speed) * amplitude;
  value += (Math.random() - 0.5) * noise;

  return clamp(value, min, max);
}

function moveToward(current, target, step) {
  if (current < target) return Math.min(current + step, target);
  if (current > target) return Math.max(current - step, target);
  return current;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
