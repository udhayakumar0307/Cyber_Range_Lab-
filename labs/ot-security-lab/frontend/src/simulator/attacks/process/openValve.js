import { PLC_REGISTERS } from "../../plc/plcEngine";

export default {
  id: "OPEN_VALVE_ATTACK",
  title: "Open Valve Attack",
  category: "PROCESS",
  severity: "HIGH",
  description: "Forces XV101 fully open and may drain the tank.",
  learningObjective: "Identify unauthorized valve opening and its effect on tank level.",
  affectedAsset: "XV101",
  attackVector: "Modbus FC06 Write Single Register",

  plcWrite: {
    register: PLC_REGISTERS.VALVE_POSITION,
    value: 100,
  },

  transition: {
    type: "linear",
    expected: "Valve moves gradually toward 100%.",
  },

  expectedPhysicalEffect: {
    valvePosition: "Moves toward 100%",
    flowRate: "Increases",
    tankLevel: "May fall",
    alarms: ["Low Tank Level"],
  },

  recoveryActions: ["ISOLATE_EWS", "OPEN_VALVE"],

  pcap: {
    protocol: "Modbus TCP",
    functionCode: 6,
    operation: "Write Single Register",
    register: PLC_REGISTERS.VALVE_POSITION,
    value: 100,
    source: "EWS01",
    destination: "PLC01",
  },

  training: {
    objective: "Recognize unauthorized valve manipulation.",
    studentTasks: ["Observe tank drop", "Check PCAP", "Restore valve to 50%"],
    estimatedTime: "5 min",
  },
};
