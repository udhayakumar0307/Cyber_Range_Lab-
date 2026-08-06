import { PLC_REGISTERS } from "../../plc/plcEngine";

export default {
  id: "UNAUTHORIZED_SETPOINT_CHANGE",
  title: "Unauthorized Setpoint Change",
  category: "PLC",
  severity: "HIGH",
  description:
    "An attacker changes a process setpoint, causing the plant to move toward an unsafe operating range.",
  learningObjective:
    "Identify unsafe setpoint manipulation through PLC register analysis.",
  affectedAsset: "PLC01",
  attackVector: "Modbus FC06 Setpoint Change",

  plcWrite: {
    register: PLC_REGISTERS.CHEMICAL_TARGET,
    value: 250,
  },

  expectedPhysicalEffect: {
    chemicalLevel: "Rises gradually",
    alarms: ["Chemical High"],
  },

  recoveryActions: ["ISOLATE_EWS", "RESET_CHEMICAL"],

  pcap: {
    protocol: "Modbus TCP",
    functionCode: 6,
    operation: "Write Single Register",
    register: PLC_REGISTERS.CHEMICAL_TARGET,
    value: 250,
    source: "EWS01",
    destination: "PLC01",
  },

  training: {
    objective: "Detect an unauthorized setpoint change and restore the safe target.",
    studentTasks: [
      "Check chemical trend",
      "Identify setpoint register",
      "Restore chemical target",
    ],
    estimatedTime: "8 min",
  },
};
