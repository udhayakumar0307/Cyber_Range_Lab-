export default {
  id: "IP_SPOOFING",
  title: "IP Spoofing",
  category: "SPOOFING",
  severity: "HIGH",
  description:
    "A rogue host sends Modbus traffic while impersonating the trusted Engineering Workstation IP address.",
  learningObjective:
    "Detect that an apparently trusted source address does not match the actual device identity or network context.",
  affectedAsset: "PLC01",
  attackVector: "Forged source IP address",

  network: {
    actualSource: "UNKNOWN",
    actualSourceIp: "192.168.1.250",
    spoofedSource: "EWS01",
    spoofedSourceIp: "192.168.1.50",
  },

  expectedPhysicalEffect: {
    process: "No direct process change; the forged request performs a register read.",
    hmi: "Normal operation continues.",
    alarms: ["Source identity mismatch", "Possible IP spoofing"],
  },

  recoveryActions: ["BLOCK_SOURCE", "VERIFY_SOURCE_IDENTITY"],

  training: {
    objective:
      "Compare source IP, source MAC/device identity, and the authorized asset inventory.",
    studentTasks: [
      "Inspect the Modbus request source",
      "Compare IP and device identity",
      "Identify the rogue origin",
      "Block the physical source",
    ],
    estimatedTime: "8 min",
  },
};
