import { PLC_REGISTERS } from "../../plc/plcEngine";

export default {
  id: "STOP_PUMP",
  title: "Stop Pump Attack",
  category: "PROCESS",
  severity: "HIGH",
  description: "Stops transfer pump P101 using an unauthorized PLC register write.",
  learningObjective: "Identify an unauthorized Modbus write to the pump command register.",
  affectedAsset: "P101",
  attackVector: "Modbus FC06 Write Single Register",

  plcWrite: {
    register: PLC_REGISTERS.PUMP_COMMAND,
    value: 0,
  },

  transition: {
    type: "command_instant_process_gradual",
    expected: "Pump command changes immediately; flow decreases gradually.",
  },

  expectedPhysicalEffect: {
    flowRate: "Drops toward 0 L/min",
    tankLevel: "May rise due to reduced outlet flow",
    alarms: ["Low Flow"],
  },

  recoveryActions: ["ISOLATE_EWS", "START_PUMP"],

  pcap: {
    protocol: "Modbus TCP",
    functionCode: 6,
    operation: "Write Single Register",
    register: PLC_REGISTERS.PUMP_COMMAND,
    value: 0,
    source: "EWS01",
    destination: "PLC01",
  },

  training: {
    objective: "Determine why flow dropped and identify the unauthorized pump command.",
    studentTasks: ["Observe HMI", "Check historian", "Analyze PCAP", "Start Pump"],
    estimatedTime: "5 min",
  },
};
