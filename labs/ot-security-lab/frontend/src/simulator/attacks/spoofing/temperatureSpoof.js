export default {
  id: "TEMPERATURE_SPOOF",
  title: "Temperature Spoofing",
  category: "SPOOFING",
  severity: "HIGH",
  description: "Displays a false TT101 temperature value to mislead the operator.",
  learningObjective: "Recognize false temperature data during process monitoring.",
  affectedAsset: "TT101",
  attackVector: "False sensor value injection",

  spoof: {
    tag: "TT101",
    variable: "temperature",
    displayedValue: 25,
  },

  expectedPhysicalEffect: {
    process: "No direct physical change",
    hmi: "Temperature appears safe or unusually low",
    alarms: ["Possible missed high-temperature alarm"],
  },

  recoveryActions: ["RESTORE_SENSOR_DATA"],

  training: {
    objective: "Detect disagreement between heater status, historian, and displayed temperature.",
    studentTasks: ["Review HMI", "Check heater status", "Compare historian", "Restore sensor data"],
    estimatedTime: "7 min",
  },
};
