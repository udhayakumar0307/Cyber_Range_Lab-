import { decodePackets } from "./modbusDecoder";

export function buildStreams(packetList = []) {
  const packets = decodePackets(packetList);
  const streams = {};

  packets.forEach((packet, index) => {
    const key = `${packet.source}|${packet.destination}|${packet.protocol}`;

    if (!streams[key]) {
      streams[key] = {
        id: Object.keys(streams).length + 1,
        source: packet.source,
        destination: packet.destination,
        protocol: packet.protocol,
        packets: [],
      };
    }

    streams[key].packets.push({
      index,
      time: packet.timestamp,
      direction: `${packet.source} → ${packet.destination}`,
      operation: packet.operation,
      functionCode: packet.functionCode,
      register: packet.register,
      value: packet.value,
      severity: packet.severity,
      meaning: packet.physicalMeaning,
    });
  });

  return Object.values(streams);
}

export function getStreamById(packetList = [], streamId) {
  return buildStreams(packetList).find((stream) => stream.id === streamId);
}
