import { decodePackets } from "./modbusDecoder";

export function buildPacketRelationships(packetList = []) {
  const packets = decodePackets(packetList);
  const relationships = [];

  packets.forEach((packet, index) => {
    const responseIndex = findResponsePacket(packets, packet, index);

    if (responseIndex !== null) {
      relationships.push({
        type: "REQUEST_RESPONSE",
        requestIndex: index,
        responseIndex,
        source: packet.source,
        destination: packet.destination,
        protocol: packet.protocol,
        functionCode: packet.functionCode,
      });
    }
  });

  return relationships;
}

function findResponsePacket(packets, request, requestIndex) {
  if (!request.isRead && !request.isWrite) return null;

  for (let i = requestIndex + 1; i < packets.length; i++) {
    const candidate = packets[i];

    if (
      candidate.source === request.destination &&
      candidate.destination === request.source &&
      candidate.protocol === request.protocol
    ) {
      return i;
    }
  }

  return null;
}

export function getRelatedPackets(packetList = [], packetIndex) {
  const relationships = buildPacketRelationships(packetList);

  return relationships.filter(
    (rel) => rel.requestIndex === packetIndex || rel.responseIndex === packetIndex
  );
}
