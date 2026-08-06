export const DEVICES = {
  PLC01: {
    ip: "192.168.1.10",
    mac: "00:11:22:33:44:10",
  },
  HMI01: {
    ip: "192.168.1.20",
    mac: "00:11:22:33:44:20",
  },
  Historian01: {
    ip: "192.168.1.30",
    mac: "00:11:22:33:44:30",
  },
  SCADA01: {
    ip: "192.168.1.40",
    mac: "00:11:22:33:44:40",
  },
  RTU01: {
    ip: "192.168.1.60",
    mac: "00:11:22:33:44:60",
  },
  EWS01: {
    ip: "192.168.1.50",
    mac: "00:11:22:33:44:50",
  },
  UNKNOWN: {
    ip: "192.168.1.250",
    mac: "AA:BB:CC:DD:EE:FF",
  },
};

export function enrichDeviceFields(packet) {
  const src = DEVICES[packet.source] || DEVICES.UNKNOWN;
  const dst = DEVICES[packet.destination] || DEVICES.UNKNOWN;

  return {
    ...packet,
    sourceIp: src.ip,
    destinationIp: dst.ip,
    sourceMac: src.mac,
    destinationMac: dst.mac,
  };
}
