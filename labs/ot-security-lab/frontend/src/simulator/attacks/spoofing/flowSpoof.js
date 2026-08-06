export default {
  id: "FLOW_SPOOF",
  title: "Flow Sensor Spoofing",
  category: "SPOOFING",
  severity: "MEDIUM",
  description: "Displays a false FT101 flow value while the process flow may differ.",
  learningObjective: "Identify flow reading inconsistencies using related process values.",
  affectedAsset: "FT101",
  attackVector: "False sensor value injection",

  spoof: {
    tag: "FT101",
    variable: "flowRate",
    displayedValue: 25,
  },

  expectedPhysicalEffect: {
    process: "No direct physical change",
    hmi: "Flow appears normal even if process behavior suggests otherwise",
    alarms: ["Low flow may be hidden"],
  },

  recoveryActions: ["RESTORE_SENSOR_DATA"],

  training: {
    objective: "Correlate flow with pump status, valve position, and tank trend.",
    studentTasks: ["Check pump", "Check valve", "Compare tank trend", "Restore sensor data"],
    estimatedTime: "7 min",
  },
};
