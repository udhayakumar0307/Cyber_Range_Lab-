import { PLC_REGISTERS } from "../../plc/plcEngine";

export default {
  id: "REPLAY_ATTACK",
  title: "Replay Attack",
  category: "NETWORK",
  severity: "HIGH",
  description: "A previously captured pump-stop command is transmitted again.",
  learningObjective: "Detect repeated Modbus commands using transaction content and timing.",
  affectedAsset: "PLC01",
  attackVector: "Repeated Modbus FC06 transaction",

  plcWrite: {
    register: PLC_REGISTERS.PUMP_COMMAND,
    value: 0,
  },

  network: { duplicatePackets: true },

  pcap: {
    protocol: "Modbus TCP",
    functionCode: 6,
    operation: "Replayed Write Single Register",
    register: PLC_REGISTERS.PUMP_COMMAND,
    value: 0,
    source: "UNKNOWN",
    destination: "PLC01",
  },

  expectedPhysicalEffect: {
    pumpStatus: "Stops when the old command executes again",
    flowRate: "Falls toward 0 L/min",
    alarms: ["Repeated Command Detected", "Low Flow"],
  },

  recoveryActions: ["VERIFY_CURRENT_STATE", "RESTORE_PROCESS"],

  training: {
    objective: "Use duplicate payloads and close timestamps to identify replay.",
    studentTasks: ["Review historian", "Inspect duplicate writes", "Compare packet times", "Restore process"],
    estimatedTime: "8 min",
  },
};
