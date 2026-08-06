export function createInitialDevices() {
  return {
    LT101: {
      id: "LT101",
      name: "Tank Level Transmitter",
      type: "Sensor",
      unit: "%",
      value: 72,
      status: "ONLINE",
      health: "HEALTHY",
    },

    FT101: {
      id: "FT101",
      name: "Flow Transmitter",
      type: "Sensor",
      unit: "L/min",
      value: 24.6,
      status: "ONLINE",
      health: "HEALTHY",
    },

    TT101: {
      id: "TT101",
      name: "Temperature Transmitter",
      type: "Sensor",
      unit: "°C",
      value: 63,
      status: "ONLINE",
      health: "HEALTHY",
    },

    AT101: {
      id: "AT101",
      name: "Chemical Analyzer",
      type: "Sensor",
      unit: "ppm",
      value: 108,
      status: "ONLINE",
      health: "HEALTHY",
    },

    P101: {
      id: "P101",
      name: "Transfer Pump",
      type: "Actuator",
      command: "RUNNING",
      status: "RUNNING",
      health: "HEALTHY",
    },

    XV101: {
      id: "XV101",
      name: "Control Valve",
      type: "Actuator",
      command: 50,
      position: 50,
      unit: "%",
      status: "OPEN",
      health: "HEALTHY",
    },

    H101: {
      id: "H101",
      name: "Heater",
      type: "Actuator",
      command: "ON",
      status: "ON",
      health: "HEALTHY",
    },

    PLC01: {
      id: "PLC01",
      name: "OpenPLC Controller",
      type: "Controller",
      status: "CONNECTED",
      health: "HEALTHY",
    },

    HMI01: {
      id: "HMI01",
      name: "Operator HMI",
      type: "Workstation",
      status: "ONLINE",
      health: "HEALTHY",
    },

    EWS01: {
      id: "EWS01",
      name: "Engineering Workstation",
      type: "Workstation",
      status: "ONLINE",
      health: "HEALTHY",
    },
  };
}

export function updateDeviceValue(devices, deviceId, fields) {
  return {
    ...devices,
    [deviceId]: {
      ...devices[deviceId],
      ...fields,
    },
  };
}

