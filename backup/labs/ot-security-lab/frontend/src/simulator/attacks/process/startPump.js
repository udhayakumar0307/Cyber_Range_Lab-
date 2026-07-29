import { PLC_REGISTERS } from "../../plc/plcEngine";

export default {
  id: "START_PUMP_ATTACK",
  title: "Start Pump Attack",
  category: "PROCESS",
  severity: "MEDIUM",
  description: "Starts pump P101 unexpectedly using a PLC write.",
  learningObjective: "Understand unauthorized actuator start commands.",
  affectedAsset: "P101",
  attackVector: "Modbus FC06 Write Single Register",

  plcWrite: {
    register: PLC_REGISTERS.PUMP_COMMAND,
    value: 1,
  },

  transition: {
    type: "command_instant_process_gradual",
    expected: "Pump command changes immediately; flow increases gradually.",
  },

  expectedPhysicalEffect: {
    flowRate: "Increases",
    tankLevel: "May decrease depending on valve position",
    alarms: [],
  },

  recoveryActions: ["ISOLATE_EWS", "STOP_PUMP"],

  pcap: {
    protocol: "Modbus TCP",
    functionCode: 6,
    operation: "Write Single Register",
    register: PLC_REGISTERS.PUMP_COMMAND,
    value: 1,
    source: "EWS01",
    destination: "PLC01",
  },

  training: {
    objective: "Identify an unexpected pump start command.",
    studentTasks: ["Observe HMI", "Check PCAP", "Verify pump register"],
    estimatedTime: "5 min",
  },
};
