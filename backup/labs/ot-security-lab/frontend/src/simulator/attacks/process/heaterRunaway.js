import { PLC_REGISTERS } from "../../plc/plcEngine";

export default {
  id: "HEATER_RUNAWAY",
  title: "Heater Runaway",
  category: "PROCESS",
  severity: "CRITICAL",
  description: "Forces heater operation and raises the temperature target.",
  learningObjective: "Identify heater manipulation and high-temperature process risk.",
  affectedAsset: "H101",
  attackVector: "Modbus FC06 Write Single Register",

  plcWrite: {
    register: PLC_REGISTERS.HEATER_COMMAND,
    value: 1,
  },

  extraState: {
    temperatureTarget: 95,
  },

  transition: {
    type: "thermal_gradual",
    expected: "Temperature rises gradually toward unsafe range.",
  },

  expectedPhysicalEffect: {
    temperature: "Rises toward 95°C",
    alarms: ["High Temperature"],
  },

  recoveryActions: ["ISOLATE_EWS", "RESET_HEATER"],

  pcap: {
    protocol: "Modbus TCP",
    functionCode: 6,
    operation: "Write Single Register",
    register: PLC_REGISTERS.HEATER_COMMAND,
    value: 1,
    source: "EWS01",
    destination: "PLC01",
  },

  training: {
    objective: "Correlate heater command manipulation with rising temperature.",
    studentTasks: ["Check temperature trend", "Inspect PCAP", "Reset Heater"],
    estimatedTime: "7 min",
  },
};
