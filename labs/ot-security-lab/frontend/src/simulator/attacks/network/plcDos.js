export default {
  id: "PLC_DOS",

  title: "PLC Denial of Service",

  category: "NETWORK",

  severity: "CRITICAL",

  description:
    "Floods PLC01 with excessive traffic causing delayed or lost communications.",

  learningObjective:
    "Identify communication loss and distinguish it from process failures.",

  affectedAsset: "PLC01",

  attackVector: "Network Flood",

  network: {
    communication: "DEGRADED",
    latency: "HIGH",
    packetLoss: 35,
    deviceStatus: "UNRESPONSIVE",
  },

  expectedPhysicalEffect: {
    process: "Existing process continues.",
    hmi: "Values freeze or update slowly.",
    alarms: [
      "PLC Communication Lost",
      "Network Latency High",
    ],
  },

  recoveryActions: ["ISOLATE_NETWORK", "RESTART_PLC"],

  training: {
    objective:
      "Determine whether the problem is network-related or process-related.",

    studentTasks: [
      "Observe frozen HMI",
      "Inspect Network",
      "Analyze PCAP",
      "Restore Communications",
    ],

    estimatedTime: "8 min",
  },
};
