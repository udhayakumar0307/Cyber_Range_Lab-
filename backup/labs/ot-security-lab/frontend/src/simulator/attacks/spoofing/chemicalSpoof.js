export default {
  id: "CHEMICAL_SPOOF",
  title: "Chemical Sensor Spoofing",
  category: "SPOOFING",
  severity: "HIGH",
  description: "Displays a false AT101 chemical concentration value.",
  learningObjective: "Identify false chemical analyzer readings.",
  affectedAsset: "AT101",
  attackVector: "False sensor value injection",

  spoof: {
    tag: "AT101",
    variable: "chemicalLevel",
    displayedValue: 108,
  },

  expectedPhysicalEffect: {
    process: "No direct physical change",
    hmi: "Chemical value appears normal",
    alarms: ["Chemical overdose or underdose may be hidden"],
  },

  recoveryActions: ["RESTORE_SENSOR_DATA"],

  training: {
    objective: "Detect chemical analyzer spoofing through process correlation.",
    studentTasks: ["Review chemical trend", "Compare dosing target", "Check PCAP", "Restore sensor data"],
    estimatedTime: "8 min",
  },
};
