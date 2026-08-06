export default {
  id: "FALSE_HMI_DATA",
  title: "HMI Data Spoofing",
  category: "SPOOFING",
  severity: "CRITICAL",
  description: "Manipulates HMI-displayed values while PLC/process values remain different.",
  learningObjective: "Differentiate between real process changes and compromised visualization.",
  affectedAsset: "HMI01",
  attackVector: "HMI data manipulation",

  spoof: {
    scope: "HMI",
    displayedValues: {
      tankLevel: 72,
      flowRate: 15,
      temperature: 63,
      chemicalLevel: 108,
    },
  },

  expectedPhysicalEffect: {
    process: "No direct physical change",
    hmi: "All values appear normal",
    alarms: ["Operator may miss abnormal process condition"],
  },

  recoveryActions: ["COMPARE_HMI_PLC", "ISOLATE_HMI_DATA_PATH", "START_TRUSTED_REFRESH", "WAIT_FOR_TRUSTED_UPDATE", "RESTORE_HMI_DATA", "VERIFY_HMI_MATCH"],

  training: {
    objective: "Use historian, PLC registers, and PCAP evidence to detect false HMI display.",
    studentTasks: ["Compare HMI with PLC registers", "Review historian", "Inspect network data", "Restore HMI data"],
    estimatedTime: "10 min",
  },
};
