import { updateDeviceValue } from "./deviceEngine";

export function updateActuatorStates(devices, plantState) {
  let updated = { ...devices };

  updated = updateDeviceValue(updated, "P101", {
    command: plantState.pumpStatus,
    status: plantState.pumpStatus,
    health: plantState.pumpStatus === "RUNNING" ? "HEALTHY" : "STOPPED",
  });

  updated = updateDeviceValue(updated, "XV101", {
    command: plantState.valvePosition,
    position: plantState.valvePosition,
    status: plantState.valvePosition > 20 ? "OPEN" : "CLOSED",
    health: plantState.valvePosition > 10 ? "HEALTHY" : "WARNING",
  });

  updated = updateDeviceValue(updated, "H101", {
    command: plantState.heaterStatus,
    status: plantState.heaterStatus,
    health: plantState.temperature > 75 ? "WARNING" : "HEALTHY",
  });

  return updated;
}

export function commandPump(devices, command) {
  return updateDeviceValue(devices, "P101", {
    command,
    status: command,
    health: command === "RUNNING" ? "HEALTHY" : "STOPPED",
  });
}

export function commandValve(devices, position) {
  return updateDeviceValue(devices, "XV101", {
    command: position,
    position,
    status: position > 20 ? "OPEN" : "CLOSED",
    health: position > 10 ? "HEALTHY" : "WARNING",
  });
}

export function commandHeater(devices, command) {
  return updateDeviceValue(devices, "H101", {
    command,
    status: command,
  });
}
