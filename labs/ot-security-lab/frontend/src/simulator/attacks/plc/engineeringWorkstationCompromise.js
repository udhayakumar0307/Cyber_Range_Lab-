import { PLC_REGISTERS } from "../../plc/plcEngine";

export default {
  id: "ENGINEERING_WORKSTATION_COMPROMISE",
  title: "Engineering Workstation Compromise",
  category: "PLC",
  severity: "CRITICAL",
  description:
    "The engineering workstation is compromised and begins sending unauthorized commands to the PLC.",
  learningObjective:
    "Recognize malicious activity originating from a trusted engineering workstation.",
  affectedAsset: "EWS01",
  attackVector: "Compromised Engineering Workstation",

  network: {
    compromisedDevice: "EWS01",
    status: "SUSPICIOUS",
  },

  plcWrites: [
    {
      register: PLC_REGISTERS.VALVE_POSITION,
      value: 0,
    },
    {
      register: PLC_REGISTERS.PUMP_COMMAND,
      value: 0,
    },
  ],

  expectedPhysicalEffect: {
    valvePosition: "Moves toward 0%",
    pumpStatus: "Stops",
    flowRate: "Drops",
    tankLevel: "May rise",
    alarms: ["Low Flow", "High Tank Level"],
  },

  recoveryActions: ["ISOLATE_EWS", "START_PUMP", "OPEN_VALVE"],

  pcap: {
    protocol: "Modbus TCP",
    functionCode: 6,
    operation: "Multiple Unauthorized Writes",
    source: "EWS01",
    destination: "PLC01",
  },

  training: {
    objective:
      "Identify that the trusted engineering workstation is the source of malicious PLC writes.",
    studentTasks: [
      "Analyze PCAP source",
      "Inspect Network page",
      "Isolate EWS01",
      "Restore process commands",
    ],
    estimatedTime: "12 min",
  },
};
