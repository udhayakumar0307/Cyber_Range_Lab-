import { PLC_REGISTERS } from "../../plc/plcEngine";

export default {
  id: "CHEMICAL_OVERDOSE",
  title: "Chemical Overdose",
  category: "PROCESS",
  severity: "CRITICAL",
  description: "Raises chemical dosing target beyond safe operating level.",
  learningObjective: "Identify chemical dosing manipulation through PLC register changes.",
  affectedAsset: "DP101",
  attackVector: "Modbus FC06 Write Single Register",

  plcWrite: {
    register: PLC_REGISTERS.CHEMICAL_TARGET,
    value: 300,
  },

  transition: {
    type: "chemical_gradual",
    expected: "Chemical concentration rises gradually.",
  },

  expectedPhysicalEffect: {
    chemicalLevel: "Rises toward 300 ppm",
    alarms: ["Chemical High"],
  },

  recoveryActions: ["ISOLATE_EWS", "RESET_CHEMICAL"],

  pcap: {
    protocol: "Modbus TCP",
    functionCode: 6,
    operation: "Write Single Register",
    register: PLC_REGISTERS.CHEMICAL_TARGET,
    value: 300,
    source: "EWS01",
    destination: "PLC01",
  },

  training: {
    objective: "Detect chemical overdose caused by unauthorized register write.",
    studentTasks: ["Review chemical trend", "Analyze PCAP", "Normalize Chemical"],
    estimatedTime: "7 min",
  },
};
