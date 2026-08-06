import { updateDeviceValue } from "./deviceEngine";

export function updateSensorReadings(devices, plantState) {
  let updated = { ...devices };

  updated = updateDeviceValue(updated, "LT101", {
    value: Number(plantState.tankLevel.toFixed(1)),
    health: getSensorHealth(plantState.tankLevel, 0, 100),
  });

  updated = updateDeviceValue(updated, "FT101", {
    value: Number(plantState.flowRate.toFixed(1)),
    health: getSensorHealth(plantState.flowRate, 0, 40),
  });

  updated = updateDeviceValue(updated, "TT101", {
    value: Number(plantState.temperature.toFixed(1)),
    health: getSensorHealth(plantState.temperature, 20, 120),
  });

  updated = updateDeviceValue(updated, "AT101", {
    value: Number(plantState.chemicalLevel.toFixed(1)),
    health: getSensorHealth(plantState.chemicalLevel, 0, 500),
  });

  return updated;
}

export function spoofSensor(devices, deviceId, spoofedValue) {
  return updateDeviceValue(devices, deviceId, {
    value: spoofedValue,
    health: "SPOOFED",
  });
}

export function freezeSensor(devices, deviceId) {
  return updateDeviceValue(devices, deviceId, {
    health: "FROZEN",
  });
}

function getSensorHealth(value, min, max) {
  if (value < min || value > max) return "FAULT";
  return "HEALTHY";
}
