const REGISTER_MAP = {
  40001: {
    tag: "LT101",
    name: "Tank Level",
    asset: "Tank",
    unit: "%",
    access: "READ",
    type: "PROCESS_VALUE",
    normalRange: "60–85 %",
  },

  40002: {
    tag: "FT101",
    name: "Flow Rate",
    asset: "Flow Transmitter",
    unit: "L/min",
    access: "READ",
    type: "PROCESS_VALUE",
    normalRange: "12–22 L/min",
  },

  40003: {
    tag: "TT101",
    name: "Temperature",
    asset: "Heater",
    unit: "°C",
    access: "READ",
    type: "PROCESS_VALUE",
    normalRange: "55–72 °C",
  },

  40004: {
    tag: "AT101",
    name: "Chemical Level",
    asset: "Chemical Analyzer",
    unit: "ppm",
    access: "READ",
    type: "PROCESS_VALUE",
    normalRange: "95–125 ppm",
  },

  40010: {
    tag: "XV101",
    name: "Valve Position",
    asset: "Control Valve",
    unit: "%",
    access: "READ_WRITE",
    type: "CONTROL_COMMAND",
    normalRange: "45–55 %",
  },

  40020: {
    tag: "P101",
    name: "Pump Command",
    asset: "Transfer Pump",
    unit: "",
    access: "READ_WRITE",
    type: "CONTROL_COMMAND",
    normalRange: "1 = RUNNING",
  },

  40030: {
    tag: "H101",
    name: "Heater Command",
    asset: "Heater",
    unit: "",
    access: "READ_WRITE",
    type: "CONTROL_COMMAND",
    normalRange: "1 = ON",
  },

  40040: {
    tag: "DP101",
    name: "Chemical Target",
    asset: "Chemical Dosing Pump",
    unit: "ppm",
    access: "READ_WRITE",
    type: "SETPOINT",
    normalRange: "95–125 ppm",
  },
};

export function getRegisterInfo(register) {
  const key = Number(register);
  return REGISTER_MAP[key] || null;
}

export function getRegisterLabel(register) {
  const info = getRegisterInfo(register);

  if (!info) {
    return `${register} — Unknown Register`;
  }

  return `${register} — ${info.tag} ${info.name}`;
}

export function getRegisterPhysicalMeaning(register, value) {
  const info = getRegisterInfo(register);

  if (!info) {
    return "Unknown register. No physical mapping available.";
  }

  const numericValue = Number(value);

  switch (Number(register)) {
    case 40010:
      if (numericValue === 0) return "Valve XV101 commanded closed.";
      if (numericValue === 100) return "Valve XV101 commanded fully open.";
      return `Valve XV101 position commanded to ${numericValue}%.`;

    case 40020:
      return numericValue === 1
        ? "Pump P101 commanded to RUN."
        : "Pump P101 commanded to STOP.";

    case 40030:
      return numericValue === 1
        ? "Heater H101 commanded ON."
        : "Heater H101 commanded OFF.";

    case 40040:
      return `Chemical dosing target changed to ${numericValue} ppm.`;

    default:
      return `${info.tag} ${info.name} value observed as ${value}${info.unit ? ` ${info.unit}` : ""}.`;
  }
}

export function isWritableRegister(register) {
  const info = getRegisterInfo(register);
  return info?.access === "READ_WRITE";
}

export function getAllRegisters() {
  return Object.entries(REGISTER_MAP).map(([register, info]) => ({
    register: Number(register),
    ...info,
  }));
}

export default REGISTER_MAP;
