export const PLC_REGISTERS = {
  TANK_LEVEL: 40001,
  FLOW_RATE: 40002,
  TEMPERATURE: 40003,
  CHEMICAL_LEVEL: 40004,

  VALVE_POSITION: 40010,
  PUMP_COMMAND: 40020,
  HEATER_COMMAND: 40030,
  CHEMICAL_TARGET: 40040,
};

export function createInitialPLC() {
  return {
    id: "PLC01",
    name: "OpenPLC Controller",
    status: "ONLINE",
    protocol: "Modbus TCP",
    registers: {
      40001: 70.5,
      40002: 25,
      40003: 70.5,
      40004: 108,
      40010: 50,
      40020: 1,
      40030: 1,
      40040: 108,
    },
    lastCommand: null,
  };
}

export function plcReadRegister(plc, register) {
  return {
    success: true,
    register,
    value: plc.registers[register],
    timestamp: new Date().toLocaleTimeString(),
  };
}

export function plcWriteRegister(plc, register, value, source = "HMI01") {
  return {
    ...plc,
    registers: {
      ...plc.registers,
      [register]: value,
    },
    lastCommand: {
      source,
      register,
      value,
      timestamp: new Date().toLocaleTimeString(),
    },
  };
}

export function applyPLCToPlant(state) {
  const plc = state.plc;

  if (!plc || !plc.registers) return state;

  return {
    ...state,

    valvePositionTarget: plc.registers[PLC_REGISTERS.VALVE_POSITION],

    pumpCommand:
      plc.registers[PLC_REGISTERS.PUMP_COMMAND] === 1
        ? "RUNNING"
        : "STOPPED",

    heaterCommand:
      plc.registers[PLC_REGISTERS.HEATER_COMMAND] === 1
        ? "ON"
        : "OFF",

    chemicalTarget: plc.registers[PLC_REGISTERS.CHEMICAL_TARGET],
  };
}

export function updatePLCFromPlant(plc, state) {
  return {
    ...plc,
    registers: {
      ...plc.registers,
      [PLC_REGISTERS.TANK_LEVEL]: Number(state.tankLevel.toFixed(1)),
      [PLC_REGISTERS.FLOW_RATE]: Number(state.flowRate.toFixed(1)),
      [PLC_REGISTERS.TEMPERATURE]: Number(state.temperature.toFixed(1)),
      [PLC_REGISTERS.CHEMICAL_LEVEL]: Number(state.chemicalLevel.toFixed(1)),
    },
  };
}
