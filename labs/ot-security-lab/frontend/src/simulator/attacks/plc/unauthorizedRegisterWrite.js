import { PLC_REGISTERS } from "../../plc/plcEngine";

export default {
  id: "UNAUTHORIZED_REGISTER_WRITE",
  title: "Unauthorized Register Write",
  category: "PLC",
  severity: "HIGH",
  description:
    "An unauthorized device writes directly to a PLC register without operator approval.",
  learningObjective:
    "Identify unauthorized Modbus write activity and determine the affected process variable.",
  affectedAsset: "PLC01",
  attackVector: "Modbus FC06 Write Single Register",

  plcWrite: {
    register: PLC_REGISTERS.VALVE_POSITION,
    value: 0,
  },

  expectedPhysicalEffect: {
    process: "Depends on the targeted register.",
    alarms: ["Unexpected PLC Command"],
  },

  recoveryActions: ["VERIFY_REGISTER_VALUES", "RESTORE_PROCESS"],

  pcap: {
    protocol: "Modbus TCP",
    functionCode: 6,
    operation: "Write Single Register",
    register: PLC_REGISTERS.VALVE_POSITION,
    value: 0,
    source: "UNKNOWN",
    destination: "PLC01",
  },

  training: {
    objective: "Trace an unauthorized PLC write back to its source.",
    studentTasks: [
      "Analyze PCAP",
      "Identify function code",
      "Identify register",
      "Determine physical effect",
    ],
    estimatedTime: "8 min",
  },
};
