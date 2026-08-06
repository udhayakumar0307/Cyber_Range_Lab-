import { decodePackets, isSuspiciousModbusWrite } from "./modbusDecoder";
import { getRegisterInfo, getRegisterPhysicalMeaning } from "./registerMapper";

export function detectIOCs(packetList = []) {
  const packets = decodePackets(packetList);
  const findings = [];

  packets.forEach((packet, index) => {
    if (isSuspiciousModbusWrite(packet)) {
      const info = getRegisterInfo(packet.register);

      findings.push({
        id: `IOC-${index}-WRITE`,
        severity: "HIGH",
        title: "Unauthorized Modbus Write",
        description: `${packet.source} wrote to ${packet.destination} using ${packet.functionName}.`,
        packetIndex: index,
        source: packet.source,
        destination: packet.destination,
        protocol: packet.protocol,
        functionCode: packet.functionCode,
        register: packet.register,
        asset: info?.asset || "Unknown Asset",
        meaning: getRegisterPhysicalMeaning(packet.register, packet.value),
      });
    }

    if (packet.source === "UNKNOWN") {
      findings.push({
        id: `IOC-${index}-UNKNOWN-SOURCE`,
        severity: "MEDIUM",
        title: "Unknown Source Device",
        description: "Traffic originated from an unknown source.",
        packetIndex: index,
        source: packet.source,
        destination: packet.destination,
      });
    }

    if (
      packet.severity === "HIGH" ||
      packet.severity === "CRITICAL"
    ) {
      findings.push({
        id: `IOC-${index}-SEVERITY`,
        severity: packet.severity,
        title: "High Severity Packet",
        description: `${packet.operation} was marked as ${packet.severity}.`,
        packetIndex: index,
        source: packet.source,
        destination: packet.destination,
      });
    }
  });

  return [
    ...findings,
    ...detectRepeatedWrites(packets),
    ...detectModbusScan(packets),
    ...detectReplayLikeTraffic(packets),
  ];
}

function detectRepeatedWrites(packets) {
  const findings = [];
  const counter = {};

  packets.forEach((packet, index) => {
    if (!packet.isWrite) return;

    const key = `${packet.source}|${packet.destination}|${packet.register}|${packet.value}`;
    counter[key] = counter[key] || [];
    counter[key].push({ packet, index });
  });

  Object.entries(counter).forEach(([key, entries]) => {
    if (entries.length >= 3) {
      const first = entries[0];

      findings.push({
        id: `IOC-REPEATED-WRITE-${key}`,
        severity: "HIGH",
        title: "Repeated PLC Write",
        description:
          "Same source repeatedly wrote the same value to the same PLC register.",
        packetIndex: first.index,
        source: first.packet.source,
        destination: first.packet.destination,
        register: first.packet.register,
        value: first.packet.value,
        count: entries.length,
      });
    }
  });

  return findings;
}

function detectModbusScan(packets) {
  const findings = [];
  const readsBySource = {};

  packets.forEach((packet, index) => {
    if (!packet.isRead) return;

    readsBySource[packet.source] = readsBySource[packet.source] || {
      count: 0,
      registers: new Set(),
      firstIndex: index,
      destination: packet.destination,
    };

    readsBySource[packet.source].count += 1;

    if (packet.register) {
      readsBySource[packet.source].registers.add(packet.register);
    }
  });

  Object.entries(readsBySource).forEach(([source, data]) => {
    if (source !== "HMI01" && source !== "Historian01" && data.count >= 10) {
      findings.push({
        id: `IOC-MODBUS-SCAN-${source}`,
        severity: "MEDIUM",
        title: "Possible Modbus Scan",
        description:
          "A non-standard device issued repeated Modbus read requests.",
        packetIndex: data.firstIndex,
        source,
        destination: data.destination,
        readCount: data.count,
        uniqueRegisters: data.registers.size,
      });
    }
  });

  return findings;
}

function detectReplayLikeTraffic(packets) {
  const findings = [];
  const seen = {};

  packets.forEach((packet, index) => {
    if (!packet.isWrite) return;

    const key = `${packet.source}|${packet.destination}|${packet.functionCode}|${packet.register}|${packet.value}`;

    if (!seen[key]) {
      seen[key] = [];
    }

    seen[key].push({ packet, index });
  });

  Object.entries(seen).forEach(([key, entries]) => {
    if (entries.length >= 2) {
      const first = entries[0];

      findings.push({
        id: `IOC-REPLAY-${key}`,
        severity: "MEDIUM",
        title: "Possible Replay Activity",
        description:
          "Identical write command appeared more than once in the capture.",
        packetIndex: first.index,
        source: first.packet.source,
        destination: first.packet.destination,
        register: first.packet.register,
        value: first.packet.value,
        count: entries.length,
      });
    }
  });

  return findings;
}
