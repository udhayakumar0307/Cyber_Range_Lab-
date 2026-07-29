import { PLC_REGISTERS } from "./plcEngine";

export function recoveryActionToPLCWrite(actionType) {
  switch (actionType) {
    case "START_PUMP":
      return {
        register: PLC_REGISTERS.PUMP_COMMAND,
        value: 1,
        description: "Start Pump P101",
      };

    case "OPEN_VALVE":
      return {
        register: PLC_REGISTERS.VALVE_POSITION,
        value: 50,
        description: "Restore Valve XV101 to 50%",
      };

    case "RESET_HEATER":
      return {
        register: PLC_REGISTERS.HEATER_COMMAND,
        value: 1,
        description: "Reset Heater H101",
      };

    case "RESET_CHEMICAL":
      return {
        register: PLC_REGISTERS.CHEMICAL_TARGET,
        value: 108,
        description: "Normalize Chemical Target",
      };

    case "STOP_PUMP":
      return {
        register: PLC_REGISTERS.PUMP_COMMAND,
        value: 0,
        description: "Stop Pump P101",
      };

    default:
      return null;
  }
}

export function attackToPLCWrite(attackType) {
  switch (attackType) {
    case "CLOSE_VALVE":
      return {
        register: PLC_REGISTERS.VALVE_POSITION,
        value: 0,
        description: "Force Valve XV101 Closed",
      };

    case "STOP_PUMP":
      return {
        register: PLC_REGISTERS.PUMP_COMMAND,
        value: 0,
        description: "Stop Pump P101",
      };

    case "HEATER_RUNAWAY":
      return {
        register: PLC_REGISTERS.HEATER_COMMAND,
        value: 1,
        extra: {
          temperatureTarget: 95,
        },
        description: "Force Heater Runaway",
      };

    case "CHEMICAL_OVERDOSE":
      return {
        register: PLC_REGISTERS.CHEMICAL_TARGET,
        value: 300,
        description: "Chemical Overdose",
      };

    default:
      return null;
  }
}
