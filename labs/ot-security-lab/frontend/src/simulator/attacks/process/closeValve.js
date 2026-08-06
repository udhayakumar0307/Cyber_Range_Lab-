import { PLC_REGISTERS } from "../../plc/plcEngine";

export default {
  id: "CLOSE_VALVE",
  title: "Close Valve Attack",
  category: "PROCESS",
  severity: "HIGH",
  description: "Forces control valve XV101 closed and restricts outlet flow.",
  learningObjective: "Correlate Modbus register writes with valve movement and tank rise.",
  affectedAsset: "XV101",
  attackVector: "Modbus FC06 Write Single Register",

  plcWrite: {
    register: PLC_REGISTERS.VALVE_POSITION,
    value: 0,
  },

  transition: {
    type: "linear",
    expected: "Valve moves gradually from current position toward 0%.",
  },

  expectedPhysicalEffect: {
    valvePosition: "Moves toward 0%",
    flowRate: "Decreases",
    tankLevel: "Rises",
    alarms: ["High Tank Level", "Low Flow"],
  },

  recoveryActions: ["ISOLATE_EWS", "OPEN_VALVE"],

  pcap: {
    protocol: "Modbus TCP",
    functionCode: 6,
    operation: "Write Single Register",
    register: PLC_REGISTERS.VALVE_POSITION,
    value: 0,
    source: "EWS01",
    destination: "PLC01",
  },

  training: {
    objective: "Identify a valve manipulation attack from PCAP evidence.",
    studentTasks: ["Check HMI", "Analyze PCAP", "Identify register 40010", "Open Valve"],
    estimatedTime: "5 min",
  },
};
