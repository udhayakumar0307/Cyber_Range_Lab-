import { decodePackets } from "./modbusDecoder";
import { buildConversations } from "./conversationTracker";

export function buildTrafficStatistics(packetList = []) {
  const decodedPackets = decodePackets(packetList);
  const conversations = buildConversations(packetList);

  const stats = {
    totalPackets: decodedPackets.length,
    modbusPackets: 0,
    reads: 0,
    writes: 0,
    responses: 0,
    suspicious: 0,
    normal: 0,
    protocols: {},
    sources: {},
    destinations: {},
    registers: {},
    functionCodes: {},
    conversations: conversations.length,
    topTalkers: [],
  };

  decodedPackets.forEach((packet) => {
    stats.protocols[packet.protocol] =
      (stats.protocols[packet.protocol] || 0) + 1;

    stats.sources[packet.source] =
      (stats.sources[packet.source] || 0) + 1;

    stats.destinations[packet.destination] =
      (stats.destinations[packet.destination] || 0) + 1;

    if (packet.isModbus) stats.modbusPackets++;
    if (packet.isRead) stats.reads++;
    if (packet.isWrite) stats.writes++;

    if ((packet.operation || "").toLowerCase().includes("response")) {
      stats.responses++;
    }

    if (packet.severity === "HIGH" || packet.severity === "CRITICAL") {
      stats.suspicious++;
    } else {
      stats.normal++;
    }

    if (packet.register) {
      stats.registers[packet.register] =
        (stats.registers[packet.register] || 0) + 1;
    }

    if (packet.functionCode !== null) {
      stats.functionCodes[packet.functionCode] =
        (stats.functionCodes[packet.functionCode] || 0) + 1;
    }
  });

  stats.topTalkers = conversations.slice(0, 5).map((conversation) => ({
    source: conversation.source,
    destination: conversation.destination,
    protocol: conversation.protocol,
    packets: conversation.packetCount,
    suspicious: conversation.suspicious,
  }));

  return stats;
}

export function getMostTargetedRegisters(packetList = [], limit = 5) {
  const stats = buildTrafficStatistics(packetList);

  return Object.entries(stats.registers)
    .map(([register, count]) => ({
      register,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getProtocolBreakdown(packetList = []) {
  return buildTrafficStatistics(packetList).protocols;
}

export function getSourceBreakdown(packetList = []) {
  return buildTrafficStatistics(packetList).sources;
}
