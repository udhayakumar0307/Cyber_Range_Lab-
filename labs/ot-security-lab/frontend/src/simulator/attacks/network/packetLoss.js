export default {

  id: "PACKET_LOSS",

  title: "Network Packet Loss",

  category: "NETWORK",

  severity: "MEDIUM",

  description:
    "Packets are randomly dropped between PLC and HMI.",

  learningObjective:
    "Understand unreliable industrial communications.",

  affectedAsset: "Industrial Network",

  attackVector: "Packet Drop",

  network: {

    packetLoss: 40,

    communication: "UNSTABLE",

  },

  expectedPhysicalEffect: {

    process:
      "Usually continues normally.",

    hmi:
      "Intermittent updates.",

    alarms: [

      "Communication Unstable",

    ],

  },

  recoveryActions: [

    "CHECK_NETWORK",

  ],

  training: {

    objective:
      "Distinguish packet loss from sensor failure.",

    studentTasks: [

      "Inspect Network",

      "Compare Historian",

      "Analyze PCAP",

    ],

    estimatedTime: "6 min",

  },

};
