import { PLC_REGISTERS } from "../../plc/plcEngine";

export default {
  id: "HEATER_SHUTDOWN",
  title: "Heater Shutdown",
  category: "PROCESS",
  severity: "MEDIUM",
  description: "Turns heater H101 off, causing temperature to fall.",
  learningObjective: "Identify unauthorized shutdown of process heating.",
  affectedAsset: "H101",
  attackVector: "Modbus FC06 Write Single Register",

  plcWrite: {
    register: PLC_REGISTERS.HEATER_COMMAND,
    value: 0,
  },

  transition: {
    type: "thermal_gradual",
    expected: "Temperature decreases gradually.",
  },

  expectedPhysicalEffect: {
    temperature: "Falls toward low range",
    alarms: [],
  },

  recoveryActions: ["ISOLATE_EWS", "RESET_HEATER"],

  pcap: {
    protocol: "Modbus TCP",
    functionCode: 6,
    operation: "Write Single Register",
    register: PLC_REGISTERS.HEATER_COMMAND,
    value: 0,
    source: "EWS01",
    destination: "PLC01",
  },

  training: {
    objective: "Detect heater shutdown using HMI, historian, and PCAP.",
    studentTasks: ["Check temperature trend", "Identify heater register", "Reset Heater"],
    estimatedTime: "5 min",
  },
};
