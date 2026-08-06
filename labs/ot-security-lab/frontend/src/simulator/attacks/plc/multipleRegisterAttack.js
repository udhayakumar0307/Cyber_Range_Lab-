import { PLC_REGISTERS } from "../../plc/plcEngine";

export default {
  id: "MULTIPLE_REGISTER_ATTACK",
  title: "Multiple Register Attack",
  category: "PLC",
  severity: "CRITICAL",
  description:
    "Multiple PLC registers are modified in a single attack, affecting several process variables.",
  learningObjective:
    "Analyze Modbus FC16 activity and identify multiple affected process tags.",
  affectedAsset: "PLC01",
  attackVector: "Modbus FC16 Write Multiple Registers",

  plcWrites: [
    {
      register: PLC_REGISTERS.VALVE_POSITION,
      value: 0,
    },
    {
      register: PLC_REGISTERS.PUMP_COMMAND,
      value: 0,
    },
    {
      register: PLC_REGISTERS.CHEMICAL_TARGET,
      value: 300,
    },
  ],

  expectedPhysicalEffect: {
    valvePosition: "Moves toward 0%",
    flowRate: "Drops",
    tankLevel: "May rise",
    chemicalLevel: "Rises",
    alarms: ["Low Flow", "Chemical High", "High Tank Level"],
  },

  recoveryActions: ["ISOLATE_EWS", "START_PUMP", "OPEN_VALVE", "RESET_CHEMICAL"],

  pcap: {
    protocol: "Modbus TCP",
    functionCode: 16,
    operation: "Write Multiple Registers",
    source: "EWS01",
    destination: "PLC01",
  },

  training: {
    objective: "Identify a multi-register write and recover each affected subsystem.",
    studentTasks: [
      "Inspect PCAP",
      "Identify FC16",
      "List affected registers",
      "Restore pump, valve, and chemical setpoint",
    ],
    estimatedTime: "12 min",
  },
};
