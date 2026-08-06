import { createInitialNetwork } from "../simulator/networkEngine";
import { createInitialDevices } from "../simulator/devices/deviceEngine";
import { createInitialPLC } from "../simulator/plc/plcEngine";

export const plantState = {
  // ==========================================================
  // Plant Status
  // ==========================================================
  plantStatus: "RUNNING",
  communications: "HEALTHY",
  plcStatus: "CONNECTED",

  // ==========================================================
  // Process Values
  // ==========================================================
  tankLevel: 70.5,
  flowRate: 25,
  temperature: 70.5,
  chemicalLevel: 108,

  // ==========================================================
  // Actuator States
  // ==========================================================
  pumpStatus: "RUNNING",
  valvePosition: 50,
  heaterStatus: "ON",

  // ==========================================================
  // Alarm System
  // ==========================================================
  activeAlarms: 0,
  alarms: [],

  // ==========================================================
  // Historian
  // ==========================================================
  historian: [
    {
      time: "16:30",
      tankLevel: 68,
      flowRate: 22,
      temperature: 60,
      chemicalLevel: 100,
    },
    {
      time: "16:32",
      tankLevel: 69,
      flowRate: 23,
      temperature: 61,
      chemicalLevel: 102,
    },
    {
      time: "16:34",
      tankLevel: 70,
      flowRate: 24,
      temperature: 62,
      chemicalLevel: 104,
    },
    {
      time: "16:36",
      tankLevel: 71,
      flowRate: 24.4,
      temperature: 63,
      chemicalLevel: 106,
    },
    {
      time: "16:38",
      tankLevel: 72,
      flowRate: 24.6,
      temperature: 63,
      chemicalLevel: 108,
    },
  ],

  // ==========================================================
  // Event Log
  // ==========================================================
  events: [
    {
      time: "16:40",
      source: "PLC",
      severity: "INFO",
      message: "Pump Started",
    },
    {
      time: "16:38",
      source: "PLC",
      severity: "INFO",
      message: "Valve Opened",
    },
    {
      time: "16:35",
      source: "Operator",
      severity: "INFO",
      message: "Operator Login",
    },
    {
      time: "16:30",
      source: "Historian",
      severity: "INFO",
      message: "Historian Connected",
    },
  ],

  // ==========================================================
  // Network
  // ==========================================================
  networkDevices: createInitialNetwork(),
  ewsState: "ONLINE",

  // ==========================================================
  // Device Digital Twin
  // ==========================================================
  devices: createInitialDevices(),

  // ==========================================================
  // Instructor / Scenario
  // ==========================================================
  activeScenario: "Normal Operation",

  // ==========================================================
  // Exercise State
  // ==========================================================
  exerciseState: "NORMAL", // NORMAL | INCIDENT | RECOVERY | COMPLETE

  // ==========================================================
  // PCAP Engine
  // ==========================================================
  pcapPackets: [],

  // ==========================================================
  // Report Engine
  // ==========================================================
  currentReport: null,

  // ==========================================================
  // PLC
  // ==========================================================
  plc: createInitialPLC(),

  // ==========================================================
  // Attack Scheduler
  // ==========================================================
  activeAttacks: [],
};

