import { decodePackets } from "./modbusDecoder";

export function buildCommunicationMatrix(packetList = []) {
  const packets = decodePackets(packetList);
  const matrix = {};

  packets.forEach((packet) => {
    const key = `${packet.source}|${packet.destination}`;

    if (!matrix[key]) {
      matrix[key] = {
        source: packet.source,
        destination: packet.destination,
        packets: 0,
        reads: 0,
        writes: 0,
        suspicious: 0,
        protocols: {},
        registers: {},
      };
    }

    matrix[key].packets += 1;

    if (packet.isRead) matrix[key].reads += 1;
    if (packet.isWrite) matrix[key].writes += 1;

    if (packet.severity === "HIGH" || packet.severity === "CRITICAL") {
      matrix[key].suspicious += 1;
    }

    matrix[key].protocols[packet.protocol] =
      (matrix[key].protocols[packet.protocol] || 0) + 1;

    if (packet.register) {
      matrix[key].registers[packet.register] =
        (matrix[key].registers[packet.register] || 0) + 1;
    }
  });

  return Object.values(matrix).sort((a, b) => b.packets - a.packets);
}

export function getCommunicationPair(packetList = [], source, destination) {
  return buildCommunicationMatrix(packetList).find(
    (row) => row.source === source && row.destination === destination
  );
}

export function getHighRiskCommunications(packetList = []) {
  return buildCommunicationMatrix(packetList).filter(
    (row) => row.suspicious > 0 || row.writes > 0
  );
}
