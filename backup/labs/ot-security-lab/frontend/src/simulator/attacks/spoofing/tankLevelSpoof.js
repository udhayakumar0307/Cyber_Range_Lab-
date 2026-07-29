export default {
  id: "TANK_LEVEL_SPOOF",
  title: "Tank Level Spoofing",
  category: "SPOOFING",
  severity: "HIGH",
  description: "Displays a false LT101 tank level value while the real process continues normally.",
  learningObjective: "Identify inconsistent process readings caused by sensor spoofing.",
  affectedAsset: "LT101",
  attackVector: "False sensor value injection",

  spoof: {
    tag: "LT101",
    variable: "tankLevel",
    displayedValue: 35,
  },

  expectedPhysicalEffect: {
    process: "No direct physical change",
    hmi: "Tank level appears lower than actual",
    alarms: ["Possible missed high-level alarm"],
  },

  recoveryActions: ["RESTORE_SENSOR_DATA"],

  training: {
    objective: "Compare HMI readings with historian, flow, and PLC values.",
    studentTasks: ["Observe HMI", "Check historian", "Compare PLC register 40001", "Restore sensor data"],
    estimatedTime: "7 min",
  },
};
