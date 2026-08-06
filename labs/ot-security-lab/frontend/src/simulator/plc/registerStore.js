import { PLC_REGISTERS } from "./plcEngine";

export const REGISTER_METADATA = Object.freeze({
  [PLC_REGISTERS.TANK_LEVEL]: { tag: "LT101", kind: "measurement", unit: "%" },
  [PLC_REGISTERS.FLOW_RATE]: { tag: "FT101", kind: "measurement", unit: "L/min" },
  [PLC_REGISTERS.TEMPERATURE]: { tag: "TT101", kind: "measurement", unit: "°C" },
  [PLC_REGISTERS.CHEMICAL_LEVEL]: { tag: "AT101", kind: "measurement", unit: "ppm" },
  [PLC_REGISTERS.VALVE_POSITION]: { tag: "XV101", kind: "command", unit: "%" },
  [PLC_REGISTERS.PUMP_COMMAND]: { tag: "P101", kind: "command", unit: "boolean" },
  [PLC_REGISTERS.HEATER_COMMAND]: { tag: "H101", kind: "command", unit: "boolean" },
  [PLC_REGISTERS.CHEMICAL_TARGET]: { tag: "DP101", kind: "setpoint", unit: "ppm" },
});

export function readRegister(state, register, fallback = null) {
  const value = state?.plc?.registers?.[register];
  return value === undefined ? fallback : value;
}

export function getRegisterSnapshot(state) {
  return {
    tankLevel: Number(readRegister(state, PLC_REGISTERS.TANK_LEVEL, 70.5)),
    flowRate: Number(readRegister(state, PLC_REGISTERS.FLOW_RATE, 25)),
    temperature: Number(readRegister(state, PLC_REGISTERS.TEMPERATURE, 70.5)),
    chemicalLevel: Number(readRegister(state, PLC_REGISTERS.CHEMICAL_LEVEL, 108)),
    valvePosition: Number(readRegister(state, PLC_REGISTERS.VALVE_POSITION, 50)),
    pumpStatus:
      Number(readRegister(state, PLC_REGISTERS.PUMP_COMMAND, 1)) === 1
        ? "RUNNING"
        : "STOPPED",
    heaterStatus:
      Number(readRegister(state, PLC_REGISTERS.HEATER_COMMAND, 1)) === 1
        ? "ON"
        : "OFF",
    chemicalTarget: Number(
      readRegister(state, PLC_REGISTERS.CHEMICAL_TARGET, 108)
    ),
  };
}

// Compatibility projection for existing UI components. The PLC register map
// remains authoritative; these top-level fields are derived read models only.
export function projectRegistersToState(state) {
  const snapshot = getRegisterSnapshot(state);

  return {
    ...state,
    ...snapshot,
    pumpCommand: snapshot.pumpStatus,
    heaterCommand: snapshot.heaterStatus,
    valvePositionTarget: snapshot.valvePosition,
  };
}
