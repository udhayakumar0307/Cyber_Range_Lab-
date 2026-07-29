import { PLC_REGISTERS } from "../../plc/plcEngine";

export default {
  id: "PACKET_INJECTION",
  title: "Packet Injection",
  category: "NETWORK",
  severity: "HIGH",
  description: "A rogue device injects a valid Modbus write that stops pump P101.",
  learningObjective: "Correlate an unauthorized source with an accepted PLC write and physical impact.",
  affectedAsset: "PLC01",
  attackVector: "Forged Modbus TCP FC06",

  plcWrite: {
    register: PLC_REGISTERS.PUMP_COMMAND,
    value: 0,
  },

  network: {
    injectedPackets: true,
    forgedSource: "192.168.1.250",
  },

  pcap: {
    protocol: "Modbus TCP",
    functionCode: 6,
    operation: "Forged Write Single Register",
    register: PLC_REGISTERS.PUMP_COMMAND,
    value: 0,
    source: "UNKNOWN",
    destination: "PLC01",
  },

  expectedPhysicalEffect: {
    pumpStatus: "Stops",
    flowRate: "Falls toward 0 L/min",
    alarms: ["Unexpected PLC Command", "Low Flow"],
  },

  recoveryActions: ["BLOCK_SOURCE", "VERIFY_REGISTER_VALUES", "RESTORE_PROCESS"],

  training: {
    objective: "Identify a forged FC06 command and connect it to the pump shutdown.",
    studentTasks: ["Inspect source IP", "Identify FC06", "Identify register 40020", "Restore process"],
    estimatedTime: "8 min",
  },
};
