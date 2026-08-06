import { PLC_REGISTERS } from "../../plc/plcEngine";

export default {
  id: "CHEMICAL_UNDERDOSE",
  title: "Chemical Underdose",
  category: "PROCESS",
  severity: "MEDIUM",
  description: "Reduces chemical dosing target below required treatment level.",
  learningObjective: "Identify reduced chemical dosing and treatment failure risk.",
  affectedAsset: "DP101",
  attackVector: "Modbus FC06 Write Single Register",

  plcWrite: {
    register: PLC_REGISTERS.CHEMICAL_TARGET,
    value: 50,
  },

  transition: {
    type: "chemical_gradual",
    expected: "Chemical concentration decreases gradually.",
  },

  expectedPhysicalEffect: {
    chemicalLevel: "Falls toward 50 ppm",
    alarms: ["Chemical Low"],
  },

  recoveryActions: ["ISOLATE_EWS", "RESET_CHEMICAL"],

  pcap: {
    protocol: "Modbus TCP",
    functionCode: 6,
    operation: "Write Single Register",
    register: PLC_REGISTERS.CHEMICAL_TARGET,
    value: 50,
    source: "EWS01",
    destination: "PLC01",
  },

  training: {
    objective: "Detect chemical underdosing using historian and PCAP evidence.",
    studentTasks: ["Review historian", "Inspect register 40040", "Normalize Chemical"],
    estimatedTime: "7 min",
  },
};
