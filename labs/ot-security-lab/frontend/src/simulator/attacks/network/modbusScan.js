export default {

  id: "MODBUS_SCAN",

  title: "Modbus Reconnaissance Scan",

  category: "NETWORK",

  severity: "LOW",

  description:
    "An unknown device continuously reads PLC registers.",

  learningObjective:
    "Recognize reconnaissance before process manipulation.",

  affectedAsset: "PLC01",

  attackVector: "Repeated FC03 Read Requests",

  network: {

    packets: "HIGH",

    communication: "NORMAL",

    scanSource: "UNKNOWN",

  },

  expectedPhysicalEffect: {

    process: "None",

    hmi: "Normal",

    alarms: [],

  },

  recoveryActions: [

    "BLOCK_SOURCE",

  ],

  training: {

    objective:
      "Identify Modbus scanning behaviour.",

    studentTasks: [

      "Open PCAP",

      "Identify FC03",

      "Locate Source IP",

      "Recommend Isolation",

    ],

    estimatedTime: "5 min",

  },

};
